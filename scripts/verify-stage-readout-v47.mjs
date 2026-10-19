/** Production geometry and font metrics only; no browser claim. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {fitGameLayout} from '../src/components/kilo/layout.ts';
import {createControlLayout,controlTargets} from '../src/components/slot-controls/layout.ts';
import {stageArtLayout} from '../src/components/kilo/stage-art.ts';
import {stageReadoutLayout,collectionHold} from '../src/components/kilo/presentation-readout.ts';
const source=fs.readFileSync('src/components/kilo/pixiStage.ts','utf8');
const geometry=source.slice(source.indexOf('function edgeFor('),source.indexOf('function geomFor('));
const fitReels=new Function(ts.transpile(geometry,{target:ts.ScriptTarget.ESNext})+';return fitReels;')();
const metric=JSON.parse(execFileSync('python',['-c',`import sys,types,subprocess
try:
 import brotli
except ImportError:
 sys.modules['brotli']=types.SimpleNamespace(decompress=lambda data:subprocess.check_output(['node','-e',"process.stdout.write(require('node:zlib').brotliDecompressSync(require('node:fs').readFileSync(0)))"],input=data))
from fontTools.ttLib import TTFont
import json
f=TTFont('public/kilo-ui-v11/fonts/SourceSans3-700.woff2'); cm=f.getBestCmap()
print(json.dumps({'units':f['head'].unitsPerEm,'chars':{chr(i):f['hmtx'][cm.get(i,'space')][0] for i in list(range(32,127))+[215,183]}}))`],{encoding:'utf8'}));
const textWidth=(text,size)=>[...text].reduce((n,c)=>n+(metric.chars[c]||metric.chars['0'])*size/metric.units,0);
const overlaps=(a,b)=>a.x<b.x+b.w-.01&&a.x+a.w>b.x+.01&&a.y<b.y+b.h-.01&&a.y+a.h>b.y+.01;
const rows=[];
for(const [W,H]of [[360,800],[390,844],[844,390],[1440,900]]){
 const pad=W<900?12:24,game=fitGameLayout(W-pad*2,H-pad*2),g=fitReels(Math.round(game.reelWidth),Math.round(game.reelHeight));
 const b=stageReadoutLayout(g),frame=stageArtLayout(game.reelWidth,game.reelHeight,game.mode);
 assert(b.y>=g.gy+g.cell*3+2,'Readout enters symbol aperture');
 const dock=createControlLayout({variant:game.mode==='wide'?'desktop':game.mode,width:game.mode==='landscape'?game.width:game.mode==='portrait'?game.reelWidth:W-pad*2,height:game.dock,footerWidth:game.reelWidth});
 const reelX=game.mode==='landscape'?game.controlLeft+game.dockGap:game.artLeft;
 const dockX=game.mode==='landscape'?0:reelX+(game.reelWidth-dock.width)/2;
 const dockY=game.mode==='landscape'?0:game.header+game.reelHeight+(game.mode==='portrait'?16:32);
 const readout={x:reelX+b.x,y:game.header+b.y,w:b.width,h:b.height};
 if(game.mode==='portrait')assert.equal(dock.height,160);
 if(game.mode==='landscape')assert(pad+readout.y+readout.h<=H,'Readout clipped at viewport bottom');
 let clearance=Infinity;
 for(const name of ['balance','win','bet']) {
  const r=dock[name], panel={...r,x:r.x+dockX,y:r.y+dockY};
  assert(!overlaps(readout,panel),`Readout touches ${name} well`);
  if(game.mode!=='landscape')clearance=Math.min(clearance,panel.y-readout.y-readout.h);
 }
 for(const feature of [false,true])for(const [name,r]of Object.entries(controlTargets(dock,feature))){
  assert(r.w>=44&&r.h>=44,`${name} lost44px target`);
  const target={...r,x:r.x+dockX,y:r.y+dockY};
  assert(!overlaps(readout,target),`Readout touches ${name}`);
  if(game.mode!=='landscape')clearance=Math.min(clearance,target.y-readout.y-readout.h);
 }
 for(const [label,value]of [['Line 15/15 · 5 × Tackle case','50,000,000'],['Collector 2/2 · capped','50,000,000'],['12,000 × 2','24,000'],['MAX WIN REACHED','50,000,000'],['Combined before cap','100,000,000']]){
  assert(textWidth(label,b.labelSize)+textWidth(value,b.amountSize)+26<=b.width,`Text overflows ${W}: ${label}`);
 }
 rows.push({viewport:[W,H],cell:g.cell,readout,controlClearance:Number.isFinite(clearance)?clearance:null,frame,mode:game.mode});
}
for(const speed of ['normal','turbo','super'])for(const reduced of [false,true])for(const hold of [340,640,720])assert(collectionHold(hold,speed,reduced)>=300,'Unreadable fast/reduced hold');
const collect=source.slice(source.indexOf('    async collect(spin)'),source.indexOf('    async deliverCollectors'));
assert(collect.includes('if (!reduced) await Promise.all(['));assert(collect.includes('flyFish(spot, value, wild)'));assert(collect.includes('await readable(340)'));assert(collect.includes('await readable(720)'));
assert(!collect.includes('fontSize) > 9'));
assert(collect.indexOf('if (t > 0.68)')<collect.indexOf('phase: "bank"'),'Banked before transfer fade');
assert(source.includes('if (announce) onLineStart?.(line, index)'),'Resize repeats win credit callback');
assert(source.includes('readout.hidden = true'));
fs.writeFileSync('art/kilo-presentation-v47/layout-verification.json',JSON.stringify({method:'Production geometry and shipped font advances; not a live browser layout',rows,holds:'all profiles >=300ms',passed:true},null,2)+'\n');
console.log('PASS: 4 viewport readouts clear reel cells and controls; exact captions fit; 44px targets/160px portrait preserved; readable fast/reduced holds.');
