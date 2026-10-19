import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {sourceFingerprint} from './v79-source-fingerprint.mjs';
const root='art/kilo-v82/proofs',fingerprint=sourceFingerprint();
const ids=[...['session-vs','ordinary','vs-pair','vs-wide','collection'].flatMap(name=>['1440x900','390x844'].map(size=>`${name}-${size}`)),
 'entry-dock-390x844','god-full-390x844','god-early-loss-1440x900'];
const rows=[];
for(const id of ids){
 const d=JSON.parse(fs.readFileSync(`${root}/${id}.json`));assert.equal(d.sourceFingerprint,fingerprint,`${id}: frozen production source`);
 assert.equal(d.capture.kind,'movie');assert(d.audioProof?.file,`${id}: timed audio proof exists`);
 const file=`${root}/${d.audioProof.file}`;
 const stream=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate,nb_frames','-of','json',file],{encoding:'utf8'})).streams[0];
 assert.deepEqual([stream.width,stream.height],d.viewport);assert.equal(Number(stream.nb_frames),d.capture.frames);assert.equal(stream.r_frame_rate,`${d.capture.fps}/1`);
 const rounds=d.sessionRecords.map(r=>r.script),ordinary=id.startsWith('ordinary'),full=id.startsWith('session-vs');
 if(ordinary){assert(d.durationMs>=180000);assert(rounds.length>20);}
 if(full){assert.equal(rounds.length,1);assert.equal(rounds[0].free.length,15);assert.equal(d.finalWin,rounds[0].payout);assert.equal(d.bankEvents.reduce((sum,e)=>sum+e.value,0),d.finalWin);}
 if(id.startsWith('collection')){assert.deepEqual(d.bankEvents.map(e=>e.value),[48000]);}
 if(id.startsWith('vs-')){assert.equal(d.bankEvents.length,1);assert.equal(d.finalWin-d.fixture.previousTotal,d.bankEvents[0].value);}
 const special=['vsReady','vsPull','vsImpact','vsLock','vsConnect','vsAmount','vsTransfer','vsBank','bonusEnter','bonusExit'];
 rows.push({id,file:d.audioProof.file,videoSha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex'),viewport:d.viewport,durationSeconds:d.durationMs/1000,captureFps:d.capture.fps,sourceFps:d.fps,
  normalGameSpeed:true,finalWin:d.finalWin,bankEvents:d.bankEvents,
  cues:d.cues.filter(c=>special.includes(c.name)).map(c=>({name:c.name,seconds:c.ms/1000})),
  session:rounds.length?{selection:ordinary?'Sequential unselected rounds from seed 822026; no filtering':'First purchased VS outcome from seed 822026; no filtering',rounds:rounds.length,paidRounds:rounds.filter(r=>r.payout>0).length,features:rounds.filter(r=>r.free.length).length,hooks:rounds.filter(r=>r.base.hook?.length).length,baseCollectors:rounds.filter(r=>r.base.collect?.got>0).length,cost:rounds.reduce((s,r)=>s+r.cost,0),returned:rounds.reduce((s,r)=>s+r.payout,0)}:null});
}
const output={sourceFingerprint:fingerprint,method:'Production controllers and display lists rasterized to native CPU Canvas with the source scene/character painters. WIN harness and source-timestamped offline audio mix. Not browser, complete React UI, real-wallet or GPU proof.',proofs:rows};
fs.writeFileSync('art/kilo-v82/proof-index.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({passed:rows.length,sourceFingerprint:fingerprint,ordinary:rows.filter(r=>r.id.startsWith('ordinary')).map(r=>({id:r.id,seconds:r.durationSeconds,...r.session}))},null,2));
