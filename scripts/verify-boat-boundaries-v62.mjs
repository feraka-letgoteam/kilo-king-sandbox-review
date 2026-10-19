import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {loadProduction,cropCounts} from './kilo-v56-test-loader.mjs';
import {Container,Text} from './reel-renderer-mocks-v52.mjs';
const {createReelFeatureEffects}=loadProduction('src/components/kilo/reel-feature-effects.ts');
const {runReelFeature}=loadProduction('src/lib/kilo/reel-feature-math.ts');
const {boatPerformance}=loadProduction('src/components/kilo/max-boat-performance.ts');
const {fitGameLayout}=loadProduction('src/components/kilo/layout.ts');
const src=fs.readFileSync('src/components/kilo/pixiStage.ts','utf8'),tree=ts.createSourceFile('x.ts',src,ts.ScriptTarget.Latest,true),f={};
const find=n=>{if(ts.isFunctionDeclaration(n)&&['edgeFor','frameBorders','fitReels'].includes(n.name?.getText(tree)))f[n.name.getText(tree)]=n.getText(tree);ts.forEachChild(n,find);};find(tree);
const fit=new Function(ts.transpile(Object.values(f).join('\n'),{target:ts.ScriptTarget.ES2022})+';return fitReels;')();
const views=[[1440,900],[390,844],[360,800],[844,390]],gs=views.map(([w,h])=>{const p=w<900?12:24,l=fitGameLayout(w-p*2,h-p*2);return fit(Math.round(l.reelWidth),Math.round(l.reelHeight));});
for(const beat of ['advance','settle','escape','rest'])for(let i=0;i<=100;i++)assert(Object.values(boatPerformance(beat,i/100)).every(Number.isFinite));
const rest=boatPerformance('rest',1),end=boatPerformance('settle',1);for(const key of Object.keys(rest))assert(rest[key]===end[key],'brake ends at the precise static pose, without residual wake');
let runs=0,resizes=0,skips=0;
for(const [outcome,draw]of [['early',.8],['late',.06],['full',.01]])for(const speed of ['normal','turbo','super'])for(let vi=0;vi<4;vi++)for(const target of ['advance','settle',outcome==='full'?'transfer':'escape'])for(const mode of ['resize','skip']){
 const e=runReelFeature('getaway',1000,()=>draw,25000000).free[0].mechanic,r=e.reel;
 let g=gs[vi],ctl,live=true,changed=false,paid=0,dom=[];
 const host=new EventTarget();host.dataset={};const world=new Container(),cues=[];
 globalThis.document={body:{appendChild:n=>dom.push(n)},createElement:()=>({style:{},offsetHeight:28,remove(){dom=dom.filter(x=>x!==this);}})};
 const inspect=()=>{const visit=n=>{assert.notEqual(n.label,'getaway-asset-fallback','all runtime layers loaded');if(!r.won&&n instanceof Text&&n.visible!==false&&n.alpha>0)assert.notEqual(n.text,'MAX WIN');n.children.forEach(visit);};visit(world);if(host.dataset.maxSegment)assert(Number(host.dataset.maxSegment)<=r.reveal.segments,'loss must never reveal extra gates');};
 const alter=()=>{const phase=dom.length?'transfer':host.dataset.maxPhase;if(!changed&&phase===target){changed=true;if(mode==='resize'){g=gs[(vi+1)%4];host.dispatchEvent(new Event('kilo-relayout'));resizes++;}else{live=false;ctl.cancel();skips++;}}};
 ctl=createReelFeatureEffects({host,world,geom:()=>g,cell:()=>new Container(),show(){},collect:async()=>{},highlight:async()=>{},stake:()=>1000,pace:()=>({speed,reduced:false}),live:()=>live,
  readout(){},screen:(x,y)=>({x,y}),landing:()=>({x:g.dw/2,y:g.dh+30}),bankCue(){assert(live);assert.equal(dom.length,0);},cue:n=>{assert(live,'no cue after Skip');cues.push(n);},
  tween:async(ms,paint)=>{for(const t of [0,.25,.5,.75,1]){paint(t);inspect();alter();}},hold:async()=>{inspect();alter();}});
 ctl.set(e,'before');await ctl.step(e,{award:n=>{assert(live);paid+=n;},state(){}});
 assert(changed,`${outcome} ${target} exercised`);assert.equal(dom.length,0);assert.equal(paid,mode==='skip'?0:e.credited);
 if(mode==='resize'){assert.equal(cues.filter(n=>n==='boatBrake').length,r.won?1:0);assert.equal(cues.filter(n=>n==='boatPass').length,r.won?0:1);}
 ctl.destroy();assert.equal(world.children.length,0);runs++;
}
assert.equal(cropCounts.get('/kilo-v62/max/performance-parts.png'),5,'cropped frames are cached across resizes and repeated spins');
fs.writeFileSync('art/kilo-v62/boat-boundaries.json',JSON.stringify({runs,resizes,skips,viewports:views,checks:['all layers loaded','loss cannot flash MAX or reveal an additional segment','no cue after cancellation','brake returns to exact home','single credit after transfer cleanup']},null,2)+'\n');
console.log(`PASS ${runs} phase-specific boat cases, ${resizes} resizes and ${skips} interruptions.`);
