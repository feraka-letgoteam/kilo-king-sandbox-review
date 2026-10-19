/** Native art proof using existing Pixi fit budgets, not a browser screenshot. */
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {placement} from '../src/components/kilo/fish-art.ts';
let sharp;try{sharp=(await import('sharp')).default;}catch{sharp=createRequire(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules','package.json'))('sharp');}
const root='public/kilo-symbols-v46';
const manifest=JSON.parse(fs.readFileSync(`${root}/manifest.json`,'utf8'));
const pngs={};
async function uri(name){if(!pngs[name])pngs[name]='data:image/png;base64,'+(await sharp(`${root}/${manifest.assets[name].file}`).png().toBuffer()).toString('base64');return pngs[name];}
const board=[
 'sym-a','package-small','sym-k','sym-case-v8','sym-10',
 'sym-bobber','sym-q','sym-reel-v8','sym-j','scatter-king',
 'package-trophy','sym-cash-roll','package-king','package-medium','collector-idle',
];
const packBudgets={'package-small':[.64,.46],'package-medium':[.74,.56],'package-trophy':[.8,.7],'package-king':[.92,.72]};
function fit(name,size){
 const m=manifest.assets[name];
 if(name==='collector-idle')return placement({...m,bounds:[10,46,424,392]},size,.98,.8,.425);
 const pack=packBudgets[name];if(pack)return placement(m,size,...pack,.37);
 if(name==='scatter-king')return placement(m,size,.82,.82,.5);
 if(name==='sym-case-v8'||name==='sym-reel-v8')return placement(m,size,.9,.9,.5);
 const target=['sym-bobber','sym-cash-roll'].includes(name)?.78:.66;
 return placement(m,size,target,target,.5);
}
async function boardProof(size,padding,title,output){
 const width=size*5+padding*2,height=size*3+padding*2+68;
 let content='';
 for(let i=0;i<board.length;i++){
  const name=board[i],m=manifest.assets[name],f=fit(name,size),x=padding+(i%5)*size,y=padding+48+Math.floor(i/5)*size;
  content+=`<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="#04151e" stroke="#17343c" stroke-width="1"/><image href="${await uri(name)}" x="${x+f.x}" y="${y+f.y}" width="${f.width}" height="${f.height}"/>`;
  if(packBudgets[name])content+=`<rect x="${x+size*.08}" y="${y+size*.78}" width="${size*.84}" height="${size*.17}" rx="${size*.035}" fill="#071f28" stroke="#a88d55"/><text x="${x+size*.5}" y="${y+size*.915}" fill="#fff2d7" font-family="sans-serif" font-size="${size*.13}" font-weight="700" text-anchor="middle">${({'package-small':'2,000','package-medium':'10,000','package-trophy':'50,000','package-king':'500,000'})[name]}</text>`;
 }
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#071820"/><text x="${padding}" y="30" fill="#f4eddc" font-family="sans-serif" font-size="16" font-weight="700">${title}</text>${content}<text x="${padding}" y="${height-10}" fill="#9caeaf" font-family="sans-serif" font-size="${size<100?8:11}">Native artwork proof • not a browser capture</text></svg>`;
 await sharp(Buffer.from(svg)).png().toFile(output);
}
fs.mkdirSync('art/kilo-symbols-v46/proofs',{recursive:true});
await boardProof(177.6,20,'KILO KING — v46 refined symbol pack','art/kilo-symbols-v46/proofs/desktop-symbol-board.png');
await boardProof(67.2,12,'KILO KING — phone-size artwork','art/kilo-symbols-v46/proofs/phone-symbol-board.png');
console.log('Wrote desktop and phone-size native artwork boards.');
