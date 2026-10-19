/** Link final evidence to the shipped sources; do not relabel offline clips as browser proof. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {sourceFingerprint} from './v79-source-fingerprint.mjs';
const root='art/kilo-v80',fingerprint=sourceFingerprint(),read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const report=read(root+'/verification.json');assert.equal(report.sourceFingerprintAtStart,fingerprint);
assert.equal(read(root+'/collection-interruptions.json').sourceFingerprint,fingerprint);
const vsFiles=['src/components/kilo/reel-feature-effects.ts','src/components/kilo/vs-encounter.ts','src/components/kilo/vs-group-art.ts','src/components/kilo/vs-merge-motion.ts','src/components/kilo/win-type.ts'];
const vsHash=crypto.createHash('sha256').update(vsFiles.map(f=>f+'\n'+fs.readFileSync(f,'utf8')).join('\n')).digest('hex');
const environment=read(root+'/environment/verification.json');
assert.equal(environment.fingerprint,crypto.createHash('sha256').update(Buffer.concat(environment.sourceFiles.map(p=>Buffer.concat([Buffer.from(p+'\0'),fs.readFileSync(p)])))).digest('hex'));
const required=['collection-1440x900','collection-390x844','base-spin-1440x900','base-spin-390x844','entry-dock-1440x900','entry-dock-390x844'];
const proofs=[];
for(const id of required){const path=root+'/proofs/'+id,json=read(path+'.json');assert.equal(json.sourceFingerprint,fingerprint);assert(json.snapshots.length>5);
 for(const snap of json.snapshots)assert(fs.statSync(root+'/proofs/'+snap.file).size>1000);
 if(json.capture.kind==='movie'){const m=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height,nb_frames,r_frame_rate','-of','json',path+'.mp4'])).streams[0];assert.equal(Number(m.nb_frames),json.capture.frames);assert.equal(m.r_frame_rate,json.capture.fps+'/1');}
 proofs.push({id,path:path+'.json',sourceFingerprint:fingerprint,kind:json.capture.kind,frames:json.capture.frames,method:json.method});
}
for(const size of ['1440x900','390x844']){const file=root+'/vs/vs-encounter-'+size+'.json',j=read(file);assert.equal(j.ownedPresentationFingerprint,vsHash);assert.equal(j.paid,j.recorded);proofs.push({path:file,kind:'movie',frames:j.frames,ownedPresentationFingerprint:vsHash,method:j.method});}
const media=read(root+'/environment/media-verification.json');
const manifest={build:'v80',sourceFingerprint:fingerprint,method:'Offline CPU source renderer, native font bounds and exact controller traces. Not browser/WebGL or device performance.',protectedSource:report.protectedFiles,checks:{timingComparisons:report.legacyComparisons.length+report.outcomeTimingComparisons.length,controllerCases:report.cases.length,skipResize:report.interruptions.length,collectionTraceComparisons:report.collectionTimingComparisons.length,collectionInterruptions:read(root+'/collection-interruptions.json').results.length,headerLayouts:read(root+'/ui/verification.json').checks.length,ambientVariants:environment.rows.length},environmentFingerprint:environment.fingerprint,environmentMedia:media,proofs};
fs.writeFileSync(root+'/proof-index.json',JSON.stringify(manifest,null,2)+'\n');
console.log('PASS final frozen-source proof and media attestation.');
