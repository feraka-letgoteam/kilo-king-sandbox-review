import fs from 'node:fs';import assert from 'node:assert/strict';
import {createOfflineRuntime,createCanvas,drawNode,allMasks} from './offline-runtime-v79.mjs';
import {imageMetadata} from './offline-image-metadata-v77.mjs';
const r=createOfflineRuntime(),world=new r.pixi.Container(),n=8,vertices=[],uvs=[],indices=[];
for(let y=0;y<n;y++)for(let x=0;x<n;x++){vertices.push(x/(n-1)*1024,y/(n-1)*1024);uvs.push(x/(n-1),y/(n-1));}
for(let y=0;y<n-1;y++)for(let x=0;x<n-1;x++){const i=y*n+x;indices.push(i,i+1,i+n,i+1,i+n+1,i+n);}
const mesh=new r.pixi.MeshSimple({texture:imageMetadata('/kilo-v79/symbols/sym-10.webp'),vertices:new Float32Array(vertices),uvs:new Float32Array(uvs),indices:new Uint32Array(indices)});
mesh.scale.set(.20);mesh.position.set(10,10);mesh.alpha=.4;world.addChild(mesh);
const canvas=createCanvas(230,230),c=canvas.getContext('2d');await drawNode(c,world,allMasks(world));
const pixels=c.getImageData(0,0,230,230).data;let max=0,opaque=0;
for(let i=3;i<pixels.length;i+=4){max=Math.max(max,pixels[i]);if(pixels[i]===102)opaque++;}
assert(max<=103,'Parent opacity must be applied once, not accumulated across triangle overlaps');
assert(opaque>500,'The mesh rendered the original opaque letter, not an empty proof');
fs.mkdirSync('art/kilo-v85/verification',{recursive:true});fs.writeFileSync('art/kilo-v85/verification/proof-raster.json',JSON.stringify({maxAlpha:max,expectedAlpha:102,opaqueInteriorPixels:opaque,supersampled:true,alphaAppliedOnce:true,method:'Production display-list mesh fields rasterized by the offline CPU proof painter. Capture regression only; not GPU evidence.'},null,2)+'\n');
console.log('PASS offline material raster: no accumulated triangle alpha, opaque letter intact.');
