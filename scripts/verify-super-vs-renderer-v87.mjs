import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {sourceFingerprint} from './v79-source-fingerprint.mjs';
const fingerprint=sourceFingerprint();
import {createOfflineRuntime,findAll,walk} from './offline-runtime-v79.mjs';
const current=createOfflineRuntime(),baseline=null,checkpoint='f50afc1';
const {runReelFeatureCandidate}=current.load('src/lib/kilo/reel-feature-math.ts');
const {vsSeeded}=current.load('src/lib/kilo/vs-progression.ts');
const record=JSON.parse(fs.readFileSync('public/kilo-v86/replays/super-yacht-mystery.json'));
const fixtures={1:record.free[0].mechanic};
for(const spin of record.free)if(spin.mechanic.reel.conversions.length){
 const group=spin.mechanic.reel.groupsAfter.find(g=>g.reels.includes(0)&&g.width>1);
 if(group&&!fixtures[group.width])fixtures[group.width]=spin.mechanic;
}
assert(Object.keys(fixtures).length>=2,'Opening plus genuine ×25 group expansion');
const viewports=[[1440,900],[390,844],[360,800],[844,390]],fit=current.load('src/components/kilo/layout.ts').fitGameLayout;
function declaration(source,name){const tree=ts.createSourceFile('x.ts',source,ts.ScriptTarget.Latest,true);let result;const scan=n=>{if(ts.isFunctionDeclaration(n)&&n.name?.getText(tree)===name)result=n.getText(tree);ts.forEachChild(n,scan);};scan(tree);return result;}
const source=fs.readFileSync('src/components/kilo/pixiStage.ts','utf8');
const fitReels=new Function(ts.transpile(['edgeFor','frameBorders','fitReels'].map(n=>declaration(source,n)).join('\n'),{target:ts.ScriptTarget.ES2022})+';return fitReels;')();
const geometries=viewports.map(([w,h])=>{const p=w<900?12:24,l=fit(w-p*2,h-p*2);return fitReels(Math.round(l.reelWidth),Math.round(l.reelHeight));});
const scene=await current.load('src/components/kilo/pixiStage.ts').mountScene(current.host(1000,600));await current.tick(0);scene.destroy();
async function execute(runtime,event,{speed='normal',reduced=false,viewport=0,change='none',target=''}={}){
 // Global document belongs to the active runtime because production transfer
 // elements are genuine callbacks of this instrumented source execution.
 const active=runtime===baseline?createOfflineRuntime({checkpoint}):createOfflineRuntime();
 active.window.innerWidth=viewports[viewport][0];active.window.innerHeight=viewports[viewport][1];
 for(const[url,texture]of runtime.textures)active.textures.set(url,texture);
 const {createReelFeatureEffects}=active.load('src/components/kilo/reel-feature-effects.ts');
 const world=new active.pixi.Container(),host=active.host(1000,600);let g=geometries[viewport],ctl,live=true,elapsed=0,paid=0,phase='start',changed=false,hidden=[],observations=0,pulses=0;const cues=[],credits=[],banks=[],conceal=[],phases=[];
 const inspect=()=>{observations++;if(host.dataset.maxPhase)phase=host.dataset.maxPhase;
  else if(findAll(world,'vs-group-merge').length)phase='merge';
  walk(world,n=>{for(const p of[n.position,n.pivot,n.scale])assert(Number.isFinite(p.x)&&Number.isFinite(p.y),'finite transform');assert(Number.isFinite(n.rotation),'finite rotation');if(n instanceof active.pixi.Text)assert(!String(n.text).includes('NaN'),'finite text');});
  for(const group of findAll(world,'vs-group-art')){assert(group.vsGroup.reels.every(r=>hidden.includes(r)),'all group symbol strips concealed');assert(!group.children.some(n=>n.label==='vs-group-multiplier-plaque'),'no detached multiplier plaque');const composition=group.children.find(n=>n.label===`vs-${group.vsGroup.side}-${group.vsGroup.width}-composition`);assert(composition?.texture.source.url===active.load('src/components/kilo/vs-group-art.ts').vsGroupArtUrl(group.vsGroup),'dedicated composition loaded, not stretched fallback');for(const n of group.children.filter(n=>n.label==='vs-group-multiplier')){assert(n.style.fontFamily&&Number(n.style.fontWeight)>=600,'Readable bold multiplier');assert(n.width<=group.vsGroup.width*g.cell+(group.vsGroup.width-1)*g.gap+1,'product fits group');if(n.scale.x>1.01)pulses++;if(runtime!==baseline&&phase==='transfer')assert.equal(n.alpha,1,'Locked multiplier remains visible during transfer');}}
  if(runtime!==baseline)for(const amount of findAll(world,'vs-line-award'))assert(amount.children.every(n=>n instanceof active.pixi.Text),'VS award contains direct ink only, no UI plate');
  for(const el of active.document.body.children){if(el.className!=='kk-feature-transfer'||!el.style.left)continue;assert(Number.isFinite(parseFloat(el.style.left)));assert(Number.isFinite(parseFloat(el.style.top)));assert(Number(el.style.opacity??1)>=0&&Number(el.style.opacity??1)<=1);}
  if(!changed&&change!=='none'&&(phase===target||target==='any')){changed=true;if(change==='resize'){g=geometries[(viewport+1)%4];host.dispatchEvent(new Event('kilo-relayout'));}else{live=false;ctl.cancel();}}
 };
 const a={host,world,geom:()=>g,cell:()=>new active.pixi.Container(),stake:()=>1000,pace:()=>({speed,reduced}),live:()=>live,show(){},collect:async()=>{throw Error('Pure VS/God cannot collect');},highlight:async()=>{throw Error('Pure VS/God owns its win sequence');},readout(){},screen:(x,y)=>({x,y}),landing:()=>({x:g.dw/2,y:g.dh+35}),focus(){},conceal:indices=>{hidden=[...indices];conceal.push({ms:elapsed,reels:[...indices]});},cue:name=>{phase=({vsReady:'duel',vsLock:'lock',vsConnect:'connection',vsAmount:'amount',vsTransfer:'transfer'})[name]??phase;cues.push({name,ms:elapsed});},bankCue:(value,capped)=>{assert(live);assert.equal(active.document.body.children.length,0,'traveller removed before bank');banks.push({value,capped,ms:elapsed});},hold:async ms=>{elapsed+=ms;inspect();},tween:async(ms,paint)=>{const prior=elapsed;for(const t of[0,.07,.16,.25,.4,.55,.7,.85,.95,1]){elapsed=prior+ms*t;paint(t);inspect();}elapsed=prior+ms;}};
 ctl=createReelFeatureEffects(a);ctl.set(event,'before');const frozen=JSON.stringify(event);await ctl.step(event,{award:value=>{assert(live);paid+=value;credits.push({value,ms:elapsed});},state(){}});assert.equal(JSON.stringify(event),frozen,'record never mutated');assert.equal(active.document.body.children.length,0);
 if(live){assert.equal(paid,event.credited,'exact recorded credit');assert.equal(credits.length,banks.length,'one meter update per bank');assert.deepEqual(credits.map(c=>c.value),banks.map(c=>c.value));}
 if(change!=='none')assert(changed,`Expected ${change} at ${target}`);
 ctl.set(event,'after');host.dispatchEvent(new Event('kilo-relayout'));ctl.destroy();assert.equal(world.children.length,0);
 return{elapsed,paid,cues,credits,banks,observations,pulses,changed,concealCalls:conceal.length,phases};
}

const results=[];
for(const [width,event]of Object.entries(fixtures))for(const speed of ['normal','turbo','super'])for(const reduced of [false,true])for(const viewport of [0,1]){
 const result=await execute(current,event,{speed,reduced,viewport});
 assert.equal(result.credits.length,event.credited>0?1:0,'One board award, one bank');
 results.push({width,speed,reduced,viewport,ms:result.elapsed,paid:result.paid,banks:result.banks.length});
}
const winning=Object.values(fixtures).find(e=>e.credited>0&&e.reel.groupsAfter.some(g=>g.width>1));
for(const speed of ['normal','turbo','super'])for(const change of ['resize','skip'])for(const target of ['duel','merge','connection','transfer']){
 const result=await execute(current,winning,{speed,viewport:1,change,target});results.push({speed,change,target,paid:result.paid,ms:result.elapsed});
}
fs.mkdirSync('art/kilo-v86/verification',{recursive:true});fs.writeFileSync('art/kilo-v87/verification/presentation.json',JSON.stringify({sourceFingerprint:fingerprint,method:'Production feature controller with instrumented Pixi, real cancel/relayout paths; not browser/WebGL.',results},null,2)+'\n');
console.log(`PASS ${results.length} VS normal/turbo/super/reduced/Skip/resize cases`);
