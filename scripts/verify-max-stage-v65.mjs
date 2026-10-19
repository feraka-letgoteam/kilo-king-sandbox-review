import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
import {loadProduction} from './kilo-v56-test-loader.mjs';
import {Container,Text} from './reel-renderer-mocks-v52.mjs';
const checkpoint='f0197e7';
const old=f=>execFileSync('git',['show',`${checkpoint}:${f}`],{encoding:'utf8'});
const read=f=>fs.readFileSync(f,'utf8');
const allowed=new Set(['ReelStage.tsx','director.ts','max-boat-performance.ts','max-boat-rig.ts','max-spin-motion.ts','max-stage-visibility.ts','max-stage-surface.ts','pixiStage.ts','play.tsx','reel-feature-effects.ts'].map(n=>'src/components/kilo/'+n));
const files=execFileSync('git',['ls-tree','-r','--name-only',checkpoint,'src','public'],{encoding:'utf8'}).trim().split('\n');
let frozen=0;
for(const f of files)if(!allowed.has(f)){
 assert.equal(execFileSync('git',['hash-object',f],{encoding:'utf8'}).trim(),execFileSync('git',['rev-parse',`${checkpoint}:${f}`],{encoding:'utf8'}).trim(),'frozen '+f);frozen++;
}
const once=(source,before,after='')=>{assert.equal(source.split(before).length,2,'one exact presentation change '+before.slice(0,60));return source.replace(before,after);};
assert.equal(once(read('src/components/kilo/play.tsx')," boatStage={environmentId === 'max-win'}"),old('src/components/kilo/play.tsx'));
assert.equal(once(read('src/components/kilo/director.ts'),'  setBoatStage?(active: boolean): void;\n'),old('src/components/kilo/director.ts'));
let stage=read('src/components/kilo/pixiStage.ts');
stage=once(stage,"import { setMaxStageVisibility } from './max-stage-visibility';\n");
stage=once(stage,"import { paintMaxStageSurface } from './max-stage-surface';\n");
stage=once(stage,`
  // Hide the interior, not the stage camera or frame. The existing Max marina
  // stays around the performance aperture. Repaint/Skip/resize can
  // update the board model without exposing a symbol in this mode.
  const reelInterior = [cabinet, well, veil, routes, ...reels.map(r => r.root), fx, lineArt, locks];
  const maxWater = new Graphics();maxWater.label = 'getaway-stage-water';
  world.addChildAt(maxWater, world.children.indexOf(frame));
  let boatStage = host.dataset.boatStage === 'true';
  setMaxStageVisibility(reelInterior, boatStage);
  maxWater.visible = boatStage;
`);
stage=once(stage,'    paintMaxStageSurface(maxWater, geom);\n');
stage=once(stage,`    setBoatStage(active) {
      boatStage = active;
      setMaxStageVisibility(reelInterior, active);
      maxWater.visible = active;
      host.setAttribute('aria-label', active ? 'Kilo King Getaway boat stage' : 'Kilo King reels');
    },
`);
assert.equal(stage,old('src/components/kilo/pixiStage.ts'),'all other renderer and geometry code frozen');
function declaration(source,name){const tree=ts.createSourceFile('x.ts',source,ts.ScriptTarget.Latest,true);let found;const walk=n=>{if(ts.isFunctionDeclaration(n)&&n.name?.getText(tree)===name)found=n.getText(tree);ts.forEachChild(n,walk);};walk(tree);assert(found,name);return found;}
const effects=read('src/components/kilo/reel-feature-effects.ts'),previous=old('src/components/kilo/reel-feature-effects.ts');
const normalizeEffects=(s,isNew)=>{
 s=s.replace(/^import \{ MAX_BOAT_URL.*$/m,'/* Max timing imports */');
 for(const n of ['getaway','paintMaxBoat'])s=s.replace(declaration(s,n),`/* Max ${n} */`);
 if(isNew){s=s.replace(declaration(s,'paintMaxLoss'),'');
 s=once(s,'const transfer = async (award: Award, refresh?: () => void, origin?: () => { x: number; y: number })','const transfer = async (award: Award, refresh?: () => void)');
 s=once(s,'start=origin?.() ?? a.screen','start=a.screen');
 s=once(s,'if(won)await transfer(award,()=>{drawResult(1);value.visible=false;},()=>a.screen(value.position.x,value.position.y));','if(won)await transfer(award,()=>drawResult(1));');
 s=once(s,'    else if (settledBinary) paintMaxLoss(held);\n');
 s=once(s,'          // The one stopped vessel is retained in `held`, including resize.','          if(won)paintMaxBoat(panel,5,false);');
 s=once(s,"        else { a.cue?.('getawayLoss'); await readable(400); if(live())a.readout('Max spins','No win'); }","        else { await resultPlate(r.result,false); a.readout('Max spins','No win'); }");}
 return s.split('\n').map(l=>l.trimEnd()).filter(l=>l.trim()).join('\n');
};
assert.equal(normalizeEffects(effects,true),normalizeEffects(previous,false),'all non-Max effect code and shared transfer frozen');
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
// Position increments are exactly one of the five original reel-width segments.
for(const g of gs)for(let n=1;n<=5;n++){
 const w=g.cell*5+g.gap*4,h=g.cell*3,a=maxBoatPlacement(w,h,n-1,1600/960),b=maxBoatPlacement(w,h,n,1600/960);
 assert(Math.abs(b.x-a.x-w/5)<1e-9);
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
  const anticipation=beats.filter(b=>b.phase==='anticipate');assert.equal(anticipation.length,r.reveal.segments+(r.won?0:1));assert(anticipation.every(b=>b.ms>=140));
  cases.push({outcome,speed,viewport:sizes[vi],duration,phases,beats,credited:paid});
 }
 ctl.set(null);ctl.destroy();assert.equal(world.children.length,0);runs++;
}
fs.writeFileSync('art/kilo-v65/verification.json',JSON.stringify({checkpoint,method:'Frozen source/asset hashes; source-derived stage geometry; production effect controller with instrumented Pixi. Not browser/GPU.',frozenFiles:frozen,runs,resizes,skips,viewports:sizes,cases},null,2)+'\n');
console.log(`PASS ${frozen} frozen files; ${runs} Max cases, ${resizes} resizes, ${skips} Skip cases; continuous physical beats and exact one-width advances.`);
