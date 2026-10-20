import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createOfflineRuntime} from './offline-runtime-v79.mjs';
import {sourceFingerprint} from './v79-source-fingerprint.mjs';
const checkpoint='370c6fb87bee5cd2a49c72e52ac1f96d26534b86',r=createOfflineRuntime(),out='art/kilo-v87/verification';fs.mkdirSync(out,{recursive:true});
const paths=execFileSync('git',['ls-tree','-r','--name-only',checkpoint,'src/lib/kilo','src/components/slot-controls','src/components/kilo/control-model.ts','src/components/kilo/layout.ts','src/components/kilo/play.tsx','src/components/kilo/director.ts','src/components/kilo/reel-feature-director.ts','src/components/kilo/feature-takeover.tsx'],{encoding:'utf8'}).trim().split('\n');
for(const p of paths)assert.deepEqual(fs.readFileSync(p),execFileSync('git',['show',`${checkpoint}:${p}`],{maxBuffer:64*1024*1024}),`Protected source ${p}`);
const life=r.load('src/components/kilo/stage-character-life.ts'),arms=r.load('src/components/kilo/stage-character-arm.ts'),mesh=r.load('src/components/kilo/stage-character-mesh.ts');let samples=0;
for(const kind of ['max','vs'])for(let stage=1;stage<=5;stage++)for(const beat of ['anticipate','advance','settle','stall'])for(let i=0;i<=50;i++){
 const focus={kind,stage,beat,progress:i/50},base=life.stageKingFrameAt(18000),f=life.focusedKingFrame(base,focus),left=arms.kingLeftArmPose(f),right=arms.kingRightRodPose(f);
 for(const n of [f.look,f.brace,f.rod,f.nod,left.hand.x,left.hand.y,right.tip.x,right.tip.y])assert(Number.isFinite(n));
 for(const p of [{x:250,y:650},{x:400,y:750}])assert.deepEqual(mesh.kingMeshPoint(p.x,p.y,f),p);
 assert(Math.abs(Math.hypot(left.elbow.x-left.shoulder.x,left.elbow.y-left.shoulder.y)-100)<1e-8);
 assert.deepEqual(life.focusedKingFrame(base,focus,true),base,'Reduced motion ignores focus');samples++;
}
const playback=life.createStageKingPlayback();playback.react('first','max');
for(let stage=1;stage<=5;stage++){for(let i=0;i<20;i++)playback.advance(80);playback.focus({kind:'max',stage,beat:'anticipate',progress:.95});const frame=playback.advance(0);assert.equal(frame.reaction,'max');assert(frame.look<-2.5,'Every advance retains readable attention');}
playback.focus(null);playback.react('success','max-stop');assert.equal(playback.advance(50).reaction,'max-stop');playback.settle();assert.equal(playback.advance(0).reactionProgress,1);
const reports={checkpoint,sourceFingerprint:sourceFingerprint(),protectedFiles:paths,focusSamples:samples,mathAndFiveScatterUnchanged:true,controlsWalletAndDirectorUnchanged:true,method:'Byte comparisons to v86 and production focused-character pose/rig functions; not live browser or certification.'};
fs.writeFileSync(`${out}/protected-and-attention.json`,JSON.stringify(reports,null,2)+'\n');console.log(`PASS ${paths.length} protected files unchanged; ${samples} focused poses and five-stage attention.`);
