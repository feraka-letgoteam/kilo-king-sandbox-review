import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {sourceFingerprint} from './v77-source-fingerprint.mjs';
const root='art/kilo-v78/proofs',fingerprint=sourceFingerprint();
const expected=['god-full-1440x900','god-full-390x844','vs-five-1440x900','vs-five-390x844','god-early-loss-1440x900','god-late-overshoot-390x844'];
const clips=[];
for(const id of expected){
  const d=JSON.parse(fs.readFileSync(`${root}/${id}.json`,'utf8')),path=`${root}/${id}.mp4`,bytes=fs.readFileSync(path);
  const stream=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate,nb_frames,duration','-of','json',path],{encoding:'utf8'})).streams[0];
  assert.equal(d.sourceFingerprint,fingerprint);
  assert.deepEqual([stream.width,stream.height],d.viewport);
  assert.equal(Number(stream.nb_frames),d.capture.frames);assert.equal(stream.r_frame_rate,`${d.capture.fps}/1`);
  assert.equal(d.telemetry.length,d.frames,'Full 30 fps controller timeline retained');
  assert.equal(d.finalWin-d.fixture.previousTotal,d.fixture.event.credited);
  assert.deepEqual(d.credits.map(c=>c.value),d.bankEvents.map(c=>c.value));
  assert.equal(d.credits.length,d.fixture.event.credited>0?1:0,'One transfer, or none for loss');
  const previous=`art/kilo-v77/proofs/${id}.json`;let priorTimingCompared=false;
  if(fs.existsSync(previous)){
    const old=JSON.parse(fs.readFileSync(previous,'utf8'));
    assert.deepEqual(d.fixture.event,old.fixture.event,'Same recorded outcome');
    assert.deepEqual(d.cues,old.cues,'Exact sound beat crossings preserved');
    assert.deepEqual(d.credits,old.credits,'Exact credit values and times preserved');
    assert.equal(d.durationMs,old.durationMs,'Result resolves at the same time');
    priorTimingCompared=true;
  }
  if(id.startsWith('god')){
    assert.equal(d.normalSpinCalls,1);
    assert(d.telemetry.every(t=>t.stripVisibility.every(Boolean)&&t.stripCellCounts.every(n=>n>=3)));
    const result=d.telemetry.filter(t=>t.card?.phase==='result');
    assert(result.every(t=>t.card.pitch===0&&t.card.lean===0&&t.card.wake===0));
  }else{
    assert(d.telemetry.some(t=>t.groups.some(g=>g.reels.length===5&&g.multiplier===384)));
    for(const frame of d.telemetry)for(const group of frame.groups)assert(group.reels.every(i=>frame.stripVisibility[i]===false));
  }
  clips.push({id,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),capture:d.capture,viewport:d.viewport,credits:d.credits,priorTimingCompared});
}
const report={sourceFingerprint:fingerprint,method:'15 fps native CPU Canvas excerpts from the full 30 fps production controller timeline. Silent; WIN harness; not browser/WebGL.',clips};
fs.writeFileSync('art/kilo-v78/proof-index.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({verified:clips.length,sourceFingerprint:fingerprint,allLegacyTimingsMatched:clips.every(c=>c.priorTimingCompared)}));
