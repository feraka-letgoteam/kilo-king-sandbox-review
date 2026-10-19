/** Consolidate the frozen production-renderer evidence. No application edits. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { sourceFingerprint } from './v79-source-fingerprint.mjs';

const root = 'art/kilo-v79', dir = `${root}/proofs`, fingerprint = sourceFingerprint();
const names = ['base-spin','entry-dock','collection','entry-vs','vs-five','chopper','god-full','god-early-loss','god-late-overshoot'];
const sizes = ['1440x900','390x844'];
const rows = [];
for (const name of names) for (const size of sizes) {
  const id = `${name}-${size}`, manifest = JSON.parse(fs.readFileSync(`${dir}/${id}.json`, 'utf8'));
  assert.equal(manifest.sourceFingerprint, fingerprint, `${id}: stale source`);
  assert.deepEqual(manifest.viewport, size.split('x').map(Number));
  assert.equal(manifest.capture.kind, 'frame-sequence');
  assert.equal(manifest.capture.frames, manifest.snapshots.length);
  assert(manifest.snapshots.length > 5);
  let lastTime = -1;
  for (const frame of manifest.snapshots) {
    assert(frame.ms > lastTime, `${id}: timestamps must increase`); lastTime = frame.ms;
    assert(fs.statSync(`${dir}/${frame.file}`).size > 1000, `${id}: missing frame`);
  }
  if (name.startsWith('god-')) {
    assert.equal(manifest.normalSpinCalls, 1);
    assert(manifest.phases.some(p => p.phase === 'ordinary-reel-spin'));
    assert(manifest.phases.some(p => p.phase === 'anticipate'));
    assert(manifest.phases.some(p => p.phase === 'advance'));
    assert(manifest.telemetry.every(f => f.stripVisibility.every(Boolean)));
    assert(manifest.telemetry.every(f => f.stripCellCounts.every(n => n >= 3)));
    assert.equal(manifest.credits.length, name === 'god-full' ? 1 : 0);
    assert.equal(manifest.finalWin, name === 'god-full' ? 25000000 : 0);
  }
  if (name === 'collection') {
    assert.equal(manifest.finalWin, 48000);
    assert.deepEqual(manifest.credits.map(c => c.value), [48000]);
    assert.equal(manifest.bankEvents.length, 1);
  }
  if (name === 'vs-five') {
    assert(manifest.telemetry.some(f => f.groups.some(g => g.reels.length === 5)));
    for (const f of manifest.telemetry) for (const group of f.groups)
      assert(group.reels.every(reel => !f.stripVisibility[reel]), `${id}: symbols under VS`);
  }
  rows.push({id, viewport: manifest.viewport, durationMs: manifest.durationMs,
    frameCount: manifest.snapshots.length, finalWin: manifest.finalWin,
    credits: manifest.credits, phases: manifest.phases, snapshots: manifest.snapshots});
}
for (const file of ['verification.json','ambient-verification.json','ui-markup-verification.json'])
  assert.equal(JSON.parse(fs.readFileSync(`${root}/${file}`, 'utf8')).sourceFingerprint, fingerprint, file);
const evidence = {sourceFingerprint: fingerprint, method: 'Silent sampled frame sequences from the actual production stage/controllers, CPU Canvas rasterizer and WIN harness. Not browser/WebGL, full React UI, audio or device-performance verification.',
  frameIntervalMs: 200, additionalSemanticPhaseFrames: true, sequences: rows};
fs.writeFileSync(`${dir}/index.json`, JSON.stringify(evidence, null, 2)+'\n');
const payload = JSON.stringify(evidence).replaceAll('<', '\\u003c');
fs.writeFileSync(`${dir}/index.html`, `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kilo King v79 — offline frame evidence</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#07131f;color:#f5eddc;font:16px/1.5 system-ui,sans-serif}main{max-width:1500px;margin:auto;padding:20px}h1{font-size:24px;margin:0 0 8px}p{max-width:100ch;color:#b6c8ce;margin:8px 0}nav{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:18px 0}select,button{font:inherit;padding:10px 14px;background:#123147;color:#fff;border:1px solid #668692;border-radius:7px;min-height:44px}button{cursor:pointer}input{flex:1;min-width:200px;accent-color:#40d0be}figure{margin:16px 0;background:#020a10;display:grid;justify-items:center;min-height:150px}img{max-width:100%;max-height:76vh;object-fit:contain;display:block}figcaption{font-variant-numeric:tabular-nums;padding:10px;text-align:center}code{font-size:12px;overflow-wrap:anywhere}a{color:#7eddd2}#phases{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}#phases button{font-size:13px;padding:5px 9px}small{color:#b6c8ce}
</style><main><h1>Kilo King v79 · gameplay animation evidence</h1>
<p>Actual production stage and feature controllers, sampled every 200 ms with extra phase frames. Silent offline CPU Canvas rendering with a WIN harness. This is a frame review, not a live browser or full control-UI recording; sampled playback does not establish device frame rate.</p>
<nav><label for="case">Sequence </label><select id="case"></select><button id="prev">Previous frame</button><button id="play">Play sampled frames</button><button id="next">Next frame</button><input id="seek" aria-label="Frame" type="range" min="0" value="0" step="1"></nav>
<figure><img id="frame" alt="Captured production stage"><figcaption id="caption"></figcaption></figure>
<div id="phases"></div><p id="summary"></p><p><a id="manifest">Full timing and transfer manifest</a> · <a href="../README.md">Scope and limitations</a></p><small>Frozen source fingerprint: <code id="fingerprint"></code></small></main>
<script>const evidence=${payload};const $=id=>document.getElementById(id);let sequence=evidence.sequences[0],cursor=0,timer=null;
for(const row of evidence.sequences){const o=document.createElement('option');o.value=row.id;o.textContent=row.id.replaceAll('-',' ');$('case').append(o)}
$('fingerprint').textContent=evidence.sourceFingerprint;
function stop(){clearTimeout(timer);timer=null;$('play').textContent='Play sampled frames'}
function show(n){cursor=Math.max(0,Math.min(sequence.snapshots.length-1,n));const f=sequence.snapshots[cursor];$('seek').value=cursor;$('frame').src=f.file;$('frame').alt=sequence.id+' at '+Math.round(f.ms)+' ms: '+f.phase;$('caption').textContent=(f.ms/1000).toFixed(3)+' s · '+f.phase+(f.segment===undefined?'':' · reel position '+f.segment.toFixed(2))+' · frame '+(cursor+1)+'/'+sequence.snapshots.length}
function load(id){stop();sequence=evidence.sequences.find(s=>s.id===id);$('seek').max=sequence.snapshots.length-1;$('manifest').href=sequence.id+'.json';$('summary').textContent='Recorded final WIN: '+sequence.finalWin.toLocaleString()+' · '+sequence.credits.length+' credit event(s).';$('phases').replaceChildren();for(const p of sequence.phases){const b=document.createElement('button');b.textContent=(p.ms/1000).toFixed(2)+' s '+p.phase;b.onclick=()=>{stop();show(sequence.snapshots.reduce((best,f,i)=>Math.abs(f.ms-p.ms)<Math.abs(sequence.snapshots[best].ms-p.ms)?i:best,0))};$('phases').append(b)}show(0)}
function tick(){if(cursor>=sequence.snapshots.length-1){stop();return}const delay=sequence.snapshots[cursor+1].ms-sequence.snapshots[cursor].ms;timer=setTimeout(()=>{show(cursor+1);tick()},delay)}
$('case').onchange=e=>load(e.target.value);$('prev').onclick=()=>{stop();show(cursor-1)};$('next').onclick=()=>{stop();show(cursor+1)};$('seek').oninput=e=>{stop();show(Number(e.target.value))};$('play').onclick=()=>{if(timer!==null){stop();return}if(cursor>=sequence.snapshots.length-1)show(0);$('play').textContent='Pause';tick()};load(sequence.id);</script></html>`);
console.log(`PASS ${rows.length} sequences, ${rows.reduce((n,r)=>n+r.frameCount,0)} frames; one production fingerprint ${fingerprint}.`);
