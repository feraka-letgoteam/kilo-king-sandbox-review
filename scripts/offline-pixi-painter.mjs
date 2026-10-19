/** Offline rasterizer for instrumented production Pixi display lists. No browser/GPU. */
import path from 'node:path';
import {createRequire} from 'node:module';
import {Container,Graphics,Sprite,Text} from './reel-renderer-mocks-v52.mjs';
const require=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'package.json') : import.meta.url);
const {createCanvas,loadImage,GlobalFonts}=require('@napi-rs/canvas');
GlobalFonts.registerFromPath('public/kilo-ui-v11/fonts/SourceSans3-700.woff2','Source Sans 3');
GlobalFonts.registerFromPath('public/kilo-ui-v11/fonts/SourceSans3-600.woff2','VS Display');
GlobalFonts.registerFromPath('public/kilo-ui-v11/KiloDisplay.woff','Kilo Win');
for(const method of ['rect','roundRect','circle','ellipse','poly','moveTo','lineTo','quadraticCurveTo','fill','stroke']){
 Graphics.prototype[method]=function(...args){(this.ops??=[]).push([method,args]);return this;};
}
Graphics.prototype.clear=function(){this.ops=[];return this;};
const textures=new Map();
const meshSurfaces=new WeakMap();
async function textureImage(url){const file=path.normalize('public'+url);if(!textures.has(file))textures.set(file,await loadImage(file));return textures.get(file);}




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
  if(name==='quadraticCurveTo')context.quadraticCurveTo(...args);
  if(name==='poly'){const points=args[0];context.moveTo(points[0],points[1]);for(let n=2;n<points.length;n+=2)context.lineTo(points[n],points[n+1]);context.closePath();}
 }
 if(clip)context.clip();
}
async function drawNode(context,node,maskNodes){
 if(node.destroyed||node.visible===false||node.alpha<=0||maskNodes.has(node))return;
 context.save();context.translate(node.position.x,node.position.y);context.rotate(node.rotation??0);context.scale(node.scale.x,node.scale.y);context.translate(-node.pivot.x,-node.pivot.y);context.globalAlpha*=node.alpha??1;
 if(node.mask){
  // Pixi masks are evaluated in the mask object's world space. Applying the
  // path in the sprite's already-transformed space clipped bottom-anchored
  // artwork away in offline proofs, even though its live mask is a sibling.
  const before=context.getTransform(),n=worldMatrix(node),m=worldMatrix(node.mask),det=n[0]*n[3]-n[1]*n[2];
  if(Math.abs(det)>1e-10){
   const inv=[n[3]/det,-n[1]/det,-n[2]/det,n[0]/det,(n[2]*n[5]-n[3]*n[4])/det,(n[1]*n[4]-n[0]*n[5])/det];
   const relative=multiply(inv,m);context.transform(...relative);pathOps(context,node.mask,true);
   context.setTransform(before.a,before.b,before.c,before.d,before.e,before.f);
  }
 }
 if(node instanceof Graphics)pathOps(context,node);
 if(node._offlineMesh){
  const tex=node.texture,source=tex.source??tex,url=source.url;
  if(url){
   const img=await textureImage(url),f=tex.frame??{x:0,y:0,width:img.width,height:img.height};
   const transform=context.getTransform(),quality=2*Math.max(Math.hypot(transform.a,transform.b),Math.hypot(transform.c,transform.d),.001);
   const xs=Array.from(node.vertices).filter((_,i)=>i%2===0),ys=Array.from(node.vertices).filter((_,i)=>i%2===1);
   const left=Math.min(...xs)-1/quality,top=Math.min(...ys)-1/quality;
   const width=Math.max(...xs)-left+1/quality,height=Math.max(...ys)-top+1/quality;
   const raster=meshSurfaces.get(node)??createCanvas(1,1);meshSurfaces.set(node,raster);
   const rw=Math.max(1,Math.ceil(width*quality)),rh=Math.max(1,Math.ceil(height*quality));
   if(raster.width!==rw||raster.height!==rh){raster.width=rw;raster.height=rh;}
   const paint=raster.getContext('2d');paint.setTransform(1,0,0,1,0,0);paint.clearRect(0,0,rw,rh);
   paint.setTransform(quality,0,0,quality,-left*quality,-top*quality);
   // Rasterize the material at opaque local alpha, then composite its parent
   // opacity ONCE. Per-triangle parent alpha creates a false tessellation grid.
   const overlap=.7/quality,padding=overlap*2+1;
   for(let i=0;i<node.indices.length;i+=3){
    const ids=Array.from(node.indices.slice(i,i+3));
    const s=ids.map(j=>({x:f.x+node.uvs[j*2]*f.width,y:f.y+node.uvs[j*2+1]*f.height}));
    const d=ids.map(j=>({x:node.vertices[j*2],y:node.vertices[j*2+1]}));
    const sx1=s[1].x-s[0].x,sy1=s[1].y-s[0].y,sx2=s[2].x-s[0].x,sy2=s[2].y-s[0].y;
    const dx1=d[1].x-d[0].x,dy1=d[1].y-d[0].y,dx2=d[2].x-d[0].x,dy2=d[2].y-d[0].y,det=sx1*sy2-sx2*sy1;
    if(Math.abs(det)<1e-9)continue;
    const a=(dx1*sy2-dx2*sy1)/det,b=(dy1*sy2-dy2*sy1)/det,cc=(sx1*dx2-sx2*dx1)/det,dd=(sx1*dy2-sx2*dy1)/det;
    const e=d[0].x-a*s[0].x-cc*s[0].y,ff=d[0].y-b*s[0].x-dd*s[0].y;
    paint.save();paint.beginPath();
    const mx=d.reduce((n,p)=>n+p.x,0)/3,my=d.reduce((n,p)=>n+p.y,0)/3;
    d.forEach((p,j)=>{const radius=Math.hypot(p.x-mx,p.y-my)||1,x=p.x+(p.x-mx)*overlap/radius,y=p.y+(p.y-my)*overlap/radius;j?paint.lineTo(x,y):paint.moveTo(x,y);});
    paint.closePath();paint.clip();paint.transform(a,b,cc,dd,e,ff);
    const x=Math.max(f.x,Math.min(...s.map(p=>p.x))-padding),y=Math.max(f.y,Math.min(...s.map(p=>p.y))-padding);
    const w=Math.min(f.x+f.width,Math.max(...s.map(p=>p.x))+padding)-x,h=Math.min(f.y+f.height,Math.max(...s.map(p=>p.y))+padding)-y;
    paint.drawImage(img,x,y,w,h,x,y,w,h);paint.restore();
   }
   context.drawImage(raster,left,top,rw/quality,rh/quality);
  }
 }

 if(node instanceof Sprite){const tex=node.texture,source=tex.source??tex,url=source.url;if(url){const img=await textureImage(url),f=tex.frame??{x:0,y:0,width:img.width,height:img.height},w=node._width??f.width,h=node._height??f.height;context.drawImage(img,f.x,f.y,f.width,f.height,-(node.anchor?.x??0)*w,-(node.anchor?.y??0)*h,w,h);}}
 if(node instanceof Text){const size=node.style.fontSize,family=['VS Display','Kilo Win'].includes(node.style.fontFamily)?node.style.fontFamily:'Source Sans 3';context.font=`${node.style.fontWeight??700} ${size}px "${family}"`;context.textAlign=node.anchor.x===.5?'center':node.anchor.x===1?'right':'left';context.textBaseline=node.anchor.y===.5?'middle':'top';if(node.style.dropShadow){const d=node.style.dropShadow;context.save();context.globalAlpha*=d.alpha??1;context.fillStyle=color(d.color);context.fillText(String(node.text),Math.cos(d.angle??0)*(d.distance??0),Math.sin(d.angle??0)*(d.distance??0));context.restore();}if(node.style.stroke){context.strokeStyle=color(node.style.stroke.color);context.lineWidth=node.style.stroke.width;context.lineJoin='round';context.strokeText(String(node.text),0,0);}context.fillStyle=color(node.style.fill);context.fillText(String(node.text),0,0);}
 for(const child of node.children)await drawNode(context,child,maskNodes);context.restore();
}
function multiply(a,b){return[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
function worldMatrix(node){
 const angle=node.rotation??0,c=Math.cos(angle),s=Math.sin(angle),x=node.scale.x,y=node.scale.y;
 const local=[c*x,s*x,-s*y,c*y,node.position.x-c*x*node.pivot.x+s*y*node.pivot.y,node.position.y-s*x*node.pivot.x-c*y*node.pivot.y];
 return node.parent?multiply(worldMatrix(node.parent),local):local;
}
function allMasks(root){const set=new Set();const walk=n=>{if(n.mask)set.add(n.mask);n.children.forEach(walk);};walk(root);return set;}

export {createCanvas,textureImage,drawNode,allMasks};
