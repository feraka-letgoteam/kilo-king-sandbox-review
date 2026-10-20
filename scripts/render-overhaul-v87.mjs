/** Native offline capture of production mountScene + feature controllers.
 * This is silent CPU Canvas evidence, not browser/WebGL or the React control UI. */
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
const hashBytes=bytes=>createHash('sha256').update(bytes).digest('hex');
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {createOfflineRuntime,createCanvas,textureImage,drawNode,allMasks,findAll,walk} from './offline-runtime-v79.mjs';
import {createProofChrome} from './offline-chrome-v80.mjs';
import {sourceFingerprint as fingerprint} from './v79-source-fingerprint.mjs';
const proofVersion=process.env.KILO_PROOF_VERSION??'v87';
const output=process.env.KILO_PROOF_OUTPUT??'art/kilo-v87/proofs';fs.mkdirSync(output,{recursive:true});
const seeded=seed=>()=>{seed|=0;seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};
const sourceFingerprint=fingerprint();
const proofHarnessFingerprint=createHash('sha256').update(Buffer.concat(['scripts/render-overhaul-v87.mjs','scripts/offline-runtime-v79.mjs','scripts/offline-pixi-painter.mjs','scripts/offline-chrome-v80.mjs'].map(file=>Buffer.concat([Buffer.from(file+'\0'),fs.readFileSync(file)])))).digest('hex');
const gcInterval=Math.max(1,Number(process.env.KILO_PROOF_GC_INTERVAL??1));
const captureStride=Math.max(1,Number(process.env.KILO_PROOF_CAPTURE_STRIDE??1));
const captureFrom=Number(process.env.KILO_PROOF_CAPTURE_FROM_MS??0),captureTo=Number(process.env.KILO_PROOF_CAPTURE_TO_MS??Infinity);
assert([1,2,3].includes(captureStride),'Capture stride is 1, 2 or 3');
const fixturesRuntime=createOfflineRuntime(),math=fixturesRuntime.load('src/lib/kilo/reel-feature-math.ts');
function fixture(kind,target){
 if(kind==='catch-win'||kind==='catch-miss'){const engine=fixturesRuntime.load('src/lib/kilo/engine.ts');for(let seed=1;seed<20000;seed++){const round=engine.playSplash(1000,'spin',seeded(seed));if(round.base.catchRun&&round.base.catchRun.caught===(kind==='catch-win'))return{seed,index:0,round,spin:round.base,previousTotal:0};}}
 if(kind==='dock-progression'){const round=fixturesRuntime.load('src/lib/kilo/engine.ts').generateSplashCandidate(1000,'buy',seeded(103000024));return{seed:103000024,index:0,round,spin:round.base,previousTotal:0};}
 if(kind==='session-dock'){const round=fixturesRuntime.load('src/lib/kilo/engine.ts').playSplash(1000,'buy',seeded(832026));return{seed:832026,index:0,round,spin:round.base,previousTotal:0};}
 if(kind==='session-vs'||kind==='ordinary'){const round=fixturesRuntime.load('src/lib/kilo/engine.ts').playSplash(1000,kind==='ordinary'?'spin':'yacht',seeded(822026));return{seed:822026,index:0,round,spin:round.base,previousTotal:0};}
 if(kind==='tool-hook'||kind==='tool-dynamite'){const round=fixturesRuntime.load('src/lib/kilo/fixtures.json')[kind].script,index=round.free.findIndex(s=>s.tool===kind.slice(5));return{seed:null,index,round,spin:round.free[index],previousTotal:0};}
 if(kind==='retrigger'){const round=fixturesRuntime.load('src/lib/kilo/fixtures.json')['tool-bazooka'].script,index=round.free.findIndex(spin=>spin.extra>0);return{seed:null,index,round,spin:round.free[index],previousTotal:0};}
 if(kind==='collection'){const round=fixturesRuntime.load('src/lib/kilo/fixtures.json')['tool-bazooka'].script;return{seed:null,index:15,round,spin:round.free[15],previousTotal:0};}
 if(kind==='chopper'){for(let seed=1;seed<200;seed++){const round=math.runReelFeature('route',1000,seeded(seed),25000000);for(const[index,spin]of round.free.entries())if(spin.mechanic.reel.cascades.length>=2)return{seed,index,round,spin,previousTotal:0};}}

 if(kind==='base-strong'){const engine=fixturesRuntime.load('src/lib/kilo/engine.ts');for(let seed=1;seed<30000;seed++){const round=engine.playSplash(1000,'spin',seeded(seed));if(!round.free.length&&round.base.lines.length>=2&&round.payout>=5000&&!round.base.hook&&!round.base.catchRun&&!round.base.collect)return{seed,index:0,round,spin:round.base,previousTotal:0};}}
 if(kind==='base'){
  const engine=fixturesRuntime.load('src/lib/kilo/engine.ts');
  for(let seed=1;seed<20000;seed++){const round=engine.playSplash(1000,'spin',seeded(seed));if(!round.free.length&&round.base.lines.length===1&&!round.base.hook)return{seed,index:0,round,spin:round.base,previousTotal:0};}
 }
 if(kind==='entry-dock'){const round=fixturesRuntime.load('src/lib/kilo/engine.ts').playSplash(1000,'buy',seeded(170));return{seed:170,index:0,round,spin:round.base,previousTotal:0};}
 if(kind==='entry-vs'){const round=fixturesRuntime.load('src/lib/kilo/engine.ts').playSplash(1000,'yacht',seeded(170));assert.equal(round.version,4);assert.equal(round.feature,'yacht');assert(Number.isFinite(round.awarded));return{seed:170,index:0,round,spin:round.base,previousTotal:0};}

 if(kind==='getaway'){for(let seed=1;seed<100000;seed++){const round=math.runReelFeature(kind,1000,seeded(seed),25000000),spin=round.free[0],r=spin.mechanic.reel;if((target==='full'&&r.won)||(target==='early'&&!r.won&&r.reveal.segments===2)||(target==='late'&&!r.won&&r.reveal.segments===4))return{seed,index:0,round,spin,previousTotal:0};}}
 else {const seeds=[1569831,...Array.from({length:2048},(_,i)=>i+1)];for(const seed of seeds){const round=math.runReelFeature('yacht',1000,seeded(seed),18000000);for(const[index,spin]of round.free.entries()){const r=spin.mechanic.reel,before=r.groupsBefore??[],after=r.groupsAfter??[];const wide=after.find(g=>g.width===target),expands=wide&&before.every(g=>g.reels.join(',')!==wide.reels.join(','));if(expands&&r.conversions.length&&(target!==5||r.lines.length))return{seed,index,round,spin,previousTotal:round.free.slice(0,index).reduce((s,n)=>s+n.got,0)};}}}
 throw Error('No natural fixture '+kind+':'+target);
}
const sizes=[[1440,900],[390,844]],selectedCase=process.env.KILO_PROOF_CASE??'session-vs',selectedSize=process.env.KILO_PROOF_SIZE,stills=process.env.KILO_PROOF_STILLS==='1',metadataOnly=process.env.KILO_PROOF_METADATA_ONLY==='1';
const specs={'tool-hook':['tool-hook'],'tool-dynamite':['tool-dynamite'],'retrigger':['retrigger'],'dock-progression':['dock-progression'],'catch-win':['catch-win'],'catch-miss':['catch-miss'],'session-dock':['session-dock'],'session-vs':['session-vs'],'ordinary':['ordinary'],'base-hit':['base-strong'],'base-spin':['base'],'entry-dock':['entry-dock'],'entry-vs':['entry-vs'],'vs-pair':['yacht',2],'vs-wide':['yacht',3],'vs-five':['yacht',5],'collection':['collection'],'god-full':['getaway','full'],'god-early-loss':['getaway','early'],'god-late-overshoot':['getaway','late']};
const cases=[[selectedCase,fixture(...specs[selectedCase])]];
for(const[name,example]of cases)for(const[vw,vh]of sizes){
 const isSession=name==='dock-progression'||name==='session-vs'||name==='session-dock'||name==='ordinary'||name.startsWith('catch-'),isOrdinary=name==='ordinary',isTool=name.startsWith('tool-'),isGod=name.startsWith('god'),isVS=name.startsWith('vs-'),isEntry=name.startsWith('entry-'),isBase=name==='base-spin'||name==='base-hit',isCollection=name==='collection',isChopper=name==='chopper',isRetrigger=name==='retrigger';
 if(selectedCase&&name!==selectedCase)continue;if(selectedSize&&selectedSize!==`${vw}x${vh}`)continue;
 if(!selectedCase&&!['collection','chopper','base-spin','entry-dock','entry-vs','god-full','god-early-loss','god-late-overshoot','vs-five'].includes(name))continue;
 const existingId=`${name}-${vw}x${vh}`,existingManifest=`${output}/${existingId}.json`,existingClip=`${output}/${existingId}.mp4`;
 if(stills&&!metadataOnly&&process.env.KILO_PROOF_REUSE==='1'&&fs.existsSync(existingManifest)){
   const prior=JSON.parse(fs.readFileSync(existingManifest,'utf8'));
   if(prior.sourceFingerprint===sourceFingerprint&&prior.proofHarnessFingerprint===proofHarnessFingerprint&&prior.capture?.kind==='frame-sequence'&&prior.capture.frames===prior.snapshots.length&&prior.snapshots.length>5&&prior.snapshots.every(frame=>fs.existsSync(`${output}/${frame.file}`)&&fs.statSync(`${output}/${frame.file}`).size>1000)){
     console.log(`Reused complete frozen-source frame sequence ${existingId}`);continue;
   }
 }
 if(!metadataOnly&&process.env.KILO_PROOF_REUSE==='1'&&fs.existsSync(existingManifest)&&fs.existsSync(existingClip)){const prior=JSON.parse(fs.readFileSync(existingManifest,'utf8'));if(prior.sourceFingerprint===sourceFingerprint&&prior.proofHarnessFingerprint===proofHarnessFingerprint){const metadata=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate,nb_frames','-of','json',existingClip],{encoding:'utf8'})).streams[0];if(metadata.width===vw&&metadata.height===vh&&metadata.r_frame_rate===`${prior.capture?.fps??30}/1`&&Number(metadata.nb_frames)===(prior.capture?.frames??prior.frames)){console.log(`Reused verified ${existingId}`);continue;}}}
 const prior=metadataOnly?JSON.parse(fs.readFileSync(existingManifest,'utf8')):null;
 if(metadataOnly)assert.equal(prior.proofHarnessFingerprint,proofHarnessFingerprint,'Metadata requires the same proof harness');
 if(metadataOnly)assert.equal(prior.sourceFingerprint,sourceFingerprint,'Metadata replay requires the exact same frozen source; otherwise recapture the clip');
 const cues=[];let cuePhase='idle';
 const runtime=createOfflineRuntime(),{load,pixi}=runtime;
 runtime.window.innerWidth=vw;runtime.window.innerHeight=vh;
 const sound=load('src/lib/kilo/sound.ts');let locks=0;
 for(const method of ['featureCue','cue','winSting','landStop','bonusEnter','bonusExit','whirStart','whirStop','teaseBegin','teaseResolve']){const original=sound[method];sound[method]=(...args)=>{if(method==='bonusEnter')locks=0;if(method==='featureCue'&&args[0]==='vsLock')locks++;const name=method==='featureCue'?args[0]:method;cues.push({name,args,ms:runtime.clock,locks});cuePhase=name;return original(...args);};}
 const {fitGameLayout}=load('src/components/kilo/layout.ts'),{createControlLayout}=load('src/components/slot-controls/layout.ts');
 const {integratedSceneCamera}=load('src/components/kilo/integrated-scene-model.ts'),{sceneActorBox}=load('src/components/kilo/RiggedSceneActor.tsx');
 const {paintFeatureEnvironment,compositeEnvironmentFrames}=load('src/components/kilo/feature-environment-painter.ts'),{featureEnvironmentUrl}=load('src/components/kilo/feature-environments.ts'),{ATMOSPHERE_URLS}=load('src/components/kilo/feature-atmosphere.ts');
 const {STAGE_KING,createStageKingPlayback,paintStageKing,kingToolFrame}=load('src/components/kilo/stage-character-life.ts');
 const {KING_ARM_ASSETS,KING_STAGE_CANVAS,KING_THROW_RELEASE,kingLeftArmPose,kingRightRodPose}=load('src/components/kilo/stage-character-arm.ts');
 const portrait=vw<900,pad=portrait?12:24,l=fitGameLayout(vw-pad*2,vh-pad*2),shellX=(vw-l.width)/2,ox=shellX+l.artLeft,oy=l.header;
 const layout=createControlLayout({variant:portrait?'portrait':'desktop',width:portrait?l.reelWidth:Math.max(800,l.reelWidth),height:l.dock});
 const dockX=(vw-layout.width)/2,dockY=oy+l.reelHeight,win={x:dockX+layout.win.x,y:dockY+layout.win.y,w:layout.win.w,h:layout.win.h};
 const host=runtime.host(Math.round(l.reelWidth),Math.round(l.reelHeight),ox,oy,win),scene=await load('src/components/kilo/pixiStage.ts').mountScene(host),stage=runtime.apps[0].stage;
 const camera=integratedSceneCamera(l,{stageSize:{width:vw-pad*2,height:vh-pad*2},sourceSize:portrait?(isGod?{width:1080,height:2400}:{width:768,height:1708}):{width:1920,height:1080}}),box=sceneActorBox(camera.master,portrait);
 let mode=isSession?'base':isGod?'max-win':isBase?'base':name==='entry-dock'||isCollection||isTool||isRetrigger?'scatter-3':isChopper?'chopper':'scatter-4';const backgrounds=Object.fromEntries(await Promise.all(['base','scatter-3','scatter-4','max-win'].map(async key=>[key,await textureImage(featureEnvironmentUrl(key,portrait))])));let background=backgrounds[mode];
 const beforeCollectors=(example.round.banked??0)+(example.round.free??[]).slice(0,example.index).reduce((sum,spin)=>sum+spin.wilds,0);
 const meter=load('src/components/kilo/director.ts').faceFor(beforeCollectors);
 let chrome=await createProofChrome(load,l,isCollection||isTool||isRetrigger||name==='entry-dock'?{left:example.spin.left??example.round.awarded??10,mult:example.spin.mult??1,...meter}:null);
 let chromeState=null,chromeKey='initial';
 const atmosphere=Object.fromEntries(await Promise.all(Object.entries(ATMOSPHERE_URLS).map(async([key,url])=>[key,await textureImage(url)])));
 const armImages=Object.fromEntries(await Promise.all(Object.entries(KING_ARM_ASSETS).map(async([k,u])=>[k,await textureImage(u)])));
 const actorImage=armImages.body,eyes=await textureImage(STAGE_KING.blink.image),brow=await textureImage(STAGE_KING.reaction.image),actor=createCanvas(KING_STAGE_CANVAS.width*1.5,KING_STAGE_CANVAS.height*1.5),ac=actor.getContext('2d'),face=createCanvas(1024,1536),fc=face.getContext('2d');
 const earned=load('src/components/kilo/character-performance.ts').earnedCharacterCelebration;let actorCelebrated=false,actorCharge=example.round.cost,actorPayout=example.round.payout;const actorPlayback=createStageKingPlayback();actorPlayback.advance(18000);let actorTime=0,actionId=0,lastFace='',toolPose=null;
 const quality=Math.min(1,Math.sqrt(650000/(camera.width*camera.height))),bg=createCanvas(Math.round(camera.width*quality),Math.round(camera.height*quality)),bc=bg.getContext('2d'),canvas=createCanvas(vw,vh),c=canvas.getContext('2d');
 const world=createCanvas(bg.width,bg.height),wc=world.getContext('2d');let paintedMode=mode,transitionFrom=null,transitionAt=-Infinity;
 const event=isSession||isTool||isBase||isEntry||isCollection||isRetrigger?null:example.spin.mechanic,id=`${name}-${vw}x${vh}`,file=`${output}/${id}.mp4`,encodingFile=path.join(os.tmpdir(),`kilo-v85-${id}-${process.pid}-${Date.now()}.mp4`),reactions=[],telemetry=[],phases=[],snapshots=[],credits=[],bankEvents=[];let paid=example.previousTotal,frame=0,capturedFrames=0,lastPhase='',lastSnap='',isSpinning=false,normalSpinCalls=0,previousSamplePhase='';
 if(!metadataOnly)for(const previous of fs.readdirSync(output))if((previous.startsWith(id+'-')||previous===id+'.json'||previous===id+'.mp4')&&fs.statSync(output+'/'+previous).isFile())fs.unlinkSync(output+'/'+previous);
 host.addEventListener('kilo-stage-action',e=>{const kind=e.detail.kind;if(kind==='settle')actorPlayback.settle();else actorPlayback.react(`${kind}:${++actionId}`,kind);reactions.push({kind,ms:runtime.clock});});
 host.addEventListener('kilo-stage-focus',e=>actorPlayback.focus(e.detail??null));
 host.addEventListener('kilo-stage-tool',e=>{const detail=e.detail;toolPose=detail.progress>=1?null:{kind:detail.kind,progress:detail.progress};const f=kingToolFrame(actorPlayback.frame,toolPose),screen=p=>({x:shellX+camera.left+(box.left+p.x*box.width/512)*camera.scale,y:camera.top+(box.top+p.y*box.height/768)*camera.scale});detail.hand=screen(kingLeftArmPose(f,toolPose).hand);detail.rodTip=screen(kingRightRodPose(f,toolPose).tip);const release={kind:'throw',progress:KING_THROW_RELEASE};detail.releaseHand=screen(kingLeftArmPose(kingToolFrame(actorPlayback.frame,release),release).hand);detail.handSize=60*box.width/512*camera.scale;});
 host.addEventListener('kilo-collection',e=>{if(!isCollection||!e.detail)return;cuePhase=e.detail.phase;if(e.detail.phase==='bank'){paid=e.detail.completed;credits.push({value:paid,ms:runtime.clock-start});bankEvents.push({value:paid,ms:runtime.clock});}});
 host.addEventListener('kilo-earned-win',e=>{bankEvents.push({value:e.detail.visibleAward,ms:runtime.clock});if(earned(Math.min(e.detail.visibleAward,actorPayout),1000,actorCharge,actorCelebrated,false)){actorCelebrated=true;actorPlayback.react(`earned:${++actionId}`,'win');}});
 const ff=stills||metadataOnly?null:spawn('ffmpeg',['-v','error','-y','-f','rawvideo','-pix_fmt','rgba','-s',`${vw}x${vh}`,'-framerate',String(30/captureStride),'-i','pipe:0','-c:v','libx264','-threads','2','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',encodingFile],{stdio:['pipe','inherit','inherit']}),finished=ff?once(ff,'exit'):null;
 const text=(value,x,y,size,color='#fff8e9')=>{c.font=`700 ${size}px "Source Sans 3"`;c.textAlign='center';c.textBaseline='middle';c.fillStyle=color;c.fillText(String(value),x,y);};
 const start=runtime.clock,sessionRecords=[];let sessionRound=0;
 async function capture(){
  if(isSession){const key=JSON.stringify(chromeState);if(key!==chromeKey){chromeKey=key;chrome=await createProofChrome(load,l,chromeState);}}
  if(frame%gcInterval===0){await new Promise(resolve=>setImmediate(resolve));globalThis.gc?.();await new Promise(resolve=>setImmediate(resolve));}
  const samplePhase=(host.dataset.catchPhase??host.dataset.maxPhase??host.dataset.collectStep??cuePhase)+':'+(host.dataset.maxSegment??'');const phaseChanged=samplePhase!==previousSamplePhase;previousSamplePhase=samplePhase;
  const elapsed=runtime.clock-start,actorFrame=actorPlayback.advance(runtime.clock-actorTime);actorTime=runtime.clock;
  if(stills&&!metadataOnly&&frame%6!==0&&!phaseChanged){frame++;return;}
  if(isEntry)walk(stage,node=>{if(typeof node.text==='string')assert(!/undefined|NaN/.test(node.text),'Feature-entry fixture must include the full production round metadata');});
  const raster=!metadataOnly&&frame%captureStride===0&&elapsed>=captureFrom&&elapsed<=captureTo;
  const travellers=runtime.document.body.children.filter(el=>['kk-feature-transfer','kk-award-fly'].includes(el.className));
  if(raster){
  c.globalAlpha=1;c.fillStyle='#06131b';c.fillRect(0,0,vw,vh);if(paintedMode!==mode){transitionFrom=createCanvas(bg.width,bg.height);transitionFrom.getContext('2d').drawImage(bg,0,0);transitionAt=elapsed;paintedMode=mode;}paintFeatureEnvironment(wc,background,mode,portrait,bg.width,bg.height,18000+elapsed,false,atmosphere);if(compositeEnvironmentFrames(bc,transitionFrom,world,bg.width,bg.height,elapsed-transitionAt)>=1)transitionFrom=null;c.drawImage(bg,shellX+camera.left,camera.top,camera.width,camera.height);
  if(lastFace!==actorFrame.blink){lastFace=actorFrame.blink;fc.clearRect(0,0,1024,1536);fc.drawImage(actorImage,0,0);if(actorFrame.blink!=='open'){const f=actorFrame.blink==='brow'?STAGE_KING.reaction.frame:STAGE_KING.blink.frames[actorFrame.blink],to=STAGE_KING.blink.imageTarget;fc.clearRect(to.x,to.y,to.width,to.height);fc.drawImage(actorFrame.blink==='brow'?brow:eyes,f.x,f.y,f.width,f.height,to.x,to.y,to.width,to.height);}}
  paintStageKing(ac,face,actorFrame,false,armImages,toolPose);c.drawImage(actor,shellX+camera.left+(box.left-KING_STAGE_CANVAS.offsetX*box.width/512)*camera.scale,camera.top+(box.top-KING_STAGE_CANVAS.offsetY*box.height/768)*camera.scale,box.width*KING_STAGE_CANVAS.width/512*camera.scale,box.height*KING_STAGE_CANVAS.height/768*camera.scale);
  c.save();c.translate(ox,oy);await drawNode(c,stage,allMasks(stage));c.restore();chrome(c,ox,oy);
  for(const el of host.children.filter(e=>e.className==='kk-stage-readout'&&!e.hidden&&e.dataset.kind!=='local')){
    const x=ox+parseFloat(el.style.left),y=oy+parseFloat(el.style.top),w=parseFloat(el.style.width),h=parseFloat(el.style.height);
    const [caption,value]=el.children;const cs=parseFloat(el.style.fontSize),vs=parseFloat(value.style.fontSize);
    c.font=`600 ${cs}px "Source Sans 3"`;const cw=c.measureText(caption.textContent).width;c.font=`700 ${vs}px "Source Sans 3"`;const vw=c.measureText(value.textContent).width;const left=x+(w-cw-vw-10)/2;text(caption.textContent,left+cw/2,y+h/2,cs,'#c6dcd8');text(value.textContent,left+cw+10+vw/2,y+h/2,vs);
  }
  for(const el of runtime.document.body.children.filter(e=>e.className==='kk-character-tool-flight')){if(Number(el.style.opacity??1)<=0)continue;const img=await textureImage(el.src),w=parseFloat(el.style.width),h=w*img.height/img.width,angle=Number(/rotate\(([-.\d]+)deg\)/.exec(el.style.transform)?.[1]??0)*Math.PI/180;c.save();c.translate(parseFloat(el.style.left),parseFloat(el.style.top));c.rotate(angle);c.drawImage(img,-w/2,-h/2,w,h);c.restore();}
  c.fillStyle='#01070b';c.strokeStyle='#8b794e';c.lineWidth=2;c.beginPath();c.roundRect(win.x,win.y,win.w,win.h,7);c.fill();c.stroke();text('WIN',win.x+win.w/2,win.y+12,14,'#b8c9c7');text(paid.toLocaleString('en-US'),win.x+win.w/2,win.y+win.h*.67,portrait?20:28);
  for(const el of travellers){if(!el.style.left)continue;c.globalAlpha=Number(el.style.opacity??1);const size=parseFloat(el.style.fontSize??'')||Math.max(20,Math.min(32,vw*.03)),x=parseFloat(el.style.left),y=parseFloat(el.style.top);c.font=`700 ${size}px "Source Sans 3"`;c.textAlign='center';c.textBaseline='middle';c.fillStyle='#021019';c.fillText(el.textContent,x,y+2);c.fillText(el.textContent,x-1,y);c.fillText(el.textContent,x+1,y);c.fillStyle='#fff4cf';c.fillText(el.textContent,x,y);c.globalAlpha=1;}
  }
  const card=findAll(stage,'god-full-window-card')[0],groups=findAll(stage,'vs-group-art'),phase=host.dataset.catchPhase??host.dataset.maxPhase??(isSpinning?'ordinary-reel-spin':cuePhase);
  const strips=stage.children[0].children.filter(n=>n.mask&&n.children.length===2&&n.children[0]===n.mask).sort((a,b)=>a.x-b.x).map(n=>n.children[1]);
  const row={frame,ms:elapsed,phase,isSpinning,authoredEntry:findAll(stage,'dock-entry-crest').map(n=>({...n.texture.frame})),segment:host.dataset.maxSegment?Number(host.dataset.maxSegment):undefined,card:card?.godCard?{...card.godCard}:undefined,stripVisibility:strips.map(n=>n.visible),stripCellCounts:strips.map(n=>n.children.length),stripOffsets:strips.map(n=>n.y),groups:groups.map(g=>({reels:g.vsGroup.reels,side:g.vsGroup.side,multiplier:g.vsGroup.multiplier,number:g.children.filter(n=>n.label==='vs-group-multiplier').map(n=>({text:n.text,size:n.style.fontSize,scale:n.scale.x,alpha:n.alpha}))})),paid,travellers:travellers.map(e=>({...e.style,text:e.textContent})),actor:actorFrame,tool:toolPose};telemetry.push(row);
  assert.equal(strips.length,5,'proof executes five actual production reel strips');
  if(isGod||isBase||isEntry){assert(row.stripVisibility.every(Boolean),'God never hides real reel strips');assert(row.stripCellCounts.every(n=>n>=3),'God never empties the board');}
  else if(isVS){
    for(const group of groups)assert(group.vsGroup.reels.every(reel=>strips[reel].visible===false),'no symbols visible under any VS art');
    for(const wild of event.reel.before)assert(groups.some(group=>group.alpha>.001&&group.vsGroup.reels.includes(wild.reel)),'Existing VS art stays visible across the encounter-to-merge handoff');
  }
  if(phase!==lastPhase){phases.push({phase,ms:elapsed,segment:row.segment});lastPhase=phase;}
  const snapKey=card?`${phase}:${row.segment}`:groups.map(g=>`${g.vsGroup.side}:${g.vsGroup.width}`).join('|')+':'+phase;
  const snapshotDue=isOrdinary?frame%450===0:isSession?(frame%120===0||snapKey!==lastSnap&&/vsReady|vsImpact|vsLock|vsAmount|vsBank|bonusExit/.test(phase)):(snapKey!==lastSnap||frame%12===0);
  if(raster&&(stills||frame%3===0)&&(stills||snapshotDue)){lastSnap=snapKey;const filename=`${id}-f${String(frame).padStart(4,'0')}.webp`;fs.writeFileSync(`${output}/${filename}`,await canvas.encode('webp',90));snapshots.push({file:filename,ms:elapsed,phase,segment:row.segment});}
  if(raster){c.fillStyle='#06131b';c.fillRect(0,vh-52,vw,52);text(`${proofVersion} · ${name} · ${vw}×${vh}`,vw/2,vh-36,portrait?12:15,'#e2bd77');text('Offline production renderer · timed audio mix · WIN harness',vw/2,vh-15,portrait?9:12,'#9fbabc');}
  if(ff&&raster){const raw=c.getImageData(0,0,vw,vh).data;if(!ff.stdin.write(Buffer.from(raw.buffer,raw.byteOffset,raw.byteLength)))await once(ff.stdin,'drain');capturedFrames++;}frame++;
  if(frame%300===0){const memoryFile='/sys/fs/cgroup/memory.stat',stat=fs.existsSync(memoryFile)?Object.fromEntries(fs.readFileSync(memoryFile,'utf8').trim().split('\n').map(line=>line.split(' '))):{};console.log(`${id}: frame ${frame}, RSS ${Math.round(process.memoryUsage().rss/1048576)}MiB${stat.anon?`, cgroup anon ${Math.round(Number(stat.anon)/1048576)}MiB`:''}`);}
 }
 scene.setStake(1000);scene.setPace(false,false,'normal');scene.show(isTool?example.spin.primed:example.spin.grid);scene.setFeatureState(event,'before');
 // Prime one source-native still before any feature overlay to prove populated reels.
 await capture();for(let i=0;i<(isBase?114:9);i++){await runtime.tick(1000/30);await capture();}
 if(isGod||isBase){isSpinning=true;normalSpinCalls++;await runtime.drive(scene.spinTo(isGod?event.reel.finalGrid:example.spin.grid,null,'ordinary'),{step:1000/30,onFrame:capture});isSpinning=false;}
 if(isSession){
  const present=load('src/components/kilo/director.ts').presentScript,engine=load('src/lib/kilo/engine.ts'),rng=seeded(832026);
  const maximum=isOrdinary?Number(process.env.KILO_PROOF_SESSION_MS??180000):0;
  do{
   const round=isOrdinary?engine.playSplash(1000,'spin',rng):example.round;
   sessionRecords.push({index:sessionRound++,startMs:runtime.clock-start,script:round});paid=0;actorCelebrated=false;actorCharge=round.cost;actorPayout=round.payout;
   scene.setFeatureState(null);mode='base';background=backgrounds[mode];
   await runtime.drive(present(scene,round,{turbo:false,speed:'normal',reduced:false,skipped:()=>false,onHud:h=>{
     chromeState=h.active&&round.feature==='dock'?{left:h.left??0,mult:h.mult,filled:h.filled,nextMult:h.nextMult,nextSpins:h.nextSpins,holding:h.holding,maxed:h.maxed}:null;
     if(h.total>paid)credits.push({value:h.total-paid,ms:runtime.clock-start,round:sessionRound-1});paid=h.total;
     if(h.active||h.phase==='entry'){mode=(round.feature==='yacht'||round.feature==='yacht25')?'scatter-4':round.feature==='getaway'?'max-win':'scatter-3';background=backgrounds[mode];}
   }}),{step:1000/30,onFrame:capture,maxMs:300000});
   assert.equal(paid,round.payout,'Complete director resolves exact recorded total');
   for(let i=0;i<12;i++){await runtime.tick(1000/30);await capture();}
   if(!isOrdinary)break;
  }while(runtime.clock-start<maximum);
 }else if(isTool){
  await runtime.drive(scene.tool(example.spin),{step:1000/30,onFrame:capture});
 }else if(isBase){
  await runtime.drive(scene.highlight(example.spin.lines,(line)=>{paid+=line.pay;credits.push({value:line.pay,ms:runtime.clock-start});}),{step:1000/30,onFrame:capture});
 }else if(isCollection){
  await runtime.drive(scene.collect(example.spin),{step:1000/30,onFrame:capture});
  assert.equal(paid,48000,'Recorded two-collector acceptance fixture');
 }else if(isRetrigger){
  let grants=0;cuePhase='retrigger-arrival';
  const nextMult=load('src/lib/kilo/engine.ts').collectMult(beforeCollectors+example.spin.wilds);
  await runtime.drive(scene.retrigger(example.spin.extra,nextMult,()=>{grants++;cuePhase='retrigger-award';}),{step:1000/30,onFrame:capture});assert.equal(grants,1);cuePhase='retrigger-complete';
 }else if(isEntry){
  cuePhase='feature-entry';await runtime.drive(name==='entry-vs'?scene.featureIntro(example.round):scene.intro(example.round),{step:1000/30,onFrame:capture});cuePhase='entry-complete';
 }else{
  const promise=scene.reelFeatureStep(event,{award:value=>{paid+=value;credits.push({value,ms:runtime.clock-start});},state(){}});
  await runtime.drive(promise,{step:1000/30,onFrame:capture});scene.show(event.reel.finalGrid);scene.setFeatureState(event,'after');
 }
 for(let i=0;i<24;i++){await runtime.tick(1000/30);await capture();}
 if(ff){ff.stdin.end();const[code]=await finished;if(code!==0)throw Error('Encoder failed '+id);const metadata=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=nb_frames,width,height','-of','json',encodingFile],{encoding:'utf8'})).streams[0];assert.equal(Number(metadata.nb_frames),capturedFrames,'Complete encoded frame count');assert.deepEqual([metadata.width,metadata.height],[vw,vh]);const fd=fs.openSync(encodingFile,'r');fs.fsyncSync(fd);fs.closeSync(fd);fs.copyFileSync(encodingFile,file);const copied=fs.openSync(file,'r');fs.fsyncSync(copied);fs.closeSync(copied);assert.equal(hashBytes(fs.readFileSync(file)),hashBytes(fs.readFileSync(encodingFile)));fs.unlinkSync(encodingFile);}
 if(event){assert.equal(paid-example.previousTotal,event.credited,'proof awards the recorded amount exactly');assert.deepEqual(credits.map(c=>c.value),bankEvents.map(e=>e.value),'one WIN update for each source-owned transfer');}
 if(isBase)assert.equal(paid,example.spin.lines.reduce((sum,line)=>sum+line.pay,0),'Base line credits come from actual recorded lines');
 if(isEntry)assert.equal(credits.length,0,'Entry artwork never credits an award');
 if(name==='entry-dock')assert(new Set(telemetry.flatMap(row=>row.authoredEntry.map(f=>JSON.stringify(f)))).size>=4,'Dock ceremony actually plays the authored drawings');
 if(isGod||isBase){assert.equal(normalSpinCalls,1);assert(telemetry.some(row=>row.isSpinning&&row.stripOffsets.some(y=>Math.abs(y)>1)),'actual production reel strip movement captured');}
 if(sourceFingerprint!==fingerprint())throw Error('Production changed during proof capture; re-run this case from the frozen source.');
 const manifest={id,sourceFingerprint,proofHarnessFingerprint,harnessConfig:{dynamicDockHeader:true,recorded:true,gcInterval,exposeGc:typeof globalThis.gc==='function'},method:'Actual production mountScene, source-native cells, feature controller, geometry, environment painter and character painter, instrumented Pixi rasterized to CPU Canvas. WIN target harness; audio is mixed offline from recorded production cue timestamps. Not browser/WebGL or complete React UI. The stage actor is drawn with the production painter; its actual React mount is separately exercised by verify-stage-mount-v85.mjs.',viewport:[vw,vh],fps:30,frames:frame,durationMs:runtime.clock-start,normalSpinCalls,sessionRecords,fixture:{seed:example.seed,index:example.index,stake:1000,previousTotal:example.previousTotal,event,baseGrid:isBase||isEntry?example.spin.grid:undefined},finalWin:paid,credits,bankEvents,reactions,cues,phases,snapshots,telemetry};
 if(metadataOnly){assert.equal(frame,prior.frames);assert.deepEqual(credits,prior.credits);assert.deepEqual(bankEvents,prior.bankEvents);assert.deepEqual(reactions,prior.reactions);const semantic=row=>{const{phase,...rest}=row;return JSON.parse(JSON.stringify(rest));};assert.deepEqual(telemetry.map(semantic),prior.telemetry.map(semantic),'cue replay exactly matches every captured source transform, amount, visibility and travelling value');manifest.capture=prior.capture;if(prior.audioProof)manifest.audioProof=prior.audioProof;manifest.snapshots=prior.snapshots.map(snapshot=>({...snapshot,phase:telemetry.find(row=>Math.abs(row.ms-snapshot.ms)<.01)?.phase??snapshot.phase}));manifest.harnessConfig=prior.harnessConfig??{recorded:false,note:'The original capture did not record its native memory-management setting.'};manifest.metadataReplay={harnessConfig:{gcInterval,exposeGc:typeof globalThis.gc==='function'},method:'Production cue callback installed before mountScene; exact same-source replay without rasterization. The original pixel clip remains unchanged. All per-frame transforms, amounts, strips, character states and credit timestamps match the original native clip manifest.',matchedFrames:frame};}
 if(!metadataOnly)manifest.capture={kind:stills?'frame-sequence':'movie',fromMs:captureFrom,toMs:Number.isFinite(captureTo)?captureTo:null,fps:stills?null:30/captureStride,sampleIntervalMs:stills?200:null,semanticPhaseFrames:stills,frames:stills?snapshots.length:capturedFrames,sourceFps:30};
 fs.writeFileSync(`${output}/${id}.json`,JSON.stringify(manifest,null,2)+'\n');scene.destroy();console.log(`${id}: ${frame} source frames / ${capturedFrames} movie frames, ${credits.length} credits, final WIN ${paid}`);
}
