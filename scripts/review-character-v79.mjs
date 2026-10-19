/** Native production painters at their game scale, for asset registration review. */
import fs from 'node:fs';
import {createOfflineRuntime,createCanvas,textureImage,drawNode,allMasks} from './offline-runtime-v77.mjs';
const runtime=createOfflineRuntime(),load=runtime.load;
const {STAGE_KING,stageKingFrameAt,paintStageKing}=load('src/components/kilo/stage-character-life.ts');
const {createVsGroupArt,vsGroupArtUrl}=load('src/components/kilo/vs-group-art.ts');
const body=await textureImage(STAGE_KING.image),eyes=await textureImage(STAGE_KING.blink.image),brow=await textureImage(STAGE_KING.reaction.image);
const out='art/kilo-v79/characters',sheet=createCanvas(1280,700),ctx=sheet.getContext('2d');
ctx.fillStyle='#102831';ctx.fillRect(0,0,1280,700);
for(const [i,[label,elapsed,reaction,kind]]of [['Idle',0,Infinity,'win'],['Breath',1900,Infinity,'win'],['Feature reaction',220,220,'max-stop'],['Closed blink',3370,Infinity,'win']].entries()){
 const frame=stageKingFrameAt(elapsed,reaction,false,kind),face=createCanvas(1024,1536),f=face.getContext('2d');f.drawImage(body,0,0);
 if(frame.blink!=='open'){const a=frame.blink==='brow'?STAGE_KING.reaction.frame:STAGE_KING.blink.frames[frame.blink],to=STAGE_KING.blink.imageTarget;f.clearRect(to.x,to.y,to.width,to.height);f.drawImage(frame.blink==='brow'?brow:eyes,a.x,a.y,a.width,a.height,to.x,to.y,to.width,to.height);}
 const actor=createCanvas(768,1152);paintStageKing(actor.getContext('2d'),face,frame,false);
 ctx.drawImage(actor,i*320+20,30,280,420);ctx.fillStyle='#fff4dc';ctx.font='600 18px "VS Display"';ctx.fillText(label,i*320+20,25);
 ctx.drawImage(actor,i*320+95,485,110,165);
}
fs.writeFileSync(`${out}/stage-king-registration.webp`,await sheet.encode('webp',93));
const cards=createCanvas(1950,550),c=cards.getContext('2d');c.fillStyle='#102831';c.fillRect(0,0,1950,550);
for(const [row,side]of ['king','vice'].entries())for(let width=1;width<=5;width++){
 const group={id:`${side}-${width}`,side,width,start:0,reels:Array.from({length:width},(_,i)=>i),members:[],multiplier:[4,12,120,600,6000][width-1]};
 const cell=68,gap=4,art=createVsGroupArt(group,{gx:0,gy:0,cell,gap},await runtime.pixi.Assets.load(vsGroupArtUrl(group)));
 const w=width*cell+(width-1)*gap;art.position.set((width-1)*390+(390-w)/2,row*275+35);await drawNode(c,art,allMasks(art));
 c.fillStyle='#fff4dc';c.font='600 15px "VS Display"';c.fillText(`${side} · ${width} reels · native phone size`,(width-1)*390+12,row*275+20);
}
fs.writeFileSync(`${out}/vs-widths-phone.webp`,await cards.encode('webp',94));
console.log('Saved native character and VS width art reviews. Not a browser capture.');
