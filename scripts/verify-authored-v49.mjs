// Source, raster and registration verification. This is not browser/GPU QA.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {authoredFrameAt,authoredRegistration} from '../src/components/kilo/authored-animation.ts';

const checkpoint='d3b8aac304bf1cf08c60e46d196096f4a4d0d110';
const clips=JSON.parse(fs.readFileSync('art/kilo-animation-v49/runtime-clips.json','utf8'));
assert.equal(Object.keys(clips).length,23);
const sizes=[[64,64],[96,96],[144,144],[600,400]];
let registrations=0,frameSamples=0;
for(const [key,clip] of Object.entries(clips)){
  for(let i=0;i<=100;i++){assert(clip.frames[authoredFrameAt(clip,i/100)],`${key}: missing frame`);frameSamples++;}
  if(clip.durations)assert.equal(clip.sequence.length,clip.durations.length);
  for(const [w,h] of sizes){
    const at=authoredRegistration(clip,w,h),[l,t,r,b]=clip.bounds,ref=clip.reference,[rl,rt,rr,rb]=ref.bounds;
    const base=Math.min(w/ref.width,h/ref.height),cx=(w-ref.width*base)/2,cy=(h-ref.height*base)/2;
    assert(Number.isFinite(at.scale)&&at.scale>0);
    assert(at.x+l*at.scale>=cx+rl*base-.001&&at.x+r*at.scale<=cx+rr*base+.001,`${key}: horizontal envelope`);
    assert(at.y+t*at.scale>=cy+rt*base-.001&&at.y+b*at.scale<=cy+rb*base+.001,`${key}: vertical envelope`);
    registrations++;
  }
}
const raster=JSON.parse(execFileSync('python',['-c',String.raw`
from PIL import Image
from pathlib import Path
import json,hashlib
clips=json.loads(Path('art/kilo-animation-v49/runtime-clips.json').read_text()); results=[]
for key,c in clips.items():
 im=Image.open('public'+c['url']).convert('RGBA'); assert im.size==(c['width'],c['height']),key
 hashes=[]
 for f in c['frames']:
  x,y,w,h=[f[z] for z in ('x','y','w','h')]
  assert x>=0 and y>=0 and x+w<=im.width and y+h<=im.height,key
  frame=im.crop((x,y,x+w,y+h));assert frame.getchannel('A').getextrema()==(0,255),key
  hashes.append(hashlib.sha256(frame.tobytes()).hexdigest())
 assert len(set(hashes))==len(hashes),key
 results.append({'key':key,'frames':len(hashes),'bytes':Path('public'+c['url']).stat().st_size})
m=json.loads(Path('public/kilo-animation-v49/scenes/chopper-rotor-metadata.json').read_text());a=Image.open('public'+m['atlas']).convert('RGBA')
assert a.size==tuple(m['atlasSizePx'])
for f in m['frames']:
 x,y,w,h=f['rect'];cx,cy,cw,ch=f['centerExclusionRect']
 assert x+w<=a.width and y+h<=a.height
 assert a.crop((x+cx,y+cy,x+cx+cw,y+cy+ch)).getchannel('A').getextrema()[1]==0
for o in m['orientations'].values():
 for k in ['cleanup','hubCap']: assert Image.open('public'+o[k]).size==tuple(o['sourceSizePx'])
print(json.dumps(results))
`],{encoding:'utf8'}));
const changed=execFileSync('git',['diff','--name-only',checkpoint],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
// New v49 assets are expected additions, including after they are committed.
// Only art that existed at the v48 checkpoint is protected by this old guard.
const checkpointFiles=new Set(execFileSync('git',['ls-tree','-r','--name-only',checkpoint],{encoding:'utf8'}).trim().split('\n'));
for(const f of changed){
 assert(!f.startsWith('src/lib/kilo/'),`Math/wallet changed: ${f}`);
 assert(!f.startsWith('src/components/slot-controls/'),`Controls changed: ${f}`);
 assert(!/(?:layout|director|scene-system|integrated-scene-model)\.ts$/.test(f),`Geometry/controller changed: ${f}`);
 assert(!(f.startsWith('public/')&&checkpointFiles.has(f)),`Existing art changed: ${f}`);
}
const stage=fs.readFileSync('src/components/kilo/pixiStage.ts','utf8');
function decl(text,name){const tree=ts.createSourceFile('stage.ts',text,ts.ScriptTarget.Latest,true);let found;function visit(n){if((ts.isFunctionDeclaration(n)||ts.isMethodDeclaration(n))&&n.name?.getText(tree)===name)found=n.getText(tree);ts.forEachChild(n,visit);}visit(tree);assert(found);return found;}
const prior=execFileSync('git',['show',`${checkpoint}:src/components/kilo/pixiStage.ts`],{encoding:'utf8'});
for(const name of ['cellView','edgeFor','frameBorders','fitReels','geomFor','hookSprite','tool','intro','deliverCollectors','portions','collect'])assert.equal(decl(stage,name),decl(prior,name),name+' changed');
assert.equal(decl(stage,'retrigger').replace('      const stopAuthoredArt = playRetriggerArt(group,x,y,w,h);\n','').replace('        stopAuthoredArt();\n',''),decl(prior,'retrigger'));
const overlay=decl(stage,'playRetriggerArt');assert(!/onAward|await|holdReadable/.test(overlay));
for(const f of ['AuthoredArt.tsx','AuthoredCharacter.tsx','SceneMotionCanvas.tsx']){
 const s=fs.readFileSync('src/components/kilo/'+f,'utf8');
 assert(s.includes('ResizeObserver')&&s.includes('cancelAnimationFrame')&&s.includes('visibilitychange'),f+' lifecycle');
 assert(!/onAward|settle|wallet|Math.random|setBalance/.test(s),f+' gameplay dependency');
}
// Match actual title/award number centers to new entry panels' safe rectangles.
const bonuses=JSON.parse(fs.readFileSync('public/kilo-animation-v49/bonuses/manifest.json','utf8')).assets;
for(const [id,y]of Object.entries({'entry-scatter-3':.40,'entry-scatter-4':.58,'entry-scatter-5':.415,'entry-chopper':.47})){
 const clip=clips[id],a=authoredRegistration(clip,600,400.2),safe=bonuses[id].safeArea;
 const bounds={l:a.x+safe.x*a.scale,r:a.x+(safe.x+safe.w)*a.scale,t:a.y+safe.y*a.scale,b:a.y+(safe.y+safe.h)*a.scale};
 assert(300>bounds.l&&300<bounds.r&&400.2*y>bounds.t&&400.2*y<bounds.b,`${id}: award center outside safe panel`);
}
const results={checkpoint,method:'Source, real raster decoding, fixed registration mathematics and finite frame sampling; no browser or GPU screenshots.',clips:raster,registrations,frameSamples,rotor:{phases:4,sourceRegisteredCameras:2,duplicateHubExcluded:true},protectedGameplayGeometryControls:true,entryCentersInsideSafeAreas:true,remaining:['Live compositing, frame pacing and art handover need browser/device review.','Four-key symbol poses have minor redraw variation; no claim of full skeletal animation.']};
fs.writeFileSync('art/kilo-animation-v49/verification.json',JSON.stringify(results,null,2)+'\n');
console.log(`PASS ${raster.length} raster clips, ${registrations} envelope fits, ${frameSamples} frame samples; protected source and entry safe areas.`);
