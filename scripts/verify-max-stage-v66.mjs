import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
import {loadProduction} from './kilo-v56-test-loader.mjs';
import {Container,Text} from './reel-renderer-mocks-v52.mjs';
const checkpoint='f278e09';
const old=f=>execFileSync('git',['show',`${checkpoint}:${f}`],{encoding:'utf8'});
const read=f=>fs.readFileSync(f,'utf8');
const allowed=new Set(['max-boat-performance.ts','max-boat-rig.ts','max-spin-motion.ts','reel-feature-effects.ts','stage-character-life.ts','RiggedSceneActor.tsx'].map(n=>'src/components/kilo/'+n));
const files=execFileSync('git',['ls-tree','-r','--name-only',checkpoint,'src','public'],{encoding:'utf8'}).trim().split('\n');
let frozen=0;
for(const f of files)if(!allowed.has(f)){
 assert.equal(execFileSync('git',['hash-object',f],{encoding:'utf8'}).trim(),execFileSync('git',['rev-parse',`${checkpoint}:${f}`],{encoding:'utf8'}).trim(),'frozen '+f);frozen++;
}
function declaration(source,name){const tree=ts.createSourceFile('x.ts',source,ts.ScriptTarget.Latest,true);let found;const walk=n=>{if(ts.isFunctionDeclaration(n)&&n.name?.getText(tree)===name)found=n.getText(tree);ts.forEachChild(n,walk);};walk(tree);assert(found,name);return found;}
const effectFile='src/components/kilo/reel-feature-effects.ts',effects=read(effectFile),previous=old(effectFile);
assert.equal(effects.replace(declaration(effects,'getaway'),'MAX'),previous.replace(declaration(previous,'getaway'),'MAX'),'all non-Max effects, win transfer and settlement are byte-identical');
const actorFile='src/components/kilo/RiggedSceneActor.tsx';
assert.equal(read(actorFile).replace("['spin','vs','max','max-stop']","['spin','vs','max']"),old(actorFile),'actor layout and playback unchanged apart from Max-stop event acceptance');
const stage=read('src/components/kilo/pixiStage.ts');
const {setMaxStageVisibility}=loadProduction('src/components/kilo/max-stage-visibility.ts');
const {boatPerformance}=loadProduction('src/components/kilo/max-boat-performance.ts');
const {MAX_ANTICIPATE_MS,maxBeatDuration,maxBoatPlacement}=loadProduction('src/components/kilo/max-spin-motion.ts');
const {createReelFeatureEffects}=loadProduction('src/components/kilo/reel-feature-effects.ts');
const {runReelFeature}=loadProduction('src/lib/kilo/reel-feature-math.ts');
const {fitGameLayout}=loadProduction('src/components/kilo/layout.ts');
const fit=new Function(ts.transpile(['edgeFor','frameBorders','fitReels'].map(n=>declaration(stage,n)).join('\n'),{target:ts.ScriptTarget.ES2022})+';return fitReels;')();
const sizes=[[1440,900],[390,844],[360,800],[844,390]],gs=sizes.map(([w,h])=>{const p=w<900?12:24,l=fitGameLayout(w-p*2,h-p*2);return fit(Math.round(l.reelWidth),Math.round(l.reelHeight));});
const nodes=Array.from({length:12},()=>new Container());
for(const active of [false,true,true,true,false,true,false]){setMaxStageVisibility(nodes,active);assert(nodes.every(n=>n.visible===!active));}
// Presentation now keeps the physical vessel readable at all five berths.
// Recorded segment count is unchanged; screen travel is shorter than v65.
for(const g of gs){
 const w=g.cell*5+g.gap*4,h=g.cell*3;let prev=-Infinity;
 for(let n=0;n<=5;n++){
  const p=maxBoatPlacement(w,h,n,1600/960);
  assert(p.x>prev);prev=p.x;
  assert(p.x-p.width/2>=0&&p.x+p.width/2<=w,'boat visible throughout anticipation and braking');
 }
 const p=maxBoatPlacement(w,h,23,1600/960);assert(p.x-p.width/2>w,'weighted exit fully clears stage');
}
for(const [a,b]of [['anticipate','advance'],['advance','settle'],['settle','rest'],['anticipate','escape']]){
 const end=boatPerformance(a,1),start=boatPerformance(b,0);
 for(const key of Object.keys(end))assert(Math.abs(end[key]-start[key])<1e-9,`${a} → ${b} ${key} continuous`);
}
assert(MAX_ANTICIPATE_MS[4]>MAX_ANTICIPATE_MS[3]);
for(const speed of ['normal','turbo','super'])assert(maxBeatDuration(280,speed,140)*{normal:1,turbo:.55,super:.32}[speed]>=140);
let runs=0,resizes=0,skips=0;
const cases=[];
for(const [outcome,draw]of [['early',.8],['late',.06],['full',.01]])for(const speed of ['normal','turbo','super'])for(const reduced of [false,true])for(let vi=0;vi<4;vi++)for(const target of reduced?['result']:['anticipate','advance','settle',outcome==='full'?'transfer':'escape'])for(const change of ['none','resize','skip']){
 const event=runReelFeature('getaway',1000,()=>draw,vi===2?12345000:25000000).free[0].mechanic;
 const r=event.reel,record=JSON.stringify(event),host=new EventTarget();host.dataset={};
 let g=gs[vi],live=true,ctl,paid=0,credits=0,bank=0,dom=[],changed=false,lastPhase='',phases=[],beats=[],duration=0;
 const reactions=[];host.addEventListener('kilo-stage-action',ev=>{assert(live,'no reaction after Skip');reactions.push(ev.detail.kind);});
 const world=new Container();
 globalThis.document={body:{appendChild:n=>dom.push(n)},createElement:()=>({style:{},offsetHeight:28,remove(){dom=dom.filter(x=>x!==this);}})};
 const inspect=()=>{
  const phase=dom.length?'transfer':host.dataset.maxPhase;
  if(phase!==lastPhase){phases.push(phase);lastPhase=phase;}
  let boats=0;const visit=n=>{assert.notEqual(n.label,'getaway-asset-fallback');if(n.label==='getaway-stopped-boat'||n.label==='getaway-physical-vessel')boats++;
   if(!r.won&&n instanceof Text&&n.visible!==false)assert.notEqual(n.text,'MAX WIN');
   if(dom.length&&n instanceof Text&&n.visible!==false)assert.notEqual(n.text,Math.round(r.result.credited).toLocaleString('en-US'),'stationary amount hidden during transfer');n.children.forEach(visit);};visit(world);
  assert(boats<=1,'one vessel only, including result and transfer');
  if(host.dataset.maxSegment)assert(Number(host.dataset.maxSegment)<=r.reveal.segments);
  const matches=reduced?phase==='settled':phase===target;
  if(!changed&&matches&&change!=='none'){
   changed=true;if(change==='resize'){g=gs[(vi+1)%gs.length];host.dispatchEvent(new Event('kilo-relayout'));resizes++;}
   else{live=false;ctl.cancel();skips++;}
  }
 };
 ctl=createReelFeatureEffects({host,world,geom:()=>g,cell:()=>{throw Error('Max cannot create a symbol');},show(){},stake:()=>1000,pace:()=>({speed,reduced}),live:()=>live,
  collect:async()=>{throw Error('Max cannot collect');},highlight:async()=>{throw Error('Max cannot highlight');},readout(){},screen:(x,y)=>({x,y}),landing:()=>({x:g.dw/2,y:g.dh+30}),
  bankCue(){assert.equal(dom.length,0);bank++;},cue(){assert(live);},
  hold:async ms=>{duration+=ms;inspect();},tween:async(ms,paint)=>{duration+=ms;let phase='';for(const t of [0,.1,.25,.5,.75,.95,1]){paint(t);phase=host.dataset.maxPhase;inspect();}beats.push({phase,ms});}});
 ctl.set(event,'before');await ctl.step(event,{award:n=>{assert(live);paid+=n;credits++;},state(){}});
 assert.equal(JSON.stringify(event),record);assert.equal(dom.length,0);assert(credits<=1&&bank===credits);
 if(change==='skip')assert(changed,`${target} interrupted`);
 if(live){assert.equal(paid,event.credited);assert.equal(credits,r.won?1:0);}
 ctl.set(event,'after');host.dispatchEvent(new Event('kilo-relayout'));
 const all=[];const walk=n=>{all.push(n);n.children.forEach(walk);};walk(world);
 assert.equal(all.filter(n=>n.label==='getaway-stopped-boat').length,r.won?1:0);
 assert.equal(all.filter(n=>n.label==='getaway-no-win').length,r.won?0:1);
 if(change==='none'&&!reduced){
  assert.deepEqual(reactions,r.won?['max','max-stop']:['max'],'one entry reaction and a stop reaction only on a completed win');
  const anticipation=beats.filter(b=>b.phase==='anticipate');assert.equal(anticipation.length,r.reveal.segments+(r.won?0:1));assert(anticipation.every(b=>b.ms>=140));
  cases.push({outcome,speed,viewport:sizes[vi],duration,phases,beats,credited:paid});
 }
 ctl.set(null);ctl.destroy();assert.equal(world.children.length,0);runs++;
}
fs.writeFileSync('art/kilo-v66/verification.json',JSON.stringify({checkpoint,method:'Frozen source/asset hashes; source-derived stage geometry; production effect controller with instrumented Pixi. Not browser/GPU.',frozenFiles:frozen,runs,resizes,skips,viewports:sizes,cases},null,2)+'\n');
console.log(`PASS ${frozen} frozen files; ${runs} Max cases, ${resizes} resizes, ${skips} Skip cases; continuous physical beats and fully visible vessel staging.`);
