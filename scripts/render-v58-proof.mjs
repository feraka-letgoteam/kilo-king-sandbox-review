/** Offline native-Canvas inspection of the production character painter and
 * actual feature display lists. Not a browser, WebGL/Pixi or live-game capture. */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'package.json'));
const {createCanvas,loadImage,GlobalFonts}=require('@napi-rs/canvas');
import {Container,Graphics,Sprite,Text} from './reel-renderer-mocks-v52.mjs';
import {loadProduction} from './kilo-v56-test-loader.mjs';
GlobalFonts.registerFromPath('public/kilo-ui-v11/fonts/SourceSans3-700.woff2','Source Sans 3');
GlobalFonts.registerFromPath('public/kilo-ui-v11/fonts/BarlowCondensed-600.woff2','Barlow Condensed');
const output='art/kilo-v58/proofs',temp='/workspace/scratch/6281bb86619d/v58-proof-frames';
fs.mkdirSync(output,{recursive:true});fs.mkdirSync(temp,{recursive:true});
const {STAGE_KING,stageKingFrameAt,paintStageKing}=loadProduction('src/components/kilo/stage-character-life.ts');
const body=await loadImage('public'+STAGE_KING.image),eyes=await loadImage('public'+STAGE_KING.blink.image),brow=await loadImage('public'+STAGE_KING.reaction.image);
const source=createCanvas(1024,1536),sourceCtx=source.getContext('2d'),actor=createCanvas(768,1152),actorCtx=actor.getContext('2d');
const sheet=createCanvas(1040,720),ctx=sheet.getContext('2d');
if(!process.argv.includes("--features-only")){
for(let i=0;i<270;i++){
 const time=i*1000/30,frame=stageKingFrameAt(time,time-5800);
 sourceCtx.clearRect(0,0,1024,1536);sourceCtx.drawImage(body,0,0);
 if(frame.blink!=='open'){
  const f=frame.blink==='brow'?STAGE_KING.reaction.frame:STAGE_KING.blink.frames[frame.blink],to=STAGE_KING.blink.imageTarget;
  sourceCtx.clearRect(to.x,to.y,to.width,to.height);sourceCtx.drawImage(frame.blink==='brow'?brow:eyes,f.x,f.y,f.width,f.height,to.x,to.y,to.width,to.height);
 }
 paintStageKing(actorCtx,source,frame);
 ctx.fillStyle='#071820';ctx.fillRect(0,0,1040,720);
 ctx.fillStyle='#fff4dc';ctx.font='700 23px "Source Sans 3"';ctx.fillText('KILO · FACING INTO THE STAGE',34,40);
 ctx.fillStyle='#adc6c7';ctx.font='16px "Source Sans 3"';ctx.fillText('Offline production Canvas painter · 30 fps · fixed feet / local breathing / registered face',34,68);
 ctx.strokeStyle='#b4995e';ctx.lineWidth=2;ctx.strokeRect(30,125,395,370);
 ctx.fillStyle='#c5d6d2';ctx.font='18px "Source Sans 3"';ctx.fillText('REEL SIDE',145,322);
 ctx.drawImage(actor,440,100,384,576);
 ctx.fillStyle='#adc6c7';ctx.font='15px "Source Sans 3"';ctx.fillText('PHONE SIZE',875,395);ctx.drawImage(actor,850,422,144,216);
 ctx.fillStyle='#fff4dc';ctx.fillText(time<5800?'Quiet idle · no per-spin body action':'One restrained earned-win nod',34,665);
 fs.writeFileSync(`${temp}/life-${String(i).padStart(4,'0')}.png`,await sheet.encode('png'));
 if([0,100,175,184].includes(i))fs.writeFileSync(`${output}/character-${i}.png`,await sheet.encode('png'));
}
execFileSync('ffmpeg',['-v','error','-y','-framerate','30','-i',`${temp}/life-%04d.png`,'-c:v','libx264','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',`${output}/character-life.mp4`]);
}
// Record the exact production Graphics calls, rather than maintaining a second
// hand-authored version of the VS/reel composition in the proof renderer.
for(const method of ['rect','roundRect','circle','ellipse','poly','moveTo','lineTo','fill','stroke']){
 Graphics.prototype[method]=function(...args){(this.ops??=[]).push([method,args]);return this;};
}
Graphics.prototype.clear=function(){this.ops=[];return this;};
const textures=new Map();
async function textureImage(url){const file=path.normalize('public'+url);if(!textures.has(file))textures.set(file,await loadImage(file));return textures.get(file);}
const {createReelFeatureEffects}=loadProduction('src/components/kilo/reel-feature-effects.ts');
const {ART,ART_ROOT}=loadProduction('src/components/kilo/art-map.ts');
const {Container:MockContainer,Sprite:MockSprite}=await import('./reel-renderer-mocks-v52.mjs');
const art=new Map();for(const [key,file]of Object.entries(ART)){const url=path.posix.normalize(ART_ROOT+file),image=await textureImage(url);art.set(key,{source:{url,width:image.width,height:image.height},width:image.width,height:image.height});}
const color=(n=0xffffff)=>typeof n==='string'?n:'#'+Number(n).toString(16).padStart(6,'0');
function pathOps(context,node,clip=false){
 let painted=false;context.beginPath();
 for(const [name,args]of node.ops??[]){
  if(name==='fill'||name==='stroke'){
   if(clip)continue;
   const opts=typeof args[0]==='object'?args[0]:{color:args[0]};context.save();context.globalAlpha*=opts.alpha??1;
   if(name==='fill'){context.fillStyle=color(opts.color);context.fill();}
   else{context.strokeStyle=color(opts.color);context.lineWidth=opts.width??1;context.stroke();}
   context.restore();painted=true;continue;
  }
  if(painted){context.beginPath();painted=false;}
  if(name==='rect')context.rect(...args);
  if(name==='roundRect')context.roundRect(...args);
  if(name==='circle')context.arc(args[0],args[1],args[2],0,Math.PI*2);
  if(name==='ellipse')context.ellipse(args[0],args[1],args[2],args[3],0,0,Math.PI*2);
  if(name==='moveTo')context.moveTo(...args);
  if(name==='lineTo')context.lineTo(...args);
  if(name==='poly'){const points=args[0];context.moveTo(points[0],points[1]);for(let n=2;n<points.length;n+=2)context.lineTo(points[n],points[n+1]);context.closePath();}
 }
 if(clip)context.clip();
}
async function drawNode(context,node,maskNodes){
 if(node.destroyed||node.visible===false||node.alpha<=0||maskNodes.has(node))return;
 context.save();context.translate(node.position.x,node.position.y);context.rotate(node.rotation??0);context.scale(node.scale.x,node.scale.y);context.translate(-node.pivot.x,-node.pivot.y);context.globalAlpha*=node.alpha??1;
 if(node.mask)pathOps(context,node.mask,true);
 if(node instanceof Graphics)pathOps(context,node);
 if(node instanceof Sprite){const tex=node.texture,source=tex.source??tex,url=source.url;if(url){const img=await textureImage(url),f=tex.frame??{x:0,y:0,width:img.width,height:img.height},w=node._width??f.width,h=node._height??f.height;context.drawImage(img,f.x,f.y,f.width,f.height,-(node.anchor?.x??0)*w,-(node.anchor?.y??0)*h,w,h);}}
 if(node instanceof Text){const size=node.style.fontSize;context.font=`${node.style.fontWeight??700} ${size}px "Source Sans 3"`;context.textAlign=node.anchor.x===.5?'center':node.anchor.x===1?'right':'left';context.textBaseline=node.anchor.y===.5?'middle':'top';if(node.style.stroke){context.strokeStyle=color(node.style.stroke.color);context.lineWidth=node.style.stroke.width;context.lineJoin='round';context.strokeText(String(node.text),0,0);}context.fillStyle=color(node.style.fill);context.fillText(String(node.text),0,0);}
 for(const child of node.children)await drawNode(context,child,maskNodes);context.restore();
}
function allMasks(root){const set=new Set();const walk=n=>{if(n.mask)set.add(n.mask);n.children.forEach(walk);};walk(root);return set;}
const examples=JSON.parse(fs.readFileSync('art/kilo-features-v54/replay-examples.json'));
for(const test of ['yacht','getaway-max','getaway-loss']){
 const round=examples[test],event=test==='yacht'?round.free.find(s=>s.mechanic.reel.conversions.length).mechanic:round.free[0].mechanic;
 for(const cell of [64,156]){
  const gap=2,g={gx:4,gy:4,cell,gap},width=cell*5+gap*4+8,height=cell*3+8,world=new Container(),host=new EventTarget();let frame=0,time=0,currentGrid=test==='yacht'?round.free.find(s=>s.mechanic===event).grid:round.free[0].grid;
  const surface=createCanvas(width,height+48),c=surface.getContext('2d');
  const save=async label=>{
   c.fillStyle='#06141c';c.fillRect(0,0,width,height+48);
   for(let col=0;col<5;col++)for(let row=0;row<3;row++){
    const cellArt=currentGrid[col][row],texture=art.get(cellArt.s),image=await textureImage(texture.source.url);
    c.drawImage(image,g.gx+col*(cell+gap),g.gy+row*cell,cell,cell);
   }
   await drawNode(c,world,allMasks(world));
   c.fillStyle='#d7e0da';c.font='13px "Source Sans 3"';c.textAlign='left';c.textBaseline='top';c.fillText(`${test} · offline display-list proof`,6,height+7);c.fillText(label,6,height+25);
   fs.writeFileSync(`${temp}/${test}-${cell}-${String(frame++).padStart(4,'0')}.png`,await surface.encode('png'));
  };
  globalThis.document={body:{appendChild(){}},createElement:()=>({style:{},offsetHeight:28,remove(){}})};
  const ctl=createReelFeatureEffects({host,world,geom:()=>g,cell:(symbol,size)=>{const group=new MockContainer(),sprite=new MockSprite(art.get(symbol.s));sprite.width=size;sprite.height=size;group.addChild(sprite);return group;},show:grid=>{currentGrid=grid;},stake:()=>round.stake,pace:()=>({speed:'normal',reduced:false}),live:()=>true,
   collect:async()=>{},highlight:async(lines,cb)=>{for(const l of lines)cb(l);},readout(){},screen:(x,y)=>({x,y}),landing:()=>({x:width/2,y:height+20}),bankCue(){},
   hold:async ms=>{for(let i=0;i<Math.max(1,Math.round(ms/1000*30));i++)await save('hold');time+=ms;},
   tween:async(ms,paint)=>{const frames=Math.max(1,Math.round(ms/1000*30));for(let n=0;n<=frames;n++){paint(n/frames);await save(`${Math.round(time+ms*n/frames)} ms`);}time+=ms;}
  });
  ctl.set(event,'before');await ctl.step(event,{award(){},state(){}});ctl.set(event,'after');await save('settled recorded state');
  const picks=test==='yacht'?[10,24,36,frame-1]:[16,30,47,frame-1];
  for(const n of picks){const from=`${temp}/${test}-${cell}-${String(n).padStart(4,'0')}.png`;if(fs.existsSync(from))fs.copyFileSync(from,`${output}/${test}-${cell}-${n}.png`);}
  execFileSync('ffmpeg',['-v','error','-y','-framerate','30','-i',`${temp}/${test}-${cell}-%04d.png`,'-vf','pad=ceil(iw/2)*2:ceil(ih/2)*2','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',`${output}/${test}-${cell}.mp4`]);
  ctl.destroy();
 }
}
fs.writeFileSync(`${output}/README.md`,'These are offline native-Canvas proofs using the actual production character painter and recorded production Pixi display lists. They are not browser screenshots or a GPU-rendered gameplay recording.\n');
console.log('Wrote character, VS and both Max outcomes at desktop/phone artwork sizes.');
