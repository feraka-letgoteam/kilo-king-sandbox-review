/** Real decoder and React component execution with deterministic effects.
 * No synthetic character injection: inspect the component's actual JSX tree.
 * This is not a browser paint, layout or GPU test. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createOfflineRuntime} from './offline-runtime-v79.mjs';
import {imageMetadata} from './offline-image-metadata-v77.mjs';
const checkpoint='7fc3e57';
async function probe(baseline=false) {
 const hooks=[],pending=[];let cursor=0;
 const effect=(fn,deps=[])=>{const i=cursor++,prev=hooks[i];if(!prev||deps.length!==prev.deps.length||deps.some((v,n)=>v!==prev.deps[n]))pending.push(()=>{prev?.cleanup?.();hooks[i]={deps,cleanup:fn()};});};
 const react={useRef(value){const i=cursor++;return hooks[i]??(hooks[i]={current:value});},
   useState(value){const i=cursor++;hooks[i]??={value:typeof value==='function'?value():value};return[hooks[i].value,v=>{hooks[i].value=typeof v==='function'?v(hooks[i].value):v;}];},
   useId(){cursor++;return 'test-scene';},useEffect:effect,useLayoutEffect:effect,
   useMemo(fn,deps){const i=cursor++,prev=hooks[i];if(!prev||deps.some((v,n)=>v!==prev.deps[n]))hooks[i]={deps,value:fn()};return hooks[i].value;}};
 const r=createOfflineRuntime({checkpoint:baseline?checkpoint:null,moduleOverrides:{react}});
 let imageLoads=0;
 globalThis.Image=class {decode(){return Promise.resolve();}set src(url){this.url=url;imageLoads++;const m=imageMetadata(url).source;this.complete=true;this.naturalWidth=m.width;this.naturalHeight=m.height;queueMicrotask(()=>this.onload?.());}get src(){return this.url;}};
 const scene=r.load('src/components/kilo/IntegratedScene.tsx');
 const loading=await scene.preloadIntegratedScene('loading'),base=await scene.preloadIntegratedScene('base');
 const {fitGameLayout}=r.load('src/components/kilo/layout.ts');
 const nodes=[];const walk=node=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(walk);return;}nodes.push(node);walk(node.props?.children);};
 async function render(mode,portrait=false,settings={}) {
  const layout=fitGameLayout(portrait?366:1392,portrait?820:852);
  const props={scene:mode,layout,reducedMotion:false,paused:false,characterPaused:false,...settings};
  let tree;
  for(let i=0;i<4;i++) {cursor=0;tree=scene.IntegratedScene(props);pending.splice(0).forEach(f=>f());for(let j=0;j<20;j++)await Promise.resolve();}
  nodes.length=0;walk(tree);const actors=nodes.filter(n=>n.type?.name==='RiggedSceneActor');
  return {mode,portrait,actorCount:actors.length,actorProps:actors.map(n=>({portrait:n.props.portrait,paused:n.props.paused,reduced:n.props.reduced})),scene:tree.props['data-scene']};
 }
 const rows=[];
 for(const portrait of [false,true])for(const mode of ['base','scatter-3','scatter-4','max-win','completion','base'])rows.push(await render(mode,portrait));
 if(!baseline) {
  assert.equal(base.scene,'base');assert.equal(loading.scene,'loading');assert.equal(base.image,loading.image,'one image decoded for shared art, independent identity');
  for(const row of rows)assert.equal(row.actorCount,1,`${row.mode}: exactly one actor at ${row.portrait?'phone':'desktop'}`);
  const paused=await render('base',true,{characterPaused:true});assert.equal(paused.actorProps[0].paused,true);
  const reduced=await render('base',true,{reducedMotion:true});assert.equal(reduced.actorProps[0].reduced,true);
  assert.equal((await render('loading')).actorCount,0,'Loading screen has no stage actor');
 }
 hooks.forEach(h=>h?.cleanup?.());delete globalThis.Image;
 return {cacheResult:base.scene,imageLoads,rows};
}
const before=await probe(true),after=await probe(false);
assert.equal(before.cacheResult,'loading','Checkpoint reproduces poisoned scene identity');
assert.equal(before.rows[0].actorCount,0,'Checkpoint reproduces missing base character');
fs.mkdirSync('art/kilo-v84/verification',{recursive:true});
fs.writeFileSync('art/kilo-v84/verification/stage-mount-verification.json',JSON.stringify({method:'Actual decoder + IntegratedScene JSX/effect execution; mock image decoder and effect scheduler. Not browser paint.',checkpoint,before,after},null,2)+'\n');
console.log('PASS: historical failure reproduced; v84 mounts exactly one actor in every playing mode, at both sizes. Shared-art scene identity, reduced motion and pause forwarding verified.');
