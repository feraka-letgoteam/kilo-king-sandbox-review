import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
import {loadProduction} from './kilo-v56-test-loader.mjs';
import {Container,Text} from './reel-renderer-mocks-v52.mjs';
import {seeded} from './analyze-feature-pacing-v60.mjs';
import {withoutV64BackgroundRouting} from './kilo-v64-source-guards.mjs';
const checkpoint='794e886';
const {runReelFeature}=loadProduction('src/lib/kilo/reel-feature-math.ts');
const {vsWinningConnections}=loadProduction('src/components/kilo/vs-encounter.ts');
const {createReelFeatureEffects}=loadProduction('src/components/kilo/reel-feature-effects.ts');
const {fitGameLayout}=loadProduction('src/components/kilo/layout.ts');
const out='art/kilo-v63';fs.mkdirSync(out,{recursive:true});
// Freeze the actual generator, payment boundaries, controls and collection.
const protectedFiles=['src/lib/kilo/engine.ts','src/lib/kilo/reel-feature-math.ts','src/lib/kilo/feature-math.ts','src/lib/kilo/bank.ts','src/lib/kilo/max-spin-reveal.ts',
 'src/components/kilo/director.ts','src/components/kilo/reel-feature-director.ts','src/components/kilo/layout.ts',
 'src/components/kilo/brand-layout.ts','src/components/kilo/feature-motion.ts',
 'src/components/kilo/art-map.ts','src/components/kilo/fish-art.ts','src/components/slot-controls/SlotControls.tsx','src/components/slot-controls/layout.ts',
 'src/components/slot-controls/controls.css','src/components/slot-controls/tokens.ts','src/components/kilo/modular-controls.css'];
for(const file of protectedFiles)assert.equal(fs.readFileSync(file,'utf8'),execFileSync('git',['show',`${checkpoint}:${file}`],{encoding:'utf8'}),`protected ${file}`);
function declaration(source,name){const tree=ts.createSourceFile('module.ts',source,ts.ScriptTarget.Latest,true);let found;const visit=n=>{if(ts.isFunctionDeclaration(n)&&n.name?.getText(tree)===name)found=n.getText(tree);ts.forEachChild(n,visit);};visit(tree);assert(found,name);return found;}
const play=withoutV64BackgroundRouting(fs.readFileSync('src/components/kilo/play.tsx','utf8')),oldPlay=execFileSync('git',['show',`${checkpoint}:src/components/kilo/play.tsx`],{encoding:'utf8'});
for(const name of ['run','credit','spin','playPreview','playPair']){
 // Function names are deliberately resolved from the existing source.
 if(name==='spin'&&!play.includes('function spin('))continue;
 assert.equal(declaration(play,name),declaration(oldPlay,name),`protected UI ${name}`);
}
const stage=fs.readFileSync('src/components/kilo/pixiStage.ts','utf8');
const effects=fs.readFileSync('src/components/kilo/reel-feature-effects.ts','utf8');
const oldEffects=execFileSync('git',['show',`${checkpoint}:src/components/kilo/reel-feature-effects.ts`],{encoding:'utf8'});
for(const name of ['intro','paintMaxBoat','tumble','paintWild','paintHeld','set','cancel'])assert.equal(declaration(effects,name),declaration(oldEffects,name),`unrelated/persistent presentation ${name}`);
const chopperStart='      // Chopper: short flight across the board';
assert.equal(effects.slice(effects.indexOf(chopperStart),effects.indexOf('  function paintMaxBoat')),oldEffects.slice(oldEffects.indexOf(chopperStart),oldEffects.indexOf('  function paintMaxBoat')),'Chopper sequence unchanged');
const oldStage=execFileSync('git',['show',`${checkpoint}:src/components/kilo/pixiStage.ts`],{encoding:'utf8'});
const stripActorEvents=s=>s.split('\n').filter(l=>!l.includes("host.dispatchEvent(new CustomEvent('kilo-stage-action'")).join('\n');
assert.equal(stripActorEvents(stage),stripActorEvents(oldStage),'entire reel stage unchanged except two presentation events');
const fitReels=new Function(ts.transpile(['edgeFor','frameBorders','fitReels'].map(n=>declaration(stage,n)).join('\n'),{target:ts.ScriptTarget.ES2022})+';return fitReels;')();
const sizes=[[1440,900],[390,844],[360,800],[844,390]];
const geometries=sizes.map(([w,h])=>{const pad=w<900?12:24,l=fitGameLayout(w-pad*2,h-pad*2);return fitReels(Math.round(l.reelWidth),Math.round(l.reelHeight));});
const example=JSON.parse(fs.readFileSync('art/kilo-v61/encounter.json'));
assert.deepEqual(example.spin,runReelFeature('yacht',example.stake,seeded(example.seed),18000000).free[example.index],'proof is an unedited v60 event');
const replay=JSON.parse(fs.readFileSync('public/kilo-features-v54/replays/vs-complete-encounter-v61.json'));
assert.deepEqual(replay.free,runReelFeature('yacht',1000,seeded(132),18000000).free,'review uses the complete recorded feature');
const cases={hero:example.spin.mechanic};
for(let seed=1;seed<=250;seed++)for(const spin of runReelFeature('yacht',1000,seeded(seed),18000000).free){
 const e=spin.mechanic,r=e.reel;
 if(r.conversions.some(v=>v.duelist==='vice'))cases.vice??=e;
 if(r.conversions.some(v=>v.duel.kingMultiplier===v.duel.viceMultiplier))cases.equal??=e;
 if(r.conversions.length&&!r.lines.length)cases.noWin??=e;
 if(!r.conversions.length&&r.lines.length>1)cases.stickyMultiLine??=e;
 if(r.conversions.length>1)cases.multiDuel??=e;
}
cases.capped=runReelFeature('yacht',1000,seeded(1),17).free.find(s=>s.got>0).mechanic;
cases.longAmount=runReelFeature('yacht',100000,seeded(1),1800000000).free.find(s=>s.got>0).mechanic;
assert(cases.vice&&cases.equal&&cases.noWin&&cases.stickyMultiLine&&cases.multiDuel);
let runs=0,resizes=0,interruptions=0,credits=0;const results=[];
for(const [name,e]of Object.entries(cases))for(const speed of ['normal','turbo','super'])for(const reduced of [false,true])for(let gi=0;gi<4;gi++){
 for(const change of ['none','resize-action','resize-lock','resize-line','resize-amount','resize-transfer','skip-action','skip-line','skip-transfer']){
  let g=geometries[gi],live=true,paid=0,dom=[],phase='action',changed=false,ctl,bankPending=false;
  const world=new Container(),host=new EventTarget(),cues=[],calls=[];
  globalThis.document={body:{appendChild:n=>dom.push(n)},createElement:()=>({style:{},offsetHeight:28,setAttribute(){},remove(){dom=dom.filter(x=>x!==this);}})};
  const mutate=()=>{
   if(changed||!change.endsWith('-'+phase))return;
   changed=true;
   if(change.startsWith('resize')){g=geometries[(gi+1)%4];host.dispatchEvent(new Event('kilo-relayout'));resizes++;}
   else{live=false;ctl.cancel();interruptions++;}
  };
  const inspect=node=>{for(const p of [node.position,node.scale,node.pivot])assert(Number.isFinite(p.x)&&Number.isFinite(p.y));if(node instanceof Text)assert(!String(node.text).includes('NaN'));node.children.forEach(inspect);};
  const a={host,world,geom:()=>g,cell:()=>new Container(),stake:()=>name==='longAmount'?100000:1000,pace:()=>({speed,reduced}),live:()=>live,
   show(){},readout(){throw Error('VS plaque must not duplicate its amount in a detached readout');},screen:(x,y)=>({x,y}),landing:()=>({x:g.dw/2,y:g.dh+30}),focus(){},
   collect:async()=>{throw Error('Pure VS must not collect cargo');},highlight:async()=>{throw Error('Pure VS must use its encounter win path');},
   cue:n=>{cues.push(n);if(n==='vsReady')phase='action';if(n==='vsLock')phase='lock';if(n==='vsConnect')phase='line';if(n==='vsAmount')phase='amount';if(n==='vsTransfer')phase='transfer';},
   bankCue:(v,capped)=>{assert(live);assert.equal(dom.length,0,'flyer removed before meter changes');bankPending=true;calls.push({value:v,capped});},
   tween:async(ms,draw)=>{assert(ms<=1480);for(const t of [0,.24,.36,.49,.60,.72,.82,.94,1]){draw(t);inspect(world);mutate();for(const el of dom){assert(Number.isFinite(parseFloat(el.style.left)));assert(Number.isFinite(parseFloat(el.style.top)));assert(Number(el.style.opacity)>=0&&Number(el.style.opacity)<=1);}}},
   hold:async()=>{inspect(world);mutate();},
  };
  ctl=createReelFeatureEffects(a);ctl.set(e,'before');const frozen=JSON.stringify(e);
  await ctl.step(e,{award:v=>{assert(live);assert(bankPending,'credit must follow bank cue');bankPending=false;paid+=v;credits++;assert(paid<=e.credited);},state:s=>assert(s.reel.after.length<=e.reel.after.length)});
  assert.equal(JSON.stringify(e),frozen,'record immutable');assert.equal(dom.length,0);assert.equal(bankPending,false);
  if(live){
   assert.equal(paid,e.credited,'one complete recorded award');
   assert.deepEqual(calls.map(c=>c.value),e.reel.lines.map(l=>l.pay),'line order and exact cap credits preserved');
   for(const n of ['vsReady','vsLock'])assert.equal(cues.filter(c=>c===n).length,e.reel.conversions.length,`${n} once per duel`);
   for(const n of ['vsPull','vsImpact'])assert.equal(cues.filter(c=>c===n).length,reduced?0:e.reel.conversions.length);
   for(const n of ['vsConnect','vsAmount','vsBank'])assert.equal(cues.filter(c=>c===n).length,e.reel.lines.length,`${n} once per line`);
   assert.equal(cues.filter(c=>c==='vsTransfer').length,reduced?0:e.reel.lines.length);
   const expected=vsWinningConnections(e.reel,a.stake());assert.deepEqual(calls.map(c=>c.capped),expected.map(c=>c.credited<c.beforeCap));
  }
  ctl.set(e,'after');host.dispatchEvent(new Event('kilo-relayout'));const locked=JSON.stringify(world.children[0].children[0],(key,value)=>key==='parent'?undefined:value);
  host.dispatchEvent(new Event('kilo-relayout'));assert.equal(JSON.stringify(world.children[0].children[0],(key,value)=>key==='parent'?undefined:value),locked,'settled multiplier does not drift');
  ctl.destroy();assert.equal(world.children.length,0);runs++;
 }
}
// Validated the numeric expression independently across more recorded lines.
let lines=0;for(let seed=1;seed<=1000;seed++)for(const spin of runReelFeature('yacht',1000,seeded(seed),18000000).free){
 for(const c of vsWinningConnections(spin.mechanic.reel,1000)){assert(c.beforeCap>=c.credited);assert.equal(c.credited,c.line.pay);assert(c.spots.every(p=>p.reel<c.line.n));lines++;}
}
const report={checkpoint,method:'Actual production controller with instrumented Pixi, real viewport geometry, recorded outcomes and explicit source guards. Not browser or GPU.',cases:Object.keys(cases),runs,resizes,interruptions,credits,expressionLines:lines,viewports:sizes,protectedFiles};
fs.writeFileSync(`${out}/encounter-verification.json`,JSON.stringify(report,null,2)+'\n');
console.log(`PASS ${runs} VS encounter cases; ${resizes} phase-specific resizes; ${interruptions} interruptions; ${lines} recorded line expressions.`);
