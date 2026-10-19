import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {loadProduction} from './kilo-v56-test-loader.mjs';
const {canActivateMax,isMaxSpinRound}=loadProduction('src/components/kilo/max-spin-mode.ts');
assert(canActivateMax(1000,1000000));
assert(!canActivateMax(1000,999999));assert(!canActivateMax(2500,100000000));
assert(!canActivateMax(1000,1000000,true));assert(!canActivateMax(1000,1000000,false,true));
assert(isMaxSpinRound({version:4,feature:'getaway'}));assert(!isMaxSpinRound({version:3,feature:'getaway'}));

// Execute the actual purchase component's confirmation closure with React hooks.
let hooks=[],cursor=0,activated=0,bought=0;
const react={useState(initial){const i=cursor++;hooks[i]??={value:initial};return[hooks[i].value,v=>{hooks[i].value=v;}];},useRef(initial){const i=cursor++;return hooks[i]??(hooks[i]={current:initial});},useContext(){return null;}};
globalThis.requestAnimationFrame=fn=>fn();
const file='src/components/kilo/feature-takeover.tsx',module={};
const compiled=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const require=id=>id==='react'?react:id==='react/jsx-runtime'?{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}:id==='lucide-react'?{}:id==='./control-panels'?{PanelDismissContext:{}}:id.endsWith('.css')?{}:loadProduction(id.startsWith('@/')?'src/'+id.slice(2):path.join(path.dirname(file),id));
new Function('require','exports',compiled)(require,module);
const props={stake:1000,bank:10000000,ante:false,locked:false,onAnte(){},onEditBet(){},onStake(){},onClose(){},onBuy(){bought++;},onMaxMode(active){if(active)activated++;}};
const render=(extra={})=>{cursor=0;return module.FeatureTakeover({...props,...extra}).props;};
render().onView('getaway');render().onConfirm();render().onConfirm();
assert.equal(activated,1,'activation is explicit and deduplicated');assert.equal(bought,0,'activation cannot call purchase or charge');
for(const extra of [{bank:0},{locked:true},{anteOnly:true},{stake:2500}]){hooks=[];render(extra).onView('getaway');render(extra).onConfirm();assert.equal(activated,1,'invalid activation blocked');}
hooks=[];render().onView('buy');render().onConfirm();render().onConfirm();assert.equal(bought,1,'ordinary purchase confirmation remains single-submit');

// Exercise actual selectMaxMode and paid play declarations with wallet spies.
const source=fs.readFileSync('src/components/kilo/play.tsx','utf8'),tree=ts.createSourceFile('play.tsx',source,ts.ScriptTarget.Latest,true);
function declaration(name){let value;const walk=n=>{if(ts.isFunctionDeclaration(n)&&n.name?.getText(tree)===name)value=n.getText(tree);ts.forEachChild(n,walk);};walk(tree);assert(value,name);return value;}
function bind(name,context){return new Function(...Object.keys(context),ts.transpile(declaration(name),{target:ts.ScriptTarget.ES2022})+`;return ${name};`)(...Object.values(context));}
let balance=5000000,mode='spin',debits=0,outcomes=0,credits=0,saved=0,runCount=0;
const scene={setFeatureState(){},setMood(){},finishPlate(){}},busyRef={current:false};
const select=bind('selectMaxMode',{busyRef,summary:null,autoRunner:{current:null},stake:1000,readBank:()=>balance,ready:true,jurisdiction:{},canActivateMax,setMode:v=>mode=v,setBuyPanel(){},setHud(){},sceneRef:{current:scene}});
select(true);assert.equal(mode,'getaway');assert.equal(balance,5000000);assert.equal(debits,0);assert.equal(outcomes,0);
const {splashStakeOk,splashCost,isPurchaseMode}=loadProduction('src/lib/kilo/engine.ts');
for(let n=0;n<2;n++){
 const play=bind('play',{mode,busyRef,sceneRef:{current:scene},ready:true,summary:null,jurisdiction:{},stake:1000,isPurchaseMode,splashStakeOk,splashCost,
  playSplash(stake,kind){outcomes++;assert.equal(kind,'getaway');return{mode:kind,cost:splashCost(stake,kind),payout:0};},cryptoRng:()=>()=>.5,
  settle(cost){debits++;assert.equal(cost,1000000);balance-=cost;return{ok:true};},setBank(){},readBank:()=>balance,setNote(){},setSummary(){},rememberRound(){saved++;},creditRef:{current:null},
  async run(script,review){assert.equal(review,false);runCount++;credits+=script.payout;return true;},featureSummary:()=>({feature:true})});
 await play();
}
assert.equal(outcomes,2);assert.equal(debits,2);assert.equal(saved,2);assert.equal(runCount,2);assert.equal(balance,3000000);assert.equal(credits,0);
select(false);assert.equal(mode,'spin');assert.equal(balance,3000000,'exit never charges');
busyRef.current=true;select(true);assert.equal(mode,'spin','cannot activate during a spin');

// Max vehicle begins while its one recorded reel spin is still in flight.
globalThis.window={setTimeout,matchMedia:()=>({matches:true})};
globalThis.fetch=async()=>({ok:true,json:async()=>({sprites:{}})});
const {presentReelFeature}=loadProduction('src/components/kilo/reel-feature-director.ts');
const rounds=JSON.parse(fs.readFileSync('art/kilo-features-v54/replay-examples.json'));
let sequences=0;
for(const key of ['getaway-max','getaway-loss'])for(const speed of ['normal','turbo','super'])for(const reduced of [false,true]){
 const round=rounds[key];let spins=0,intros=0,paid=0,settled=false,resolveSpin,hud;
 const scene={setStake(){},setPace(){},setFeatureState(){},setCopy(){},setMeter(){},setTally(){},setLocks(){},setMood(){},finishPlate(){},show(){},featureIntro:async()=>{intros++;},
  spinTo(){spins++;return new Promise(resolve=>{resolveSpin=()=>{settled=true;resolve();};});},
  async reelFeatureStep(e,cb){assert(!settled,'boat starts before reels have settled');assert(cb.reelsSettled instanceof Promise);resolveSpin();await cb.reelsSettled;assert(settled);cb.award(e.credited);paid+=e.credited;}};
 await presentReelFeature(scene,round,{turbo:speed!=='normal',speed,reduced,skipped:()=>false,onHud:h=>{assert.equal(h.active,false,'Max never becomes a free-spin HUD');hud=h;}});
 assert.equal(spins,1);assert.equal(intros,0);assert.equal(paid,round.payout);assert.equal(hud.total,round.payout);sequences++;
}
fs.writeFileSync('art/kilo-v58/max-mode-verification.json',JSON.stringify({method:'Actual component confirmation closure, extracted production paid-play/activation functions with wallet spies, and real director deferred-spin sequences. No live browser claims.',activationCharged:0,explicitPaidSpins:2,paidDebits:debits,perSpinCost:1000000,exitCharged:0,deduplicatedConfirm:true,invalidActivationBlocked:true,concurrentPresentationCases:sequences,oddsAndMathUnchanged:true},null,2)+'\n');
console.log(`PASS Max activation/exit charge zero, two explicit paid spins, duplicate/invalid guards and ${sequences} concurrent one-spin result sequences.`);
