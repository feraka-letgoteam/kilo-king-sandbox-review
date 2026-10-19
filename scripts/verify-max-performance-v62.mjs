import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {loadProduction} from './kilo-v56-test-loader.mjs';
import {withoutV64BackgroundRouting} from './kilo-v64-source-guards.mjs';
import {Container,Sprite} from './reel-renderer-mocks-v52.mjs';
const checkpoint='245e7fb';
const {runReelFeature,REEL_FEATURE_PROFILE}=loadProduction('src/lib/kilo/reel-feature-math.ts');
const {maxRevealFromDraw,recordedMaxSegments}=loadProduction('src/lib/kilo/max-spin-reveal.ts');
const {maxStripAdvance,maxBoatPlacement,MAX_STOP_MOVE_MS,MAX_STOP_HOLD_MS}=loadProduction('src/components/kilo/max-spin-motion.ts');
const {createReelFeatureEffects}=loadProduction('src/components/kilo/reel-feature-effects.ts');
const {fitGameLayout}=loadProduction('src/components/kilo/layout.ts');
const {integratedSceneUrl}=loadProduction('src/components/kilo/integrated-scene-model.ts');
const old={};new Function('require','exports',ts.transpileModule(execFileSync('git',['show',`${checkpoint}:src/lib/kilo/reel-feature-math.ts`],{encoding:'utf8'}),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>loadProduction(path.join('src/lib/kilo',id)),old);
const seeded=seed=>{let state=seed>>>0,count=0;const rng=()=>{count++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};return{rng,count:()=>count};};
let equivalent=0;const counts=[0,0,0,0,0];
// v60 deliberately rebalances Yacht/Route; their new invariants and pacing
// gates live in verify-feature-pacing-v60.mjs. Max must remain byte-equivalent.
for(const kind of ['getaway'])for(let seed=1;seed<=10000;seed++){
 const a=seeded(seed),b=seeded(seed),stake=seed%3===0?10:1000,room=seed%13===0?stake*100:stake*25000;
 const before=old.runReelFeature(kind,stake,a.rng,room),after=runReelFeature(kind,stake,b.rng,room);
 assert.equal(a.count(),b.count(),'identical RNG draw consumption');
 const record=structuredClone(after);if(kind==='getaway'){const e=record.free[0].mechanic.reel;assert.equal(e.reveal.segments===5,e.won);counts[e.reveal.segments-1]++;delete e.reveal;}
 assert.deepEqual(record,before,'all grids, awards, costs and sequence metadata except the new stop match checkpoint');equivalent++;
}
assert(counts.every(n=>n>0));
for(const [draw,segments]of[[.8,1],[.3,2],[.12,3],[.06,4],[.01,5]])assert.equal(maxRevealFromDraw(draw,REEL_FEATURE_PROFILE.getawayWinChance).segments,segments);
assert.equal(recordedMaxSegments({won:false}),1,'legacy losses cannot invent a late stop');
assert.equal(recordedMaxSegments({won:true}),5);
const stage=fs.readFileSync('src/components/kilo/pixiStage.ts','utf8');
function functions(source,names){const tree=ts.createSourceFile('stage.ts',source,ts.ScriptTarget.Latest,true),out={};const walk=n=>{if(ts.isFunctionDeclaration(n)&&names.includes(n.name?.getText(tree)))out[n.name.getText(tree)]=n.getText(tree);ts.forEachChild(n,walk);};walk(tree);return out;}
const fit=new Function(ts.transpile(Object.values(functions(stage,['edgeFor','frameBorders','fitReels'])).join('\n'),{target:ts.ScriptTarget.ES2022})+';return fitReels;')();
const viewports=[[360,800],[390,844],[844,390],[1440,900]],geometries=viewports.map(([W,H])=>{const pad=W<900?12:24,l=fitGameLayout(W-pad*2,H-pad*2);return fit(Math.round(l.reelWidth),Math.round(l.reelHeight));});
const ink=JSON.parse(fs.readFileSync('public/kilo-v59/environment/manifest.json')).assets[2].ink.normalized;
const bounds=[];for(const [i,g]of geometries.entries()){
 const w=g.cell*5+4*g.gap,h=g.cell*3,p=maxBoatPlacement(w,h,5,1600/960);
 const b={left:p.x+p.width*(ink.left-.5),right:p.x+p.width*(ink.right-.5),top:p.y+p.height*(ink.top-.5),bottom:p.y+p.height*(ink.bottom-.5)};
 assert(b.left>=0&&b.right<=w&&b.top>=0&&b.bottom<h*.86,'entire boat clears frame and result line');
 let previous=0;for(let t=0;t<=1000;t++){const u=maxStripAdvance(t/1000);assert(u>=previous&&u<=1);previous=u;}
 bounds.push({viewport:viewports[i],board:{width:w,height:h},boatInk:b});
}
let runs=0,interruptions=0;const reports=[];
for(const reached of [1,2,3,4,5])for(const speed of ['normal','turbo','super'])for(const reduced of [false,true])for(let size=0;size<4;size++)for(const interrupt of [false,true]){
 const rng=()=>[.8,.3,.12,.06,.01][reached-1];const record=runReelFeature('getaway',1000,rng,reached===5&&size===3?12345000:25000000),event=record.free[0].mechanic;
 const world=new Container(),host=new EventTarget();host.dataset={};let g=geometries[size],live=true,paid=0,calls=0,dom=[],duration=0,ctl;
 const inspect=()=>{const walk=n=>{if(n instanceof Sprite){assert(n.texture);assert(Number.isFinite(n.position.x)&&Number.isFinite(n.position.y));}n.children.forEach(walk);};walk(world);};
 const mutate=()=>{calls++;g=geometries[(size+calls)%4];host.dispatchEvent(new Event('kilo-relayout'));inspect();if(interrupt&&calls===2){live=false;ctl.cancel();interruptions++;}};
 globalThis.document={body:{appendChild:n=>dom.push(n)},createElement:()=>({style:{},offsetHeight:28,remove(){dom=dom.filter(n=>n!==this);}})};
 ctl=createReelFeatureEffects({host,world,geom:()=>g,cell:()=>new Container(),show(){},stake:()=>1000,pace:()=>({speed,reduced}),live:()=>live,
 collect:async()=>{},highlight:async()=>{},readout(){},screen:(x,y)=>({x,y}),landing:()=>({x:180,y:400}),bankCue(){assert.equal(dom.length,0);},
 hold:async ms=>{duration+=ms;mutate();},tween:async(ms,draw)=>{duration+=ms;for(const t of [0,.25,.5,.75,1]){draw(t);mutate();}}
 });
 const frozen=JSON.stringify(event);ctl.set(event,'before');await ctl.step(event,{award:n=>{assert(live);paid+=n;},state(){}});
 assert.equal(JSON.stringify(event),frozen);assert.equal(dom.length,0);assert(paid<=event.credited);
 if(live){assert.equal(paid,event.credited);assert.equal(host.dataset.maxPhase,'settled');}
 ctl.set(event,'after');host.dispatchEvent(new Event('kilo-relayout'));
 let boat;const find=n=>{if(n.label==='getaway-stopped-boat')boat=n;n.children.forEach(find);};find(world);assert.equal(!!boat,reached===5,'only a full win retains the stopped vessel');
 const pose=maxBoatPlacement(g.cell*5+g.gap*4,g.cell*3,reached,1600/960);if(boat)assert.equal(boat.position.x,g.gx+pose.x-pose.width/2);
 ctl.set(null);assert.equal(world.children[0].children[0].children.length,0);ctl.destroy();assert.equal(world.children.length,0);
 if(!interrupt)reports.push({reached,speed,reduced,viewport:viewports[size],duration});runs++;
}
const protectedFiles=['src/lib/kilo/bank.ts','src/lib/kilo/engine.ts','src/lib/kilo/feature-math.ts','src/components/kilo/layout.ts','src/components/kilo/brand-layout.ts','src/components/kilo/brand-v55.css','src/components/slot-controls/layout.ts','src/components/slot-controls/tokens.ts','src/components/slot-controls/controls.css','src/components/slot-controls/SlotControls.tsx','src/components/kilo/modular-controls.css','src/components/kilo/fish-art.ts','src/components/kilo/art-map.ts'];
for(const file of protectedFiles)assert.equal(fs.readFileSync(file,'utf8'),execFileSync('git',['show',`${checkpoint}:${file}`],{encoding:'utf8'}),file);
const names=['tool','fitReels','highlight','bonusLanding'];assert.deepEqual(functions(stage,names),functions(execFileSync('git',['show',`${checkpoint}:src/components/kilo/pixiStage.ts`],{encoding:'utf8'}),names));
for(const portrait of [false,true])assert(integratedSceneUrl('max-win',portrait).startsWith('/kilo-v59/environment/getaway-'));
const play=withoutV64BackgroundRouting(fs.readFileSync('src/components/kilo/play.tsx','utf8'));assert(play.includes("? 'max-win' : reelFeature ? 'base'"));assert(!play.includes('environmentPhase === "entry" || reelFeature'),'feature no longer freezes character');
const outputDir=process.env.KILO_VERIFICATION_DIR??'art/kilo-v62';fs.mkdirSync(outputDir,{recursive:true});
fs.writeFileSync(`${outputDir}/contract-verification.json`,JSON.stringify({checkpoint,method:'Max production math equivalence; actual effect controller with instrumented display objects; source/alpha-bound measurements. Yacht/Route are intentionally recalibrated in v60 and checked separately. Not live browser or WebGL verification.',equivalent,stopCounts:counts,rendererRuns:runs,interruptions,bounds,protectedFiles,reports},null,2)+'\n');
console.log(`PASS ${equivalent} checkpoint-equivalent outcomes and RNG counts; ${runs} segmented-strip resize/Skip/speed cases; artwork bounds at four viewports.`);
