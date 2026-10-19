import {tmpdir} from 'node:os';
/** Executes extracted production stage + director methods; rasterizes their
 * display list. Offline Canvas proof, not browser/WebGL/full control UI. */
import fs from 'node:fs';
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
import * as P from './reel-renderer-mocks-v52.mjs';
import {loadProduction} from './kilo-v56-test-loader.mjs';
import {createCanvas,textureImage,drawNode,allMasks} from './offline-pixi-painter.mjs';
const stage=fs.readFileSync('src/components/kilo/pixiStage.ts','utf8'),director=fs.readFileSync('src/components/kilo/director.ts','utf8');
function decl(src,name){const tree=ts.createSourceFile('x.ts',src,ts.ScriptTarget.Latest,true);let found;const walk=n=>{if((ts.isFunctionDeclaration(n)||ts.isMethodDeclaration(n))&&n.name?.getText(tree)===name)found=n.getText(tree);ts.forEachChild(n,walk);};walk(tree);if(!found)throw Error(name);return found.replace(/^export /,'');}
const js=s=>ts.transpile(s,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS});
for(const key of ['x','y'])Object.defineProperty(P.Container.prototype,key,{get(){return this.position[key];},set(v){this.position[key]=v;},configurable:true});
P.Graphics.prototype.closePath=function(){return this;};
const metric=createCanvas(1,1).getContext('2d');
Object.defineProperty(P.Text.prototype,'width',{get(){metric.font=`700 ${this.style.fontSize}px "Source Sans 3"`;return metric.measureText(String(this.text)).width;}});
const fit=new Function(js(['edgeFor','frameBorders','fitReels'].map(n=>decl(stage,n)).join('\n'))+';return fitReels;')();
const {fitGameLayout}=loadProduction('src/components/kilo/layout.ts');
const readouts=loadProduction('src/components/kilo/presentation-readout.ts');
const fish=loadProduction('src/components/kilo/fish-art.ts');
const art=loadProduction('src/components/kilo/art-map.ts');
const motion=loadProduction('src/components/kilo/motion-atlas.ts');
const {AUTHORED_CLIPS}=loadProduction('src/components/kilo/authored-clips.ts');
const {authoredFrameAt}=loadProduction('src/components/kilo/authored-animation.ts');
const {collectMult,meterLevel,LEVEL_MULT,PAYLINES}=loadProduction('src/lib/kilo/engine.ts');
const {SPIN_TIMING}=loadProduction('src/components/kilo/control-model.ts');
const tex=async url=>{const im=await textureImage(url);return{source:{url,width:im.width,height:im.height},width:im.width,height:im.height};};
const textures={};for(const [key,file]of Object.entries(art.ART))textures[key]=await tex(art.ART_ROOT+file);
const packageTextures={};for(const [key,row]of Object.entries(fish.PACKAGE_META))packageTextures[key]=await tex(fish.CONTRABAND_ROOT+row.file);
const collectorSheet=await tex(motion.MOTION_ROOT+motion.collectorAtlas.image);
const crop=(sheet,f)=>({source:sheet.source,frame:{x:f.x,y:f.y,width:f.w,height:f.h},width:f.w,height:f.h});
const collectorFrames=motion.collectorAtlas.frames.map(f=>crop(collectorSheet,f));
const authoredTextures=new Map();for(const [key,clip]of Object.entries(AUTHORED_CLIPS))if(!key.startsWith('entry')&&!key.startsWith('actor')&&key!=='completion'){
 const sheet=await tex(clip.url);authoredTextures.set(key,{clip,frames:clip.frames.map(f=>crop(sheet,f))});
}
const plaqueTex=await tex(motion.MOTION_ROOT+'value-plaque.svg'),upgradeTex=await tex('/kilo-ui-v11/banner-upgrade.webp');
const declarations=['tween','holdReadable','playFishAck','playReaction','symbolSprite','restoreSymbols','paintAuthored','restoreAuthored','applyPlace','showReaction','cellView','cellCenter','playRetriggerArt','ceremony','authoredSymbolKey','burstWin'].map(n=>decl(stage,n)).join('\n');
const factory=new Function('deps',js(`
 const {Container,Sprite,Text,Graphics,textures,packageTextures,collectorFrames,plaqueTex,upgradeTex,authoredTextures,authoredFrameAt,
  PACKAGE_META,V8_META,SCATTER_KING,fishTier,fishReaction,collectorAtlas,reactionIndex,motionMs,SYMBOL_ALPHA,
  collectionHold,collectionType,collectorAmountLabels,stageReadoutLayout,collectMult,meterLevel,LEVEL_MULT,PAYLINES,SPIN_TIMING,symbolWinPose}=deps;
 const scatterTex=textures.bars,TEXT='Source Sans 3',DISPLAY='Barlow Condensed',modalTex=upgradeTex,entryTex=upgradeTex;
 let {geom,stake}=deps,turbo=false,reduced=false,speedMode='normal',job=0,stopped=false,destroyed=false,animating=false,resizeFollow=false;
 let board=deps.spin.grid,meterWilds=0,readoutActive=false;
 const readout={hidden:true};
 const waits=new Set(),reactionRefresh=new Set(),flyers=new Set(),authoredHomes=new WeakMap();
 const host=new EventTarget();host.dataset={};host.closest=()=>({querySelector:()=>({classList:{add(){},remove(){}}})});
 const world=new Container(),transient=new Container(),fx=new Graphics(),lineArt=new Container(),title=new Text({text:'',style:{fontSize:14}});
 const reels=Array.from({length:5},()=>({strip:new Container()}));reels.forEach(r=>world.addChild(r.strip));world.addChild(fx,lineArt,transient);
 const performance={now:deps.now},requestAnimationFrame=deps.raf,cancelAnimationFrame=deps.cancel;
 const window={setTimeout:deps.timer,clearTimeout:deps.cancel},document=deps.document;
 const money=n=>Math.round(n).toLocaleString('en-US'),lineSum=lines=>lines.reduce((n,l)=>n+l.pay,0);
 const mark=p=>{host.dataset.phase=p;},phaseTarget=()=>host;
 const endMotion=()=>{animating=false;},ensureType=async()=>{},bonusEnter=()=>{},winSting=tier=>deps.cue(tier===0?'winSmall':tier===1?'winMid':'winBig');
 const screenOf=deps.screen,bonusLanding=deps.landing,domCenter=deps.socket;
 const showReadout=(label,value)=>{readoutActive=true;deps.readout(label,value);};
 const clearPresentation=()=>{readoutActive=false;deps.readout(null,null);fx.clear();};
 const collectionCue=deps.collectionCue;
 const frameBorders=()=>({b:10});
 ${decl(director,'collectionShares')}
 ${decl(director,'winningCells')}
 const portions=collectionShares;
 ${declarations}
 const paintStanding=()=>{reels.forEach(r=>r.strip.removeChildren().forEach(c=>c.destroy()));board.forEach((col,reel)=>{reels[reel].strip.position.set(geom.gx+reel*(geom.cell+geom.gap),geom.gy);col.forEach((c,row)=>{const v=cellView(c,geom.cell);v.position.y=row*geom.cell;reels[reel].strip.addChild(v);});});};
 const scene={${['collect','deliverCollectors','retrigger','intro'].map(n=>decl(stage,n)).join(',')},
 setStake(n){stake=n;},setPace(t,r,s){turbo=t;reduced=r;speedMode=s;},setMood(){},setLocks(){},setTally(){},setCopy(){},setMeter(n){meterWilds=n;},show(grid){board=grid;paintStanding();},finishPlate(){}};
 const cue=deps.cue;
 ${['ledgerBefore','faceFor','holdFace','thresholdCrossed','announcementFace','resultPreview','hold','presentSettledCollection'].map(n=>decl(director,n)).join('\n')}
 paintStanding();
 return{scene,world,host,play:(round,index,opts)=>presentSettledCollection(scene,round,index,opts),burst:line=>burstWin(line),
 resize(g){geom=g;paintStanding();for(const f of reactionRefresh)f();host.dispatchEvent(new Event('kilo-relayout'));},
 snapshot:()=>({geom,animating,resizeFollow,readoutActive}),skip(){job++;stopped=true;for(const f of waits)f();waits.clear();transient.removeChildren().forEach(n=>n.destroy());}};
`));
const {symbolWinPose}=loadProduction('src/components/kilo/presentation-motion.ts');
const fixtures=JSON.parse(fs.readFileSync('src/lib/kilo/fixtures.json'));
const output='art/kilo-v62/proofs',temp=`${tmpdir()}/kilo-v62-collection-frames`;fs.mkdirSync(output,{recursive:true});fs.mkdirSync(temp,{recursive:true});
export {factory,fit,fitGameLayout,collectMult,meterLevel,LEVEL_MULT,PAYLINES,SPIN_TIMING,authoredFrameAt,authoredTextures,collectorFrames,textures,packageTextures,plaqueTex,upgradeTex,art,fish,motion,readouts,symbolWinPose,fixtures};
if(process.env.KILO_STAGE_HARNESS_ONLY!=='1')
for(const [id,index] of [['tool-bazooka',15],['capped-ante',25]])for(const [vw,vh]of [[1440,900],[390,844]]){
 const name=`collection-${id==='tool-bazooka'?'48000':'capped'}-${vw}x${vh}`,round=fixtures[id].script,spin=round.free[index];
 const pad=vw<900?12:24,l=fitGameLayout(vw-pad*2,vh-pad*2),g=fit(Math.round(l.reelWidth),Math.round(l.reelHeight));
 const ox=(vw-g.dw)/2,oy=vw<900?140:138,canvas=createCanvas(vw,vh),c=canvas.getContext('2d');
 let phaseAt=0,lastPhase='';
 let now=0,next=0,queue=new Map(),frame=0,dom=[],readout=null,hud={},banked=0,complete=false,error;
 const cues=[],events=[],targets=new Set();
 const schedule=(cb,delay)=>{const id=++next;queue.set(id,{at:now+delay,cb});return id;};
 const label=(text,x,y,size=14,color='#fff8e9')=>{c.font=`700 ${size}px "Source Sans 3"`;c.fillStyle=color;c.textAlign='center';c.textBaseline='middle';c.fillText(String(text),x,y);};
 const doc={hidden:false,body:{appendChild:el=>dom.push(el)},createElement:tag=>({tag,style:{},offsetHeight:44,remove(){dom=dom.filter(x=>x!==this);}})};
 const bonusY=oy+g.dh+85;
 const h=factory({...P,...art,...fish,...motion,...readouts,textures,packageTextures,collectorFrames,plaqueTex,upgradeTex,authoredTextures,authoredFrameAt,collectMult,meterLevel,LEVEL_MULT,PAYLINES,SPIN_TIMING,symbolWinPose,
  geom:g,stake:round.stake,spin,now:()=>now,raf:cb=>schedule(()=>cb(now),1000/60),timer:schedule,cancel:id=>queue.delete(id),document:doc,
  screen:(x,y)=>({x:x+ox,y:y+oy}),landing:()=>({x:vw/2,y:bonusY-44-16,numberTop:bonusY-22}),socket:sel=>({x:vw/2-60+Number(sel.match(/\d+/)?.[0]??0)*40,y:oy-24}),
  readout:(a,b)=>{readout=a===null?null:{label:a,value:b};if(a!==null)events.push({ms:now,label:a,value:b});},
  collectionCue:d=>{if(d?.phase==='bank'){banked=d.completed;events.push({ms:now,banked});}},cue:name=>cues.push({name,ms:now})});
 const save=async()=>{
  c.fillStyle='#06131b';c.fillRect(0,0,vw,vh);label('KILO KING · COLLECTION',vw/2,35,vw<900?20:27,'#e2bd77');
  label(`${vw} × ${vh} · normal speed`,vw/2,64,14,'#adc6c7');
  for(let i=0;i<4;i++){c.fillStyle=i<(hud.filled??0)?'#ad8c4f':'#10232c';c.beginPath();c.arc(vw/2-60+i*40,oy-24,12,0,Math.PI*2);c.fill();}
  c.fillStyle='#020c12';c.fillRect(ox+g.cab.x,oy+g.cab.y,g.cab.w,g.cab.h);c.strokeStyle='#a7864d';c.lineWidth=2;c.strokeRect(ox+g.cab.x,oy+g.cab.y,g.cab.w,g.cab.h);
  c.save();c.translate(ox,oy);await drawNode(c,h.world,allMasks(h.world));c.restore();
  if(readout&&h.snapshot().readoutActive){const r=readouts.stageReadoutLayout(g);const a=readout.label,b=readout.value;c.font=`700 ${r.labelSize}px "Source Sans 3"`;const aw=c.measureText(a).width;c.font=`700 ${r.amountSize}px "Source Sans 3"`;const bw=c.measureText(b).width;
   const left=ox+r.x+(r.width-aw-bw-12)/2;label(a,left+aw/2,oy+r.y+r.height/2,r.labelSize,'#b6d8d7');label(b,left+aw+12+bw/2,oy+r.y+r.height/2,r.amountSize);
  }
  label('BONUS WIN · this collection',vw/2,bonusY-28,14,'#a6c6c7');label(banked.toLocaleString('en-US'),vw/2,bonusY,27);
  for(const el of dom){if(!el.style.left)continue;c.globalAlpha=Number(el.style.opacity??1);const x=parseFloat(el.style.left),y=parseFloat(el.style.top);
   if(el.tag==='img'){const im=await textureImage(el.src);c.drawImage(im,x-22,y-22,44,44);}else label(el.textContent,x,y,Number.parseFloat(el.style.fontSize??'24'),'#fff4cf');c.globalAlpha=1;
  }
  label(hud.note??'',vw/2,bonusY+45,vw<900?13:17,'#e2bd77');
  label('Offline production stage + director render',vw/2,vh-42,12,'#8fa7ad');label('Header / meter harness · no wallet writes',vw/2,vh-24,12,'#8fa7ad');
  const file=`${temp}/${name}-${String(frame++).padStart(4,'0')}.png`;fs.writeFileSync(file,await canvas.encode('png'));
  const phase=h.host.dataset.phase;if(phase!==lastPhase){lastPhase=phase;phaseAt=now;}
  const active=h.snapshot().readoutActive;
  const snap=phase==='upgrade'&&now-phaseAt>220?'retrigger':dom.some(el=>el.tag!=='img')?'transfer':active&&readout?.value==='24,000'?'subtotal':active&&readout?.value==='48,000'?'combined':null;
  if(snap&&!targets.has(snap)){targets.add(snap);fs.copyFileSync(file,`${output}/${name}-${snap}.png`);}
 };
 h.play(round,index,{turbo:false,reduced:false,speed:'normal',skipped:()=>false,onHud:v=>hud=v}).then(()=>complete=true).catch(e=>{error=e;complete=true;});
 let tail=0;while(!complete||tail<600){for(let n=0;n<12;n++)await Promise.resolve();if(error)throw error;
  const due=[...queue.entries()].filter(([,q])=>q.at<=now+.01).sort((a,b)=>a[1].at-b[1].at);for(const [id,q]of due){queue.delete(id);q.cb();}
  for(let n=0;n<12;n++)await Promise.resolve();await save();now+=1000/60;if(complete)tail+=1000/60;if(now>30000)throw Error('stalled');
 }
 fs.writeFileSync(`${output}/${name}-timeline.json`,JSON.stringify({durationMs:now,viewport:[vw,vh],id,index,got:spin.got,events,cues},null,2)+'\n');
 execFileSync('python',['scripts/mix-performance-proof-v62.py',`${output}/${name}-timeline.json`,`${temp}/${name}.wav`]);
 execFileSync('ffmpeg',['-v','error','-y','-framerate','60','-i',`${temp}/${name}-%04d.png`,'-i',`${temp}/${name}.wav`,'-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart',`${output}/${name}.mp4`]);
 for(const file of fs.readdirSync(temp))if(file.startsWith(name+'-')&&file.endsWith('.png'))fs.unlinkSync(`${temp}/${file}`);
 console.log(`${name}: ${frame} frames; ${banked} single collection transfer`);
}
