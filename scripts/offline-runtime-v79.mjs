/** Source-executed renderer test environment. It is not browser/WebGL evidence. */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
const baselineCache=new Map();
function readCheckpoint(checkpoint,file){const key=checkpoint+':'+file;if(!baselineCache.has(key))baselineCache.set(key,execFileSync('/usr/bin/git',['show',key],{encoding:'utf8',maxBuffer:16*1024*1024}));return baselineCache.get(key);}
import {imageMetadata} from './offline-image-metadata-v77.mjs';
import {createRequire} from 'node:module';
import * as base from './reel-renderer-mocks-v52.mjs';
import {createCanvas,textureImage,drawNode,allMasks} from './offline-pixi-painter.mjs';
const require=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'package.json'):import.meta.url);
const sourceRequire=createRequire(import.meta.url);
const {GlobalFonts}=require('@napi-rs/canvas');
GlobalFonts.registerFromPath('public/kilo-ui-v11/fonts/SourceSans3-600.woff2','VS Display');
GlobalFonts.registerFromPath('public/kilo-ui-v11/KiloDisplay.woff','Kilo Win');
const metrics=createCanvas(1,1).getContext('2d');
// Pixi initializes every transform rotation to zero. Without this default the
// offline double produced NaN when symbol responses added a small rotation.
base.Container.prototype.rotation=0;
// Pixi Sprite dimensions are a view of its transform and texture, not an
// unrelated _width. Mesh companions must inherit the same physical scale.
for(const [dimension,axis]of [['width','x'],['height','y']])Object.defineProperty(base.Sprite.prototype,dimension,{
 get(){return Math.abs(this.scale[axis])*(this.texture?.[dimension]??this.texture?.frame?.[dimension]??this.texture?.source?.[dimension]??1);},
 set(value){const size=this.texture?.[dimension]??this.texture?.frame?.[dimension]??this.texture?.source?.[dimension]??1;this.scale[axis]=(Math.sign(this.scale[axis])||1)*value/size;},configurable:true,
});
Object.defineProperty(base.Text.prototype,'width',{get(){metrics.font=`${this.style.fontWeight??700} ${this.style.fontSize}px "${['VS Display','Kilo Win'].includes(this.style.fontFamily)?this.style.fontFamily:'Source Sans 3'}"`;return metrics.measureText(String(this.text)).width;}});
for(const [key,axis]of [['x','x'],['y','y']])Object.defineProperty(base.Container.prototype,key,{get(){return this.position[axis];},set(value){this.position[axis]=value;},configurable:true});
base.Container.prototype.removeChild=function(node){this.children=this.children.filter(n=>n!==node);node.parent=null;return node;};
// Pixi moves an existing child when addChild is called again. Hook reseating
// relies on this; the old test double duplicated the seated views instead.
base.Container.prototype.addChild=function(...nodes){for(const node of nodes){node.parent?.removeChild(node);this.children.push(node);node.parent=this;}return nodes[0];};
base.Container.prototype.addChildAt=function(node,index){node.parent?.removeChild(node);this.children.splice(index,0,node);node.parent=this;return node;};
base.Container.prototype.toGlobal=function(p){let point={...p},node=this;while(node){const x=(point.x-node.pivot.x)*node.scale.x,y=(point.y-node.pivot.y)*node.scale.y,a=node.rotation??0;point={x:Math.cos(a)*x-Math.sin(a)*y+node.x,y:Math.sin(a)*x+Math.cos(a)*y+node.y};node=node.parent;}return point;};
base.Container.prototype.getLocalBounds=function(){return{x:0,y:0,width:this.width,height:this.height};};
base.Container.prototype.on=function(){return this;};base.Container.prototype.off=function(){return this;};
class Element extends EventTarget{
 constructor(tag='div'){super();this.tagName=tag.toUpperCase();this.style={};this.dataset={};this.children=[];this.attrs={};this.clientWidth=100;this.clientHeight=30;this.offsetHeight=30;this.hidden=false;this.textContent='';}
 appendChild(node){this.children.push(node);node.parentNode=this;return node;}append(...nodes){nodes.forEach(n=>this.appendChild(n));}
 remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}hasAttribute(k){return k in this.attrs;}closest(selector){return this._closest?.(selector)??null;}
 getBoundingClientRect(){return this._rect??{left:0,top:0,width:this.clientWidth,height:this.clientHeight,right:this.clientWidth,bottom:this.clientHeight};}
 querySelector(selector){return this._query?.(selector)??null;}
 get offsetHeight(){if(this.className==='kk-feature-transfer')return Math.round(parseFloat(this.style.fontSize??'')||Math.max(20,Math.min(32,(globalThis.window?.innerWidth??1440)*.03)));return this._offsetHeight??30;}
 set offsetHeight(value){this._offsetHeight=value;}
}
export function createOfflineRuntime({checkpoint=null,moduleOverrides={}}={}){
 if(checkpoint&&!/^[a-f0-9]{7,40}$/.test(checkpoint))throw Error('Checkpoint must be a Git commit hash');
 const cache=new Map(),textures=new Map(),apps=[],resizeObservers=[];let clock=0,nextId=0,raf=new Map(),timers=new Map();
 const document=new Element('document');document.body=new Element('body');document.hidden=false;document.fonts={load:async()=>[],ready:Promise.resolve()};document.createElement=tag=>new Element(tag);
 const window=new Element('window');Object.assign(window,{devicePixelRatio:1,innerWidth:1440,innerHeight:900,setTimeout:(fn,delay=0)=>{const id=++nextId;timers.set(id,{fn,at:clock+delay});return id;},clearTimeout:id=>timers.delete(id),matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})});
 Object.assign(globalThis,{document,window,HTMLElement:Element,requestAnimationFrame:fn=>{const id=++nextId;raf.set(id,fn);return id;},cancelAnimationFrame:id=>raf.delete(id),ResizeObserver:class{constructor(fn){this.fn=fn;resizeObservers.push(this);}observe(target){this.target=target;}disconnect(){this.target=null;}},CustomEvent:class extends Event{constructor(type,options={}){super(type,options);this.detail=options.detail;}},performance:{now:()=>clock}});
 class TilingSprite extends base.Sprite{constructor(options){super(options.texture);this.width=options.width;this.height=options.height;this.tileScale={x:1,y:1,set(x,y=x){this.x=x;this.y=y;}};}}
 class Texture extends base.Texture{get width(){return this.frame?.width??this.source?.width??1;}get height(){return this.frame?.height??this.source?.height??1;}}
 class MeshSimple extends base.Container{
  constructor({texture,vertices,uvs,indices}){super();Object.assign(this,{texture,vertices,uvs,indices,_offlineMesh:true});this.geometry={destroy(){}};}
 }
 class Application{constructor(){this.stage=new base.Container();this.canvas=new Element('canvas');this.ticker={add(){},remove(){}};apps.push(this);}async init(options){this.host=options.resizeTo;this.screen={width:this.host.clientWidth,height:this.host.clientHeight};this.canvas._rect=this.host.getBoundingClientRect();}destroy(){this.stage.destroy();}renderer={extract:{}};}
 const pixi={...base,Texture,MeshSimple,TilingSprite,Application,BlurFilter:class{},Assets:{get:url=>textures.get(url),load:async url=>{if(!textures.has(url))textures.set(url,imageMetadata(url));return textures.get(url);}}};
 function load(filename){let full=path.resolve(filename);if(!/\.(tsx?|json)$/.test(full)){const suffix=['.ts','.tsx','.json'].find(ext=>fs.existsSync(full+ext));if(suffix)full+=suffix;}if(cache.has(full))return cache.get(full);const relative=path.relative(process.cwd(),full);const source=checkpoint?readCheckpoint(checkpoint,relative):fs.readFileSync(full,'utf8');if(full.endsWith('.json'))return JSON.parse(source);const result={};cache.set(full,result);const js=ts.transpileModule(source,{fileName:full,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText;const localRequire=id=>Object.prototype.hasOwnProperty.call(moduleOverrides,id)?moduleOverrides[id]:id.endsWith('.css')?{}:id==='pixi.js'?pixi:id.startsWith('@/')?load(path.join('src',id.slice(2))):id.startsWith('.')?load(path.join(path.dirname(full),id)):sourceRequire(id);new Function('require','exports',js)(localRequire,result);return result;}
 async function tick(ms=1000/60){clock+=ms;const callbacks=[...raf.values()];raf.clear();for(const fn of callbacks)fn(clock);for(const[id,t]of[...timers])if(t.at<=clock){timers.delete(id);t.fn();}for(let n=0;n<8;n++)await Promise.resolve();}
 async function drive(promise,{step=1000/60,onFrame=()=>{},maxMs=60000}={}){let done=false,error,result;promise.then(v=>{done=true;result=v;},e=>{done=true;error=e;});const start=clock;while(!done&&clock-start<maxMs){await tick(step);await onFrame(clock-start);}if(error)throw error;if(!done)throw Error(`Offline timeline exceeded ${maxMs}ms`);return result;}
 function host(width,height,left=0,top=0,win={x:left+width/2-70,y:top+height+18,w:140,h:60}){const h=new Element();h.clientWidth=width;h.clientHeight=height;h._rect={left,top,width,height,right:left+width,bottom:top+height};const app=new Element();app._query=selector=>{if(!selector.includes('bonus-win'))return null;const e=new Element();e._rect={left:win.x,top:selector.includes('data-testid')?win.y+20:win.y,width:win.w,height:selector.includes('data-testid')?30:win.h,bottom:win.y+win.h,right:win.x+win.w};return e;};h._closest=selector=>selector==='.kk-app'?app:selector.includes('reel-host')?h:null;return h;}
 function resize(host,width,height){host.clientWidth=width;host.clientHeight=height;Object.assign(host._rect,{width,height,right:host._rect.left+width,bottom:host._rect.top+height});for(const app of apps)if(app.host===host){app.screen={width,height};app.canvas._rect=host._rect;}for(const obs of resizeObservers)if(obs.target===host)obs.fn();}
 return{load,pixi,apps,document,window,host,tick,drive,resize,get clock(){return clock;},textures};
}
export function walk(root,fn){fn(root);for(const child of root.children)walk(child,fn);}
export function findAll(root,label){const result=[];walk(root,n=>{if(n.label===label)result.push(n);});return result;}
export {createCanvas,textureImage,drawNode,allMasks,Element};
