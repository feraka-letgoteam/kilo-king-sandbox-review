/** Native offline capture of production mountScene + feature controllers.
 * This is silent CPU Canvas evidence, not browser/WebGL or the React control UI. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {createOfflineRuntime,createCanvas,textureImage,drawNode,allMasks,findAll,walk} from './offline-runtime-v79.mjs';
import {sourceFingerprint as fingerprint} from './v79-source-fingerprint.mjs';
const proofVersion=process.env.KILO_PROOF_VERSION??'v79';
const output=process.env.KILO_PROOF_OUTPUT??'art/kilo-v79/proofs';fs.mkdirSync(output,{recursive:true});
const seeded=seed=>()=>{seed|=0;seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};
const sourceFingerprint=fingerprint();
const gcInterval=Math.max(1,Number(process.env.KILO_PROOF_GC_INTERVAL??1));
const captureStride=Math.max(1,Number(process.env.KILO_PROOF_CAPTURE_STRIDE??1));
const captureFrom=Number(process.env.KILO_PROOF_CAPTURE_FROM_MS??0),captureTo=Number(process.env.KILO_PROOF_CAPTURE_TO_MS??Infinity);
assert([1,2,3].includes(captureStride),'Capture stride is 1, 2 or 3');
const fixturesRuntime=createOfflineRuntime(),math=fixturesRuntime.load('src/lib/kilo/reel-feature-math.ts');
function fixture(kind,target){
 if(kind==='collection'){const round=fixturesRuntime.load('src/lib/kilo/fixtures.json')['tool-bazooka'].script;return{seed:null,index:15,round,spin:round.free[15],previousTotal:0};}
 if(kind==='chopper'){for(let seed=1;seed<200;seed++){const round=math.runReelFeature('route',1000,seeded(seed),25000000);for(const[index,spin]of round.free.entries())if(spin.mechanic.reel.cascades.length>=2)return{seed,index,round,spin,previousTotal:0};}}

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
const cases=[['collection',fixture('collection')],['chopper',fixture('chopper')],['base-spin',fixture('base')],['entry-dock',fixture('entry-dock')],['entry-vs',fixture('entry-vs')],['god-full',fixture('getaway','full')],['god-early-loss',fixture('getaway','early')],['god-late-overshoot',fixture('getaway','late')],['vs-pair',fixture('yacht',2)],['vs-wide',fixture('yacht',3)],['vs-five',fixture('yacht',5)]];
const sizes=[[1440,900],[390,844]],selectedCase=process.env.KILO_PROOF_CASE,selectedSize=process.env.KILO_PROOF_SIZE,stills=process.env.KILO_PROOF_STILLS==='1',metadataOnly=process.env.KILO_PROOF_METADATA_ONLY==='1';
for(const[name,example]of cases)for(const[vw,vh]of sizes){
 const isGod=name.startsWith('god'),isVS=name.startsWith('vs-'),isEntry=name.startsWith('entry-'),isBase=name==='base-spin',isCollection=name==='collection',isChopper=name==='chopper';
 if(selectedCase&&name!==selectedCase)continue;if(selectedSize&&selectedSize!==`${vw}x${vh}`)continue;
 if(!selectedCase&&!['collection','chopper','base-spin','entry-dock','entry-vs','god-full','god-early-loss','god-late-overshoot','vs-five'].includes(name))continue;
 const existingId=`${name}-${vw}x${vh}`,existingManifest=`${output}/${existingId}.json`,existingClip=`${output}/${existingId}.mp4`;
 if(stills&&!metadataOnly&&process.env.KILO_PROOF_REUSE==='1'&&fs.existsSync(existingManifest)){
   const prior=JSON.parse(fs.readFileSync(existingManifest,'utf8'));
   if(prior.sourceFingerprint===sourceFingerprint&&prior.capture?.kind==='frame-sequence'&&prior.capture.frames===prior.snapshots.length&&prior.snapshots.length>5&&prior.snapshots.every(frame=>fs.existsSync(`${output}/${frame.file}`)&&fs.statSync(`${output}/${frame.file}`).size>1000)){
     console.log(`Reused complete frozen-source frame sequence ${existingId}`);continue;
   }
 }
 if(!metadataOnly&&process.env.KILO_PROOF_REUSE==='1'&&fs.existsSync(existingManifest)&&fs.existsSync(existingClip)){const prior=JSON.parse(fs.readFileSync(existingManifest,'utf8'));if(prior.sourceFingerprint===sourceFingerprint){const metadata=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate,nb_frames','-of','json',existingClip],{encoding:'utf8'})).streams[0];if(metadata.width===vw&&metadata.height===vh&&metadata.r_frame_rate===`${prior.capture?.fps??30}/1`&&Number(metadata.nb_frames)===(prior.capture?.frames??prior.frames)){console.log(`Reused verified ${existingId}`);continue;}}}
 const prior=metadataOnly?JSON.parse(fs.readFileSync(existingManifest,'utf8')):null;
 if(metadataOnly)assert.equal(prior.sourceFingerprint,sourceFingerprint,'replay uses the clip frozen build');
 const cues=[];let cuePhase='idle';
 const runtime=createOfflineRuntime(),{load,pixi}=runtime;
 runtime.window.innerWidth=vw;runtime.window.innerHeight=vh;
 const sound=load('src/lib/kilo/sound.ts'),oldCue=sound.featureCue;sound.featureCue=name=>{cues.push({name,ms:runtime.clock});cuePhase=name;oldCue(name);};
 const {fitGameLayout}=load('src/components/kilo/layout.ts'),{createControlLayout}=load('src/components/slot-controls/layout.ts');
 const {integratedSceneCamera}=load('src/components/kilo/integrated-scene-model.ts'),{sceneActorBox}=load('src/components/kilo/RiggedSceneActor.tsx');
 const {paintFeatureEnvironment}=load('src/components/kilo/feature-environment-painter.ts'),{featureEnvironmentUrl}=load('src/components/kilo/feature-environments.ts'),{ATMOSPHERE_URLS}=load('src/components/kilo/feature-atmosphere.ts');
 const {STAGE_KING,createStageKingPlayback,paintStageKing}=load('src/components/kilo/stage-character-life.ts');
 const portrait=vw<900,pad=portrait?12:24,l=fitGameLayout(vw-pad*2,vh-pad*2),shellX=(vw-l.width)/2,ox=shellX+l.artLeft,oy=l.header;
 const layout=createControlLayout({variant:portrait?'portrait':'desktop',width:portrait?l.reelWidth:Math.max(800,l.reelWidth),height:l.dock});
 const dockX=(vw-layout.width)/2,dockY=oy+l.reelHeight,win={x:dockX+layout.win.x,y:dockY+layout.win.y,w:layout.win.w,h:layout.win.h};
 const host=runtime.host(Math.round(l.reelWidth),Math.round(l.reelHeight),ox,oy,win),scene=await load('src/components/kilo/pixiStage.ts').mountScene(host),stage=runtime.apps[0].stage;
 const camera=integratedSceneCamera(l,{stageSize:{width:vw-pad*2,height:vh-pad*2},sourceSize:portrait?{width:1080,height:2400}:{width:1920,height:1080}}),box=sceneActorBox(camera.master,portrait);
 const mode=isGod?'max-win':isBase?'base':name==='entry-dock'||isCollection?'scatter-3':isChopper?'chopper':'scatter-4',background=await textureImage(featureEnvironmentUrl(mode,portrait));
 const atmosphere=Object.fromEntries(await Promise.all(Object.entries(ATMOSPHERE_URLS).map(async([key,url])=>[key,await textureImage(url)])));
 const actorImage=await textureImage(STAGE_KING.image),eyes=await textureImage(STAGE_KING.blink.image),brow=await textureImage(STAGE_KING.reaction.image),actor=createCanvas(768,1152),ac=actor.getContext('2d'),face=createCanvas(1024,1536),fc=face.getContext('2d');
 const actorPlayback=createStageKingPlayback();actorPlayback.advance(18000);let actorTime=0,actionId=0,lastFace='';
 const quality=Math.min(1,Math.sqrt(650000/(camera.width*camera.height))),bg=createCanvas(Math.round(camera.width*quality),Math.round(camera.height*quality)),bc=bg.getContext('2d'),canvas=createCanvas(vw,vh),c=canvas.getContext('2d');
 const event=isBase||isEntry||isCollection?null:example.spin.mechanic,id=`${name}-${vw}x${vh}`,file=`${output}/${id}.mp4`,reactions=[],telemetry=[],phases=[],snapshots=[],credits=[],bankEvents=[];let paid=example.previousTotal,frame=0,capturedFrames=0,lastPhase='',lastSnap='',isSpinning=false,normalSpinCalls=0,previousSamplePhase='';
 if(!metadataOnly)for(const previous of fs.readdirSync(output))if(previous.startsWith(id+'-')||previous===id+'.json'||previous===id+'.mp4')fs.unlinkSync(output+'/'+previous);
 host.addEventListener('kilo-stage-action',e=>{const kind=e.detail.kind;actorPlayback.react(`${kind}:${++actionId}`,kind);reactions.push({kind,ms:runtime.clock});});
 host.addEventListener('kilo-collection',e=>{if(!isCollection||!e.detail)return;cuePhase=e.detail.phase;if(e.detail.phase==='bank'){paid=e.detail.completed;credits.push({value:paid,ms:runtime.clock-start});bankEvents.push({value:paid,ms:runtime.clock});}});
 host.addEventListener('kilo-earned-win',e=>bankEvents.push({value:e.detail.visibleAward,ms:runtime.clock}));
 const ff=stills||metadataOnly?null:spawn('ffmpeg',['-v','error','-y','-f','image2pipe','-framerate',String(30/captureStride),'-i','pipe:0','-c:v','libx264','-threads','2','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',file],{stdio:['pipe','inherit','inherit']}),finished=ff?once(ff,'exit'):null;
 const text=(value,x,y,size,color='#fff8e9')=>{c.font=`700 ${size}px "Source Sans 3"`;c.textAlign='center';c.textBaseline='middle';c.fillStyle=color;c.fillText(String(value),x,y);};
 const start=runtime.clock;
 async function capture(){
  if(frame%gcInterval===0){await new Promise(resolve=>setImmediate(resolve));globalThis.gc?.();await new Promise(resolve=>setImmediate(resolve));}
  const samplePhase=(host.dataset.maxPhase??host.dataset.collectStep??cuePhase)+':'+(host.dataset.maxSegment??'');const phaseChanged=samplePhase!==previousSamplePhase;previousSamplePhase=samplePhase;
  if(stills&&!metadataOnly&&frame%6!==0&&!phaseChanged){frame++;return;}
  const elapsed=runtime.clock-start,actorFrame=actorPlayback.advance(runtime.clock-actorTime);actorTime=runtime.clock;
  if(isEntry)walk(stage,node=>{if(typeof node.text==='string')assert(!/undefined|NaN/.test(node.text),'Feature-entry fixture must include the full production round metadata');});
  const raster=!metadataOnly&&frame%captureStride===0&&elapsed>=captureFrom&&elapsed<=captureTo;
  const travellers=runtime.document.body.children.filter(el=>['kk-feature-transfer','kk-award-fly'].includes(el.className));
  if(raster){
  c.globalAlpha=1;c.fillStyle='#06131b';c.fillRect(0,0,vw,vh);paintFeatureEnvironment(bc,background,mode,portrait,bg.width,bg.height,18000+elapsed,false,atmosphere);c.drawImage(bg,shellX+camera.left,camera.top,camera.width,camera.height);
  if(lastFace!==actorFrame.blink){lastFace=actorFrame.blink;fc.clearRect(0,0,1024,1536);fc.drawImage(actorImage,0,0);if(actorFrame.blink!=='open'){const f=actorFrame.blink==='brow'?STAGE_KING.reaction.frame:STAGE_KING.blink.frames[actorFrame.blink],to=STAGE_KING.blink.imageTarget;fc.clearRect(to.x,to.y,to.width,to.height);fc.drawImage(actorFrame.blink==='brow'?brow:eyes,f.x,f.y,f.width,f.height,to.x,to.y,to.width,to.height);}}
  paintStageKing(ac,face,actorFrame,false);c.drawImage(actor,shellX+camera.left+box.left*camera.scale,camera.top+box.top*camera.scale,box.width*camera.scale,box.height*camera.scale);
  c.save();c.translate(ox,oy);await drawNode(c,stage,allMasks(stage));c.restore();
  for(const el of host.children.filter(e=>e.className==='kk-stage-readout'&&!e.hidden)){
    const x=ox+parseFloat(el.style.left),y=oy+parseFloat(el.style.top),w=parseFloat(el.style.width),h=parseFloat(el.style.height);
    const [caption,value]=el.children;const cs=parseFloat(el.style.fontSize),vs=parseFloat(value.style.fontSize);c.fillStyle='#061920';c.fillRect(x,y,w,h);c.strokeStyle='#937d4e';c.strokeRect(x,y,w,h);
    c.font=`600 ${cs}px "Source Sans 3"`;const cw=c.measureText(caption.textContent).width;c.font=`750 ${vs}px "Source Sans 3"`;const vw=c.measureText(value.textContent).width;const left=x+(w-cw-vw-10)/2;text(caption.textContent,left+cw/2,y+h/2,cs,'#c6dcd8');text(value.textContent,left+cw+10+vw/2,y+h/2,vs);
  }
  c.fillStyle='#01070b';c.strokeStyle='#8b794e';c.lineWidth=2;c.beginPath();c.roundRect(win.x,win.y,win.w,win.h,7);c.fill();c.stroke();text('WIN',win.x+win.w/2,win.y+12,14,'#b8c9c7');text(paid.toLocaleString('en-US'),win.x+win.w/2,win.y+win.h*.67,portrait?20:28);
  for(const el of travellers){if(!el.style.left)continue;c.globalAlpha=Number(el.style.opacity??1);const size=parseFloat(el.style.fontSize??'')||Math.max(20,Math.min(32,vw*.03)),x=parseFloat(el.style.left),y=parseFloat(el.style.top);c.font=`800 ${size}px "Source Sans 3"`;c.textAlign='center';c.textBaseline='middle';c.fillStyle='#021019';c.fillText(el.textContent,x,y+2);c.fillText(el.textContent,x-1,y);c.fillText(el.textContent,x+1,y);c.fillStyle='#fff4cf';c.fillText(el.textContent,x,y);c.globalAlpha=1;}
  }
  const card=findAll(stage,'god-full-window-card')[0],groups=findAll(stage,'vs-group-art'),phase=host.dataset.maxPhase??(isSpinning?'ordinary-reel-spin':cuePhase);
  const strips=stage.children[0].children.filter(n=>n.mask&&n.children.length===2&&n.children[0]===n.mask).sort((a,b)=>a.x-b.x).map(n=>n.children[1]);
  const row={frame,ms:elapsed,phase,isSpinning,segment:host.dataset.maxSegment?Number(host.dataset.maxSegment):undefined,card:card?.godCard?{...card.godCard}:undefined,stripVisibility:strips.map(n=>n.visible),stripCellCounts:strips.map(n=>n.children.length),stripOffsets:strips.map(n=>n.y),groups:groups.map(g=>({reels:g.vsGroup.reels,side:g.vsGroup.side,multiplier:g.vsGroup.multiplier,number:g.children.filter(n=>n.label==='vs-group-multiplier').map(n=>({text:n.text,size:n.style.fontSize,scale:n.scale.x,alpha:n.alpha}))})),paid,travellers:travellers.map(e=>({...e.style,text:e.textContent})),actor:actorFrame};telemetry.push(row);
  assert.equal(strips.length,5,'proof executes five actual production reel strips');
  if(isGod||isBase||isEntry){assert(row.stripVisibility.every(Boolean),'God never hides real reel strips');assert(row.stripCellCounts.every(n=>n>=3),'God never empties the board');}
  else if(isVS){
    for(const group of groups)assert(group.vsGroup.reels.every(reel=>strips[reel].visible===false),'no symbols visible under any VS art');
    for(const wild of event.reel.before)assert(groups.some(group=>group.alpha>.001&&group.vsGroup.reels.includes(wild.reel)),'Existing VS art stays visible across the encounter-to-merge handoff');
  }
  if(phase!==lastPhase){phases.push({phase,ms:elapsed,segment:row.segment});lastPhase=phase;}
  const snapKey=card?`${phase}:${row.segment}`:groups.map(g=>`${g.vsGroup.side}:${g.vsGroup.width}`).join('|')+':'+phase;
  if(raster&&(stills||frame%3===0)&&(snapKey!==lastSnap||stills||frame%12===0)){lastSnap=snapKey;const filename=`${id}-f${String(frame).padStart(4,'0')}.webp`;fs.writeFileSync(`${output}/${filename}`,await canvas.encode('webp',90));snapshots.push({file:filename,ms:elapsed,phase,segment:row.segment});}
  if(raster){c.fillStyle='#06131b';c.fillRect(0,vh-52,vw,52);text(`${proofVersion} · ${name} · ${vw}×${vh}`,vw/2,vh-36,portrait?12:15,'#e2bd77');text('Silent offline production renderer · WIN harness · not browser/WebGL',vw/2,vh-15,portrait?9:12,'#9fbabc');}
  if(ff&&raster){const png=await canvas.encode('png');if(!ff.stdin.write(png))await once(ff.stdin,'drain');capturedFrames++;}frame++;
  if(frame%30===0){const memoryFile='/sys/fs/cgroup/memory.stat',stat=fs.existsSync(memoryFile)?Object.fromEntries(fs.readFileSync(memoryFile,'utf8').trim().split('\n').map(line=>line.split(' '))):{};console.log(`${id}: frame ${frame}, RSS ${Math.round(process.memoryUsage().rss/1048576)}MiB${stat.anon?`, cgroup anon ${Math.round(Number(stat.anon)/1048576)}MiB`:''}`);}
 }
 scene.setStake(1000);scene.setPace(false,false,'normal');scene.show(example.spin.grid);scene.setFeatureState(event,'before');
 // Prime one source-native still before any feature overlay to prove populated reels.
 await capture();for(let i=0;i<9;i++){await runtime.tick(1000/30);await capture();}
 if(isGod||isBase){isSpinning=true;normalSpinCalls++;await runtime.drive(scene.spinTo(isGod?event.reel.finalGrid:example.spin.grid,null,'ordinary'),{step:1000/30,onFrame:capture});isSpinning=false;}
 if(isBase){
  await runtime.drive(scene.highlight(example.spin.lines,(line)=>{paid+=line.pay;credits.push({value:line.pay,ms:runtime.clock-start});}),{step:1000/30,onFrame:capture});
 }else if(isCollection){
  await runtime.drive(scene.collect(example.spin),{step:1000/30,onFrame:capture});
  assert.equal(paid,48000,'Recorded two-collector acceptance fixture');
 }else if(isEntry){
  cuePhase='feature-entry';await runtime.drive(name==='entry-vs'?scene.featureIntro(example.round):scene.intro(example.round),{step:1000/30,onFrame:capture});cuePhase='entry-complete';
 }else{
  const promise=scene.reelFeatureStep(event,{award:value=>{paid+=value;credits.push({value,ms:runtime.clock-start});},state(){}});
  await runtime.drive(promise,{step:1000/30,onFrame:capture});scene.show(event.reel.finalGrid);scene.setFeatureState(event,'after');
 }
 for(let i=0;i<24;i++){await runtime.tick(1000/30);await capture();}
 if(ff){ff.stdin.end();const[code]=await finished;if(code!==0)throw Error('Encoder failed '+id);}
 if(event){assert.equal(paid-example.previousTotal,event.credited,'proof awards the recorded amount exactly');assert.deepEqual(credits.map(c=>c.value),bankEvents.map(e=>e.value),'one WIN update for each source-owned transfer');}
 if(isBase)assert.equal(paid,example.spin.lines.reduce((sum,line)=>sum+line.pay,0),'Base line credits come from actual recorded lines');
 if(isEntry)assert.equal(credits.length,0,'Entry artwork never credits an award');
 if(isGod||isBase){assert.equal(normalSpinCalls,1);assert(telemetry.some(row=>row.isSpinning&&row.stripOffsets.some(y=>Math.abs(y)>1)),'actual production reel strip movement captured');}
 if(sourceFingerprint!==fingerprint())throw Error('Production changed during proof capture; re-run this case from the frozen source.');
 const manifest={id,sourceFingerprint,harnessConfig:{recorded:true,gcInterval,exposeGc:typeof globalThis.gc==='function'},method:'Actual production mountScene, source-native cells, feature controller, geometry, environment painter and character painter, instrumented Pixi rasterized to CPU Canvas. Silent. WIN target harness only. Not browser/WebGL or complete React UI.',viewport:[vw,vh],fps:30,frames:frame,durationMs:runtime.clock-start,normalSpinCalls,fixture:{seed:example.seed,index:example.index,stake:1000,previousTotal:example.previousTotal,event,baseGrid:isBase||isEntry?example.spin.grid:undefined},finalWin:paid,credits,bankEvents,reactions,cues,phases,snapshots,telemetry};
 if(metadataOnly){assert.equal(frame,prior.frames);assert.deepEqual(credits,prior.credits);assert.deepEqual(bankEvents,prior.bankEvents);assert.deepEqual(reactions,prior.reactions);const semantic=row=>{const{phase,...rest}=row;return JSON.parse(JSON.stringify(rest));};assert.deepEqual(telemetry.map(semantic),prior.telemetry.map(semantic),'cue replay exactly matches every captured source transform, amount, visibility and travelling value');manifest.snapshots=prior.snapshots.map(snapshot=>({...snapshot,phase:telemetry.find(row=>Math.abs(row.ms-snapshot.ms)<.01)?.phase??snapshot.phase}));manifest.harnessConfig=prior.harnessConfig??{recorded:false,note:'The original capture did not record its native memory-management setting.'};manifest.metadataReplay={harnessConfig:{gcInterval,exposeGc:typeof globalThis.gc==='function'},method:'Production cue callback installed before mountScene; exact source replay without rasterization. All per-frame transforms, amounts, strips, character states and credit timestamps match the original native clip manifest.',matchedFrames:frame};}
 if(!metadataOnly)manifest.capture={kind:stills?'frame-sequence':'movie',fromMs:captureFrom,toMs:Number.isFinite(captureTo)?captureTo:null,fps:stills?null:30/captureStride,sampleIntervalMs:stills?200:null,semanticPhaseFrames:stills,frames:stills?snapshots.length:capturedFrames,sourceFps:30};
 fs.writeFileSync(`${output}/${id}.json`,JSON.stringify(manifest,null,2)+'\n');scene.destroy();console.log(`${id}: ${frame} source frames / ${capturedFrames} movie frames, ${credits.length} credits, final WIN ${paid}`);
}
