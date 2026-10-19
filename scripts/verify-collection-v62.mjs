// Executes the production collection method, tweens and reaction functions
// against instrumented display objects and a virtual clock. NOT a browser,
// GPU-render, screenshot, video, or live typography verification.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {collectionHold, stageReadoutLayout, collectorAmountLabels, collectionType} from '../src/components/kilo/presentation-readout.ts';
import {fitGameLayout} from '../src/components/kilo/layout.ts';
import {collectorAtlas, reactionIndex} from '../src/components/kilo/motion-atlas.ts';
import {fishReaction} from '../src/components/kilo/fish-art.ts';
import {authoredFrameAt} from '../src/components/kilo/authored-animation.ts';
const withAuthored=process.argv.includes('--authored');
const featuresV51=process.argv.includes('--features-v51');
import {loadProduction} from './kilo-v55-test-loader.mjs';
const clips=withAuthored?loadProduction('src/components/kilo/authored-clips.ts').AUTHORED_CLIPS:{};

const source=fs.readFileSync('src/components/kilo/pixiStage.ts','utf8');
// Pure VS adds one early-return cell branch. Verify the complete original cell
// renderer is still byte-identical when that separately-tested branch is removed.
const parse=ts.createSourceFile('stage.ts',source,ts.ScriptTarget.Latest,true);let duelBranch;
const findDuel=n=>{if(ts.isIfStatement(n)&&n.expression.getText(parse)==='cell.duel')duelBranch=n;ts.forEachChild(n,findDuel);};findDuel(parse);assert(duelBranch?.elseStatement,'explicit VS-only branch');
const protectedSource=source.replace(duelBranch.getText(parse),duelBranch.elseStatement.getText(parse));
const director=fs.readFileSync('src/components/kilo/director.ts','utf8');
function declaration(text,name){
 const tree=ts.createSourceFile('source.ts',text,ts.ScriptTarget.Latest,true);let found;
 function visit(node){if((ts.isFunctionDeclaration(node)||ts.isMethodDeclaration(node))&&node.name?.getText(tree)===name)found=node;ts.forEachChild(node,visit);}
 visit(tree);assert(found,`Missing ${name}`);return found.getText(tree);
}
const js=text=>ts.transpile(text,{target:ts.ScriptTarget.ESNext});
const fitReels=new Function(js(['edgeFor','frameBorders','fitReels'].map(n=>declaration(source,n)).join('\n'))+';return fitReels;')();
const shares=new Function(js(declaration(director,'collectionShares').replace('export ',''))+';return collectionShares;')();
const fixtures=JSON.parse(fs.readFileSync('src/lib/kilo/fixtures.json','utf8'));
const metric=JSON.parse(execFileSync('python',['-c',`import sys,types,subprocess
try:
 import brotli
except ImportError:
 sys.modules['brotli']=types.SimpleNamespace(decompress=lambda data:subprocess.check_output(['node','-e',"process.stdout.write(require('node:zlib').brotliDecompressSync(require('node:fs').readFileSync(0)))"],input=data))
from fontTools.ttLib import TTFont
import json
f=TTFont('public/kilo-ui-v11/fonts/SourceSans3-700.woff2'); cm=f.getBestCmap()
print(json.dumps({'units':f['head'].unitsPerEm,'chars':{chr(i):f['hmtx'][cm.get(i,'space')][0] for i in list(range(32,127))+[215,8594,183]}}))`],{encoding:'utf8'}));
const width=(text,size)=>[...text].reduce((n,c)=>n+(metric.chars[c]??metric.chars['0'])*size/metric.units,0);
const geometries=[[1440,900],[390,844],[360,800],[844,390]].map(([w,h])=>{
 const pad=w<900?12:24,g=fitGameLayout(w-pad*2,h-pad*2);
 return {viewport:[w,h],...fitReels(Math.round(g.reelWidth),Math.round(g.reelHeight))};
});
const money=n=>Math.max(0,Math.round(n)).toLocaleString('en-US');
function point(){return {x:0,y:0,set(x,y=x){this.x=x;this.y=y;}};}
class Container{
 constructor(){this.children=[];this.position=point();this.scale=point();this.alpha=1;this.destroyed=false;}
 addChild(...items){for(const item of items){item.parent=this;this.children.push(item);}return items[0];}
 removeChildren(){const old=this.children;this.children=[];for(const x of old)x.parent=null;return old;}
 destroy(){this.destroyed=true;for(const x of this.removeChildren())x.destroy();if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}
 get width(){return Math.max(0,...this.children.map(x=>x.width||0));}
 get height(){return Math.max(0,...this.children.map(x=>x.height||0));}
 get x(){return this.position.x;} set x(v){this.position.x=v;}
 get y(){return this.position.y;} set y(v){this.position.y=v;}
}
class Graphics extends Container{
 roundRect(x,y,w,h){this.w=w;this.h=h;return this;}fill(){return this;}stroke(){return this;}clear(){}get width(){return this.w||0;}get height(){return this.h||0;}
}
class Text extends Container{
 constructor({text,style}){super();this.text=text;this.style=style;this.anchor=point();}
 get width(){return width(this.text,Number(this.style.fontSize));}
 get height(){return Number(this.style.fontSize)*1.25;}
}
class Sprite extends Container{constructor(){super();this.kkPlace={asset:'package-small'};this.anchor=point();this.scale.set(.1);this.texture={idle:true};this.rotation=0;}}

const declarations=['tween','holdReadable','playFishAck','playReaction','symbolSprite','restoreSymbols','paintAuthored','restoreAuthored'].map(n=>declaration(source,n)).join('\n');
const factory=new Function('deps',js(`
 const {Container,Graphics,Text,Sprite,collectionHold,collectionType,collectorAmountLabels,stageReadoutLayout,money,collectorAtlas,reactionIndex,fishReaction}=deps;
 let {geom,stake,turbo,reduced,speedMode}=deps;
 let job=0,stopped=false,animating=false,resizeFollow=false;
 const waits=new Set(),reactionRefresh=new Set(),transient=new Container(),fx=new Graphics(),flyers=new Set();
 const host=new EventTarget(),target={dataset:{}},readout={hidden:true};let readoutActive=false;
 const performance={now:()=>deps.now()},requestAnimationFrame=deps.raf,cancelAnimationFrame=deps.cancel;
 const window={setTimeout:deps.timer,clearTimeout:deps.cancel};
 const collectorFrames=[0,1,2,3,4,5,6,7];
 const authoredTextures=new Map(Object.entries(deps.clips).map(([key,clip])=>[key,{clip,frames:clip.frames.map((_,frame)=>({authored:key,frame}))}]));
 const authoredHomes=new WeakMap();
 const authoredFrameAt=(clip,phase)=>{deps.authoredCalls++;return deps.frameAt(clip,phase);};
 const reels=Array.from({length:5},()=>({strip:new Container()}));
 const paintStanding=()=>{reels.forEach(r=>r.strip.removeChildren().forEach(c=>c.destroy()));deps.spin.grid.forEach((col,ri)=>col.forEach(c=>{const view=new Container();view.addChild(new Sprite());if(c.s==='splash'){const tag=new Container();tag.label='collector-tag';view.addChild(tag);}reels[ri].strip.addChild(view);}));};
 paintStanding();
 const applyPlace=(sprite,pose)=>{assertCurrent(sprite);sprite.pose=pose;};
 const showReaction=(sprite,frames,index)=>{assertCurrent(sprite);sprite.frame=index;};
 function assertCurrent(sprite){if(sprite.destroyed)throw Error('Reaction targeted a destroyed sprite');}
 const phaseTarget=()=>target,mark=p=>target.dataset.phase=p;
 const showReadout=(label,value)=>{readoutActive=true;readout.hidden=false;deps.readout(label,value,geom);};
 const collectionCue=detail=>deps.cue(detail);
 const clearPresentation=()=>{readoutActive=false;readout.hidden=true;};
 const portions=deps.shares,screenOf=(x,y)=>({x,y});
 const bonusLanding=()=>({x:geom.dw/2,y:geom.dh+70,numberTop:geom.dh+108});
 const frameBorders=()=>({b:10}),endMotion=()=>{animating=false;};
 const document={body:{appendChild:el=>deps.dom.push(el)},createElement:()=>({style:{},offsetHeight:44,remove(){deps.dom=deps.dom.filter(x=>x!==this);}})};
 ${declarations}
 const scene={${declaration(source,'collect')}};
 return {run:()=>scene.collect(deps.spin),snapshot:()=>({transient,readout,reels,target,geom,flyers,reactionRefresh}),
 resize(next){geom=next;paintStanding();for(const paint of reactionRefresh)paint();host.dispatchEvent(new Event('kilo-relayout'));},
 skip(){job++;stopped=true;for(const done of waits)done();waits.clear();for(const el of flyers)el.remove();flyers.clear();transient.removeChildren().forEach(c=>c.destroy());clearPresentation();collectionCue(null);stopped=false;}
 };
`));

const runs=[];
async function runCase(id,index,speed,reduced,g,action){
 const round=fixtures[id].script,spin=round.free[index],before=JSON.stringify(spin);
 let now=0,nextId=0,queue=new Map(),cues=[],readouts=[],holds=[],completed=false,error,acted=false,flightCount=0,visibleTransfer=0,reactiveResize=false;
 const schedule=(callback,delay)=>{const id=++nextId;queue.set(id,{at:now+delay,callback});return id;};
 const deps={Container,Graphics,Text,Sprite,collectionHold,collectionType,collectorAmountLabels,stageReadoutLayout,money,collectorAtlas,reactionIndex,fishReaction,shares,
   geom:g,stake:round.stake,turbo:speed!=='normal',reduced,speedMode:speed,spin,dom:[],now:()=>now,clips,frameAt:authoredFrameAt,authoredCalls:0,
   raf:cb=>schedule(()=>cb(now),16),timer:(cb,ms)=>{holds.push(ms);return schedule(cb,ms);},cancel:id=>queue.delete(id),
   cue:detail=>cues.push({time:now,detail}),
   readout:(label,value,geom)=>{const box=stageReadoutLayout(geom);assert(width(label,box.labelSize)+width(value,box.amountSize)+26<=box.width,`Readout overflow ${label} ${value}`);readouts.push({time:now,label,value});}
 };
 const h=factory(deps);
 const playing=h.run().then(()=>completed=true).catch(e=>{error=e;completed=true;});
 for(let turns=0;!completed&&turns<20000;turns++){
   for(let i=0;i<10;i++)await Promise.resolve();
   const snap=h.snapshot(),step=snap.target.dataset.collectStep;
   for(const reel of snap.reels)for(const cell of reel.strip.children){const s=cell.children[0];if(s.texture?.authored)assert([s.x,s.y,s.scale.x,s.scale.y,s.anchor.x,s.anchor.y].every(Number.isFinite),'Invalid authored sprite registration');}
   const flight=snap.transient.children.filter(x=>x instanceof Text&&!x.destroyed);
   assert(flight.length<=1,'Travelling values overlap each other');
   if(flight.length)flightCount++;
   for(const label of flight)if(label.alpha>.01){
     spin.grid.forEach((col,reel)=>col.forEach((c,row)=>{
       if(c.s!=='brick'||c.part)return;
       const g=snap.geom,left=g.gx+reel*(g.cell+g.gap)+g.cell*.02,top=g.gy+row*g.cell+g.cell*.72;
       const overlaps=label.position.x+label.width/2>left&&label.position.x-label.width/2<left+g.cell*.96&&label.position.y+label.height/2>top&&label.position.y-label.height/2<top+g.cell*.26;
       assert(!overlaps,'Traveller overlaps a stationary fish label');
     }));
   }
   for(const chip of snap.transient.children.filter(x=>x instanceof Container&&!(x instanceof Text))){
     if(!chip.children.length)continue;
     const text=chip.children.find(x=>x instanceof Text);assert(text&&text.text!=='COLLECT');
     assert(chip.width<=snap.geom.cell*.94+.001,'Subtotal crosses cell width');
     assert(Number(text.style.fontSize)>=12,'Subtotal below readable 12px floor');
     assert(chip.height<=snap.geom.cell*.4,'Subtotal covers collector face');
     for(const label of flight)if(label.alpha>.01){
       const near=Math.abs(label.position.x-chip.position.x)<(chip.width+label.width)/2;
       assert(!near||label.position.y+label.height/2<chip.position.y,'Traveller overlaps subtotal');
     }
   }
   for(const el of deps.dom){
     if(Number(el.style.opacity)>0){visibleTransfer++;assert(parseFloat(el.style.top)+22<=snap.geom.dh+108-9,'Transfer overlaps BONUS WIN');}
   }
   if(action&&!acted&&step===action.phase&&(action.phase==='transfer'?visibleTransfer>1:reduced?readouts.length>1:flightCount>4)){
     acted=true;
     if(action.kind==='skip')h.skip();
     else {h.resize(action.geometry);reactiveResize=h.snapshot().reels.some(r=>r.strip.children.some(c=>c.children[0].frame!==undefined||c.children[0].pose!==undefined||c.children[0].texture?.authored));}
   }
   const first=[...queue.entries()].sort((a,b)=>a[1].at-b[1].at)[0];
   if(first){queue.delete(first[0]);now=first[1].at;first[1].callback();}
 }
 await playing;if(error)throw error;assert(completed,'Virtual clock stalled');
 assert.equal(JSON.stringify(spin),before,'Recorded outcome changed');
 assert.equal(h.snapshot().reactionRefresh.size,0,'Reaction listener leak');
 assert.equal(h.snapshot().flyers.size,0,'Transfer leaked');
 assert.equal(h.snapshot().readout.hidden,true);
 const banks=cues.filter(x=>x.detail?.phase==='bank');
 if(action?.kind==='skip'){assert(acted);assert.equal(banks.length,0,'Skip emitted an extra bank');}
 else {
   assert.equal(banks.length,1,'Collection did not emit exactly one bank');assert.equal(banks[0].detail.completed,spin.got);
   assert.equal(deps.dom.length,0,'Award remained at bank update');
   assert(holds.every(ms=>ms>=300),'Fast/reduced result hold too short');
   const collectors=spin.grid.flat().filter(c=>c.s==='splash').length;
   for(let i=1;i<=collectors;i++)assert.equal(cues.find(x=>x.detail?.index===i)?.detail.subtotal,0,'Stale collector handoff');
   if(id==='tool-bazooka'){
     assert.deepEqual(cues.filter(x=>x.detail?.phase==='gather').map(x=>[x.detail.index,x.detail.subtotal]),[[1,0],[1,2000],[1,12000],[1,24000],[2,0],[2,2000],[2,12000],[2,24000]]);
     assert.equal(readouts.filter(x=>x.label==='12,000 ×2 →'&&x.value==='24,000').length,2);
     assert(readouts.some(x=>x.label==='Collected'&&x.value==='48,000'));
   }else{
     assert(readouts.some(x=>x.label==='Combined before cap'&&x.value==='20,100,000'));
     assert(readouts.some(x=>x.label==='MAX WIN REACHED'&&x.value==='4,770,000'));
     assert.equal(readouts.filter(x=>x.label.includes('credited')&&x.value==='2,385,000').length,2);
   }
   if(action){assert(acted);if(action.phase==='gather'&&!reduced)assert(reactiveResize,'Resize lost current reaction phase');}
 }
 if(reduced){assert.equal(flightCount,0);assert.equal(visibleTransfer,0);}
 if(withAuthored&&!reduced)assert(deps.authoredCalls>0,'New atlases never used');
 if(reduced)assert.equal(deps.authoredCalls,0,'Reduced motion used an authored reaction');
 runs.push({id,index,speed,reduced,authored:withAuthored,authoredPaints:deps.authoredCalls,viewport:g.viewport,action:action?{kind:action.kind,phase:action.phase,to:action.geometry?.viewport}:null,bank: banks[0]?.detail.completed??null,passed:true});
}
for(const [id,index]of [['tool-bazooka',15],['capped-ante',25]]){
 for(const speed of ['normal','turbo','super'])for(const reduced of [false,true])for(const g of geometries)await runCase(id,index,speed,reduced,g);
 for(const speed of ['normal','turbo','super'])for(const phase of ['gather','transfer']){
   await runCase(id,index,speed,false,geometries[0],{kind:'resize',phase,geometry:geometries[2]});
   await runCase(id,index,speed,false,geometries[2],{kind:'resize',phase,geometry:geometries[0]});
   await runCase(id,index,speed,false,geometries[0],{kind:'skip',phase});
 }
 for(const speed of ['normal','turbo','super']){
   await runCase(id,index,speed,true,geometries[0],{kind:'resize',phase:'gather',geometry:geometries[2]});
   await runCase(id,index,speed,true,geometries[2],{kind:'skip',phase:'gather'});
 }
}
// Freeze art, dimensions, header, hooks, ledger and wallet against the checkpoint.
const checkpoint='3aeefc23a3ec82d889bee1dd3803448f7c910ba7';
const old=execFileSync('git',['show',`${checkpoint}:src/components/kilo/pixiStage.ts`],{encoding:'utf8'});
for(const name of ['cellView','edgeFor','frameBorders','fitReels','geomFor','hookSprite','tool','deliverCollectors','portions'])assert.equal(declaration(protectedSource,name),declaration(old,name),`${name} changed`);
// Every collection decision and hold is byte-frozen, excluding only the flight path.
const prior=execFileSync('git',['show','1d63732:src/components/kilo/pixiStage.ts'],{encoding:'utf8'});
const stripFlight=code=>declaration(code,'collect').replace(/      const flyFish = async[\s\S]*?\n      try \{\n        step/, '      FLIGHT_PATH_ONLY\n      try {\n        step');
assert.equal(stripFlight(source),stripFlight(prior),'Collection ordering, cap attribution and holds stay frozen');
// v62 changes only retrigger placement/contact, not its two readable holds or award.
const retrigger=declaration(source,'retrigger');
assert(retrigger.includes('const half = Math.max(0, motionMs.retriggerAnnouncement / 2 - fade)'));
assert.equal((retrigger.match(/await holdReadable\(turbo \? 200 : half\)/g)||[]).length,2);
assert.equal((retrigger.match(/onAward\?\.\(\)/g)||[]).length,1);
assert(retrigger.indexOf('onAward?.()')>retrigger.indexOf('await holdReadable(turbo ? 200 : half)'));
assert(retrigger.includes("host.removeEventListener('kilo-relayout',follow)"));
// The declaration comparisons above retain the original collection checkpoint.
// For accepted feature builds, freeze unrelated files at the latest accepted
// v59 source: max-spin-reveal.ts was added there and is not collection code.
const compatibilityCheckpoint=featuresV51?'516f768':checkpoint;
const changed=execFileSync('git',['diff','--name-only',compatibilityCheckpoint],{encoding:'utf8'}).trim().split('\n');
// v49 adds separately verified decorative animation modules. This v48 check
// continues to protect ledger, wallet, controls, geometry and recorded data.
for(const path of changed)if(!(featuresV51&&['src/lib/kilo/engine.ts','src/lib/kilo/feature-math.ts','src/lib/kilo/reel-feature-math.ts','src/lib/kilo/sound.ts','src/components/kilo/director.ts','src/components/slot-controls/SlotControls.tsx'].includes(path)))if(path.startsWith('src/lib/kilo/')||path.startsWith('src/components/slot-controls/')||path.endsWith('/layout.ts')||path.endsWith('/director.ts'))assert.fail(`Protected source changed: ${path}`);
fs.mkdirSync('art/kilo-collection-v48',{recursive:true});
const outputDir=process.env.KILO_VERIFICATION_DIR??'art/kilo-v62';fs.mkdirSync(outputDir,{recursive:true});
fs.writeFileSync(`${outputDir}/collection-test-results.json`,JSON.stringify({method:'Production collection functions, instrumented display objects, virtual clock and shipped font advances. No browser/GPU verification.',checkpoint,compatibilityCheckpoint,runs},null,2)+'\n');
console.log(`PASS ${runs.length} production collection control-flow cases; exact and capped outcomes, all speeds, reduced motion, bidirectional resize, Skip, and protected source.`);
