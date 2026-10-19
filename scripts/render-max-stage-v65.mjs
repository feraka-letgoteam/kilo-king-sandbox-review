import {tmpdir} from 'node:os';
/** Actual production effect controller, shipped assets, recorded v60 result,
 * and production reel geometry. Offline Canvas, NOT browser/WebGL evidence.
 * Readouts are a minimal harness, not a reimplementation of the React dock. */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {execFileSync,spawn} from 'node:child_process';
import {once} from 'node:events';
import {Container,Graphics,Sprite} from './reel-renderer-mocks-v52.mjs';
import {loadProduction} from './kilo-v56-test-loader.mjs';
import {createCanvas,textureImage,drawNode,allMasks} from './offline-pixi-painter.mjs';
const {createReelFeatureEffects}=loadProduction('src/components/kilo/reel-feature-effects.ts');
const {paintMaxStageSurface}=loadProduction('src/components/kilo/max-stage-surface.ts');
const {paintFeatureEnvironment}=loadProduction('src/components/kilo/feature-environment-painter.ts');
const {featureEnvironmentUrl}=loadProduction('src/components/kilo/feature-environments.ts');
const {ATMOSPHERE_URLS}=loadProduction('src/components/kilo/feature-atmosphere.ts');
const {integratedSceneCamera}=loadProduction('src/components/kilo/integrated-scene-model.ts');
const {sceneActorBox}=loadProduction('src/components/kilo/RiggedSceneActor.tsx');
const {STAGE_KING,stageKingFrameAt,paintStageKing}=loadProduction('src/components/kilo/stage-character-life.ts');
const actorImage=await textureImage(STAGE_KING.image),actor=createCanvas(768,1152),actorContext=actor.getContext('2d');
const atmosphere=Object.fromEntries(await Promise.all(Object.entries(ATMOSPHERE_URLS).map(async([k,url])=>[k,await textureImage(url)])));
const {fitGameLayout}=loadProduction('src/components/kilo/layout.ts');
const {createControlLayout}=loadProduction('src/components/slot-controls/layout.ts');
const {ART,ART_ROOT}=loadProduction('src/components/kilo/art-map.ts');
const source=fs.readFileSync('src/components/kilo/pixiStage.ts','utf8');
const tree=ts.createSourceFile('stage.ts',source,ts.ScriptTarget.Latest,true);
function declaration(name){let found;const visit=n=>{if(ts.isFunctionDeclaration(n)&&n.name?.getText(tree)===name)found=n.getText(tree);ts.forEachChild(n,visit);};visit(tree);if(!found)throw Error(name);return found;}
const fitReels=new Function(ts.transpile(['edgeFor','frameBorders','fitReels'].map(declaration).join('\n'),{target:ts.ScriptTarget.ES2022})+';return fitReels;')();
const seeded=seed=>{let state=seed>>>0;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};};
const {runReelFeature}=loadProduction('src/lib/kilo/reel-feature-math.ts');
const output='art/kilo-v65/proofs',temp=`${tmpdir()}/kilo-v65-max-audio`;
fs.mkdirSync(output,{recursive:true});fs.mkdirSync(temp,{recursive:true});
const art=new Map();for(const [key,file]of Object.entries(ART)){
 const url=path.posix.normalize(ART_ROOT+file),img=await textureImage(url);
 art.set(key,{source:{url,width:img.width,height:img.height},width:img.width,height:img.height});
}
const stages=[];
for(const [outcome,roll] of [['early-loss',.8],['late-loss',.06],['full-stop',.01]])for(const [vw,vh]of [[1440,900],[390,844]]){
 let round;for(let seed=1;seed<100000;seed++){const r=runReelFeature('getaway',1000,seeded(seed),25000000);if(r.free[0].mechanic.reel.reveal.segments===({'early-loss':1,'late-loss':4,'full-stop':5})[outcome]){round=r;break;}}if(!round)throw Error('missing sample');
 const example={spin:round.free[0],stake:1000,previousTotal:0};
 if(process.env.KILO_PROOF_OUTCOME&&process.env.KILO_PROOF_OUTCOME!==outcome)continue;
 if(process.env.KILO_PROOF_SIZE&&process.env.KILO_PROOF_SIZE!==`${vw}x${vh}`)continue;
 const id=`max-${outcome}-${vw}x${vh}`,pad=vw<900?12:24,l=fitGameLayout(vw-pad*2,vh-pad*2);
 const g=fitReels(Math.round(l.reelWidth),Math.round(l.reelHeight));
 const shellX=(vw-l.width)/2,ox=shellX+l.artLeft,oy=l.header;
 const camera=integratedSceneCamera(l,{stageSize:{width:vw-pad*2,height:vh-pad*2},sourceSize:vw<900?{width:1080,height:2400}:{width:1920,height:1080}});
 const box=sceneActorBox(camera.master,vw<900),background=await textureImage(featureEnvironmentUrl('max-win',vw<900));
 const quality=Math.min(1,Math.sqrt(650000/(camera.width*camera.height))),bg=createCanvas(Math.round(camera.width*quality),Math.round(camera.height*quality)),bc=bg.getContext('2d');
 const layout=createControlLayout({variant:vw<900?'portrait':'desktop',width:vw<900?l.reelWidth:Math.max(800,l.reelWidth),height:l.dock});
 const dockX=(vw-layout.width)/2,dockY=oy+g.dh;
 const win={x:dockX+layout.win.x,y:dockY+layout.win.y,w:layout.win.w,h:layout.win.h};
 const canvas=createCanvas(vw,vh),c=canvas.getContext('2d'),world=new Container(),host=new EventTarget();
 let currentGrid=example.spin.grid,focus=null,paid=example.previousTotal,elapsed=0,frame=0,dom=[],phase=outcome,bankAt=-1;
 const cues=[],snapshots=[],phases=[];let targets=new Map(),lastPhase='';
 host.dataset={};
 const ff=spawn('ffmpeg',['-v','error','-y','-f','image2pipe','-framerate','30','-i','pipe:0','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',`${output}/${id}-silent.mp4`],{stdio:['pipe','inherit','inherit']});
 const finished=once(ff,'exit');
 const text=(value,x,y,size=14,color='#fff8e9',align='center')=>{c.font=`700 ${size}px "Source Sans 3"`;c.fillStyle=color;c.textAlign=align;c.textBaseline='middle';c.fillText(String(value),x,y);};
 const save=async()=>{
  c.globalAlpha=1;c.fillStyle='#06131b';c.fillRect(0,0,vw,vh);
  paintFeatureEnvironment(bc,background,'max-win',vw<900,bg.width,bg.height,18000+elapsed,false,atmosphere);
  c.drawImage(bg,shellX+camera.left,camera.top,camera.width,camera.height);
  paintStageKing(actorContext,actorImage,stageKingFrameAt(18000+elapsed),false);
  c.drawImage(actor,shellX+camera.left+box.left*camera.scale,camera.top+box.top*camera.scale,box.width*camera.scale,box.height*camera.scale);
  c.strokeStyle='#a7864d';c.lineWidth=2;c.strokeRect(ox+g.gx,oy+g.gy,g.cell*5+g.gap*4,g.cell*3);
  c.save();c.translate(ox,oy);
  // Mode-wide production visibility gate excludes all reel interiors/symbols.
  const water=new Graphics();paintMaxStageSurface(water,g);await drawNode(c,water,new Set());
  await drawNode(c,world,allMasks(world));c.restore();
  const maxPhase=dom.length?'transfer':host.dataset.maxPhase??'idle';
  if(maxPhase!==lastPhase){phases.push({phase:maxPhase,ms:elapsed,segment:Number(host.dataset.maxSegment??0)});lastPhase=maxPhase;}
  // Target location comes from production modular layout. Only WIN is drawn;
  // no substitute controls are represented as a live browser render.
  c.fillStyle='#01070b';c.strokeStyle=elapsed-bankAt<500&&bankAt>=0?'#89e6d9':'#6c5b39';c.lineWidth=2;
  c.beginPath();c.roundRect(win.x,win.y,win.w,win.h,7);c.fill();c.stroke();
  text('WIN',win.x+win.w/2,win.y+12,14,'#b8c9c7');
  text(paid.toLocaleString('en-US'),win.x+win.w/2,win.y+win.h*.67,vw<900?20:28);
  for(const el of dom){if(!el.style.left)continue;c.globalAlpha=Number(el.style.opacity??1);
   text(el.textContent,parseFloat(el.style.left),parseFloat(el.style.top),parseFloat(el.style.fontSize??'24'),'#fff4cf');c.globalAlpha=1;}
  c.fillStyle='#06131b';c.fillRect(0,vh-65,vw,65);
  text(`MAX SPINS · ${outcome} · ${maxPhase}`,vw/2,vh-48,vw<900?13:18,'#e2bd77');
  text(`${(elapsed/1000).toFixed(2)}s · ${vw} × ${vh} · normal speed`,vw/2,vh-28,12,'#adc6c7');
  text('Offline production effects · unchanged background · WIN harness',vw/2,vh-10,vw<900?10:12,'#8fa7ad');
  const png=await canvas.encode('png');
  if(!ff.stdin.write(png))await once(ff.stdin,'drain');frame++;
  for(const [name,at]of [...targets])if(elapsed>=at){fs.writeFileSync(`${output}/${id}-${name}.png`,png);snapshots.push({name,at:elapsed});targets.delete(name);}
 };
 globalThis.document={body:{appendChild:el=>dom.push(el)},createElement:()=>({style:{},offsetHeight:28,setAttribute(){},remove(){dom=dom.filter(n=>n!==this);}})};
 const cuePhases={boatThrust:'Thrust · advance one reel',boatCoast:'Coast',boatBrake:'Brake · full stop',boatPass:'Departure · no extra stop',getawayLoss:'No win',getawayWin:'Maximum win',vsReady:'Challenge',vsPull:'Kilo pulls',vsImpact:'Contact',vsLock:'×3 locked · stays wild',vsConnect:'Winning connection',vsAmount:'5,000 × (2 + 3)',vsTransfer:'Transfer to WIN',vsBank:'25,000 credited once'};
 const a={host,world,geom:()=>g,cell:(symbol,size)=>{const node=new Container(),sprite=new Sprite(art.get(symbol.s));sprite.width=size;sprite.height=size;node.addChild(sprite);return node;},
  show:grid=>currentGrid=grid,stake:()=>example.stake,pace:()=>({speed:'normal',reduced:false}),live:()=>true,
  collect:async()=>{},highlight:async()=>{throw Error('VS must own its win sequence');},readout(){},focus:spots=>focus=spots,
  screen:(x,y)=>({x:ox+x,y:oy+y}),landing:height=>({x:win.x+win.w/2,y:win.y+win.h*.67-Math.max(18,height/2)-16}),
  cue:name=>{cues.push({name,ms:elapsed});phase=cuePhases[name]??phase;
   if(name==='boatThrust')targets.set('action',elapsed+110);
   if(name==='boatBrake')targets.set('brake',elapsed+150);
   if(name==='boatPass')targets.set('departure',elapsed+200);
   if(name==='getawayWin')targets.set('result',elapsed+450);
   if(name==='getawayLoss')targets.set('result',elapsed+120);
   if(name==='vsLock')targets.set('lock',elapsed+240);
   if(name==='vsConnect')targets.set('connection',elapsed+220);
   if(name==='vsAmount')targets.set('amount',elapsed+240);
   if(name==='vsTransfer')targets.set('transfer',elapsed+140);
   if(name==='vsBank')targets.set('bank',elapsed+100);
  },
  bankCue:()=>bankAt=elapsed,
  hold:async ms=>{const count=Math.max(1,Math.round(ms/1000*30));for(let n=0;n<count;n++){await save();elapsed+=1000/30;}},
  tween:async(ms,paint)=>{const count=Math.max(1,Math.round(ms/1000*30));for(let n=0;n<count;n++){paint(n/Math.max(1,count-1));await save();elapsed+=1000/30;}},
 };
 const ctl=createReelFeatureEffects(a),e=example.spin.mechanic;
 ctl.set(e,'before');await a.hold(400);
 await ctl.step(e,{award:value=>paid+=value,state(){}});
 ctl.set(e,'after');await a.hold(900);ctl.destroy();
 ff.stdin.end();const [code]=await finished;if(code!==0)throw Error('Encoder failed');
 fs.writeFileSync(`${output}/${id}-timeline.json`,JSON.stringify({viewport:[vw,vh],geometry:g,durationMs:elapsed,initialWin:example.previousTotal,finalWin:paid,cues,phases,snapshots},null,2)+'\n');
 execFileSync('python',['scripts/mix-performance-proof-v62.py',`${output}/${id}-timeline.json`,`${temp}/${id}.wav`]);
 execFileSync('ffmpeg',['-v','error','-y','-i',`${output}/${id}-silent.mp4`,'-i',`${temp}/${id}.wav`,'-c:v','copy','-c:a','aac','-b:a','128k','-shortest','-movflags','+faststart',`${output}/${id}.mp4`]);
 fs.unlinkSync(`${output}/${id}-silent.mp4`);fs.unlinkSync(`${temp}/${id}.wav`);
 stages.push({id,frames:frame,geometry:g,initialWin:example.previousTotal,finalWin:paid,cues,phases});

 console.log(`${id}: ${frame} frames with ${cues.length} synchronized cues`);
}
fs.writeFileSync(`${output}/manifest${process.env.KILO_PROOF_OUTCOME?'-'+process.env.KILO_PROOF_OUTCOME:''}${process.env.KILO_PROOF_SIZE?'-'+process.env.KILO_PROOF_SIZE:''}.json`,JSON.stringify({method:'Offline native Canvas rasterization of production effect display lists. Real source geometry, assets, unchanged v64 background painter and recorded outcome. Minimal WIN harness; not a browser, full game UI or GPU capture.',stages},null,2)+'\n');
