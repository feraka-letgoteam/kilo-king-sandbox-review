/** Native artwork/geometry proofs from production fit functions. NOT browser screenshots. */
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {fitGameLayout} from '../src/components/kilo/layout.ts';
import {stageArtPaint} from '../src/components/kilo/stage-art.ts';
import {placement} from '../src/components/kilo/fish-art.ts';
import {stageReadoutLayout} from '../src/components/kilo/presentation-readout.ts';
const req=createRequire(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules','package.json'));
const sharp=req('sharp');
const source=fs.readFileSync('src/components/kilo/pixiStage.ts','utf8');
const geometry=source.slice(source.indexOf('function edgeFor('),source.indexOf('function geomFor('));
const fitReels=new Function(ts.transpile(geometry,{target:ts.ScriptTarget.ESNext})+';return fitReels;')();
const root='public/kilo-symbols-v47', output='art/kilo-presentation-v47/proofs';
fs.mkdirSync(output,{recursive:true});
const assets=JSON.parse(fs.readFileSync(`${root}/manifest.json`,'utf8')).assets;
const uri={};for(const [key,m]of Object.entries(assets))uri[key]='data:image/png;base64,'+(await sharp(`${root}/${m.file}`).png().toBuffer()).toString('base64');
const frame='data:image/png;base64,'+(await sharp('public/kilo-stage-v47/cabinet.webp').png().toBuffer()).toString('base64');
const board=['sym-a','package-small','sym-k','sym-case-v8','sym-10','sym-bobber','sym-q','sym-reel-v8','sym-j','scatter-king','package-trophy','sym-cash-roll','package-king','package-medium','collector-idle'];
const budgets={'package-small':[.64,.46],'package-medium':[.74,.56],'package-trophy':[.8,.7],'package-king':[.92,.72]};
const values={'package-small':'2,000','package-medium':'10,000','package-trophy':'50,000','package-king':'500,000'};
const text=(s,x,y,size=14,color='#d2dfda')=>`<text x="${x}" y="${y}" font-size="${size}" font-family="sans-serif" fill="${color}" text-anchor="middle">${s}</text>`;
function symbol(key,g,x,y){
 const m=assets[key],p=budgets[key];let f;
 if(p)f=placement(m,g.cell,...p,.37);
 else if(key==='collector-idle')f=placement({...m,bounds:[10,46,424,392]},g.cell,.98,.8,.425);
 else {const target=key==='scatter-king'?.82:['sym-case-v8','sym-reel-v8'].includes(key)?.9:['sym-bobber','sym-cash-roll'].includes(key)?.78:.66;f=placement(m,g.cell,target,target,.5);}
 let out=`<image href="${uri[key]}" x="${x+f.x}" y="${y+f.y}" width="${f.width}" height="${f.height}"/>`;
 if(p)out+=`<rect x="${x+g.cell*.045}" y="${y+g.cell*.76}" width="${g.cell*.91}" height="${g.cell*.2}" rx="3" fill="#071f28" stroke="#967e4d"/>`+text(values[key],x+g.cell*.5,y+g.cell*.91,Math.floor(g.cell*.16),'#fff1d8');
 return out;
}
const reports=[];
for(const [W,H]of [[360,800],[390,844],[844,390],[1440,900]]){
 const pad=W<900?12:24,game=fitGameLayout(W-pad*2,H-pad*2),g=fitReels(Math.round(game.reelWidth),Math.round(game.reelHeight));
 const X=(W-game.reelWidth)/2,Y=48+(game.mode==='wide'?4:0),height=Math.ceil(game.reelHeight+Y+70);
 let body=`<rect width="100%" height="100%" fill="#061820"/>`+text(`v47 · ${W} × ${H} viewport · ${g.cell}px cells`,W/2,22,W<400?12:16);
 let stage=`<rect x="${g.cab.x}" y="${g.cab.y}" width="${g.cab.w}" height="${g.cab.h}" fill="#051820"/>`;
 for(let i=0;i<board.length;i++){
  const x=g.gx+(i%5)*(g.cell+g.gap),y=g.gy+Math.floor(i/5)*g.cell;
  stage+=symbol(board[i],g,x,y);
 }
 stage+=stageArtPaint(game.reelWidth,game.reelHeight,game.compact?'mini':game.mode).replaceAll('/kilo-stage-v47/cabinet.webp',frame);
 const b=stageReadoutLayout(g);
 stage+=`<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="4" fill="#061920" stroke="#937d4e"/>`+text('Collected',b.x+b.width*.35,b.y+b.height*.72,b.labelSize)+text('48,000',b.x+b.width*.64,b.y+b.height*.75,b.amountSize,'#fff2d7');
 body+=`<g transform="translate(${X} ${Y})">${stage}</g>`;
 body+=text('Native art / fit proof — not a browser capture',W/2,height-12,W<400?10:12);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}">${body}</svg>`;
 await sharp(Buffer.from(svg)).png().toFile(`${output}/stage-${W}x${H}.png`);
 reports.push({viewport:[W,H],reel:[game.reelWidth,game.reelHeight],cell:g.cell,readout:b,mode:game.mode,kind:'native artwork/geometry proof, no browser'});
}
fs.writeFileSync(`${output}/geometry.json`,JSON.stringify(reports,null,2)+'\n');
console.log('Four native stage proofs rendered from production geometry.');
