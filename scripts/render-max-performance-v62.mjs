import {tmpdir} from 'node:os';
/** Actual production effect controller, shipped assets, recorded v60 result,
 * and production reel geometry. Offline Canvas, NOT browser/WebGL evidence.
 * Readouts are a minimal harness, not a reimplementation of the React dock. */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
import {Container,Sprite} from './reel-renderer-mocks-v52.mjs';
import {loadProduction} from './kilo-v56-test-loader.mjs';
import {createCanvas,textureImage,drawNode,allMasks} from './offline-pixi-painter.mjs';
const {createReelFeatureEffects}=loadProduction('src/components/kilo/reel-feature-effects.ts');
const {fitGameLayout}=loadProduction('src/components/kilo/layout.ts');
const {createControlLayout}=loadProduction('src/components/slot-controls/layout.ts');
const {ART,ART_ROOT}=loadProduction('src/components/kilo/art-map.ts');
const source=fs.readFileSync('src/components/kilo/pixiStage.ts','utf8');
const tree=ts.createSourceFile('stage.ts',source,ts.ScriptTarget.Latest,true);
function declaration(name){let found;const visit=n=>{if(ts.isFunctionDeclaration(n)&&n.name?.getText(tree)===name)found=n.getText(tree);ts.forEachChild(n,visit);};visit(tree);if(!found)throw Error(name);return found;}
const fitReels=new Function(ts.transpile(['edgeFor','frameBorders','fitReels'].map(declaration).join('\n'),{target:ts.ScriptTarget.ES2022})+';return fitReels;')();
const seeded=seed=>{let state=seed>>>0;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};};
const {runReelFeature}=loadProduction('src/lib/kilo/reel-feature-math.ts');
const output='art/kilo-v62/proofs',temp=`${tmpdir()}/kilo-v62-max-frames`;
fs.mkdirSync(output,{recursive:true});fs.mkdirSync(temp,{recursive:true});
const art=new Map();for(const [key,file]of Object.entries(ART)){
 const url=path.posix.normalize(ART_ROOT+file),img=await textureImage(url);
 art.set(key,{source:{url,width:img.width,height:img.height},width:img.width,height:img.height});
}
const stages=[];
for(const [outcome,roll] of [['early-loss',.8],['late-loss',.06],['full-stop',.01]])for(const [vw,vh]of [[1440,900],[390,844],[360,800]]){
 let round;for(let seed=1;seed<100000;seed++){const r=runReelFeature('getaway',1000,seeded(seed),25000000);if(r.free[0].mechanic.reel.reveal.segments===({'early-loss':1,'late-loss':4,'full-stop':5})[outcome]){round=r;break;}}if(!round)throw Error('missing sample');
 const example={spin:round.free[0],stake:1000,previousTotal:0};
 if(process.env.KILO_MAX_LOSS_ONLY==='1'&&outcome==='full-stop')continue;
 const id=`max-${outcome}-${vw}x${vh}`,pad=vw<900?12:24,l=fitGameLayout(vw-pad*2,vh-pad*2);
 const g=fitReels(Math.round(l.reelWidth),Math.round(l.reelHeight));
 const ox=(vw-g.dw)/2,oy=vw<900?124:118;
 const layout=createControlLayout({variant:vw<900?'portrait':'desktop',width:vw<900?l.reelWidth:Math.max(800,l.reelWidth),height:l.dock});
 const dockX=(vw-layout.width)/2,dockY=oy+g.dh;
 const win={x:dockX+layout.win.x,y:dockY+layout.win.y,w:layout.win.w,h:layout.win.h};
 const canvas=createCanvas(vw,vh),c=canvas.getContext('2d'),world=new Container(),host=new EventTarget();
 let currentGrid=example.spin.grid,focus=null,paid=example.previousTotal,elapsed=0,frame=0,dom=[],phase=outcome,bankAt=-1;
 const cues=[],snapshots=[];let targets=new Map();
 const text=(value,x,y,size=14,color='#fff8e9',align='center')=>{c.font=`700 ${size}px "Source Sans 3"`;c.fillStyle=color;c.textAlign=align;c.textBaseline='middle';c.fillText(String(value),x,y);};
 const save=async()=>{
  c.globalAlpha=1;c.fillStyle='#06131b';c.fillRect(0,0,vw,vh);
  text('KILO KING · MAX PERFORMANCE',vw/2,44,vw<900?20:28,'#e2bd77');
  text(`${vw} × ${vh} · normal speed`,vw/2,75,14,'#adc6c7');
  c.fillStyle='#020c12';c.fillRect(ox+g.cab.x,oy+g.cab.y,g.cab.w,g.cab.h);
  c.strokeStyle='#a7864d';c.lineWidth=3;c.strokeRect(ox+g.cab.x+1.5,oy+g.cab.y+1.5,g.cab.w-3,g.cab.h-3);
  c.save();c.translate(ox,oy);
  for(let reel=0;reel<5;reel++)for(let row=0;row<3;row++){
   const symbol=currentGrid[reel][row],tex=art.get(symbol.s),img=await textureImage(tex.source.url);
   c.globalAlpha=focus&&!focus.some(p=>p.reel===reel&&p.row===row)?.45:1;
   c.drawImage(img,g.gx+reel*(g.cell+g.gap),g.gy+row*g.cell,g.cell,g.cell);
  }
  c.globalAlpha=1;await drawNode(c,world,allMasks(world));c.restore();
  // Target location comes from production modular layout. Only WIN is drawn;
  // no substitute controls are represented as a live browser render.
  c.fillStyle='#01070b';c.strokeStyle=elapsed-bankAt<500&&bankAt>=0?'#89e6d9':'#6c5b39';c.lineWidth=2;
  c.beginPath();c.roundRect(win.x,win.y,win.w,win.h,7);c.fill();c.stroke();
  text('WIN',win.x+win.w/2,win.y+12,14,'#b8c9c7');
  text(paid.toLocaleString('en-US'),win.x+win.w/2,win.y+win.h*.67,vw<900?20:28);
  for(const el of dom){if(!el.style.left)continue;c.globalAlpha=Number(el.style.opacity??1);
   text(el.textContent,parseFloat(el.style.left),parseFloat(el.style.top),parseFloat(el.style.fontSize??'24'),'#fff4cf');c.globalAlpha=1;}
  text(phase,vw/2,dockY+(vw<900?90:125),vw<900?16:20,'#e2bd77');
  if(vw<900){text('Recorded outcome · physical vessel performance',vw/2,dockY+124,14,'#adc6c7');}
  else text('Recorded outcome · physical vessel performance',vw/2,dockY+155,16,'#adc6c7');
  text('Offline production effect render',vw/2,vh-50,13,'#8fa7ad');
  text('Reel geometry unchanged · WIN target harness',vw/2,vh-29,12,'#8fa7ad');
  const file=`${temp}/${id}-${String(frame++).padStart(4,'0')}.png`;
  fs.writeFileSync(file,await canvas.encode('png'));
  for(const [name,at]of [...targets])if(elapsed>=at){fs.copyFileSync(file,`${output}/${id}-${name}.png`);snapshots.push({name,at:elapsed});targets.delete(name);}
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
  hold:async ms=>{const count=Math.max(1,Math.round(ms/1000*60));for(let n=0;n<count;n++){await save();elapsed+=1000/60;}},
  tween:async(ms,paint)=>{const count=Math.max(1,Math.round(ms/1000*60));for(let n=0;n<count;n++){paint(n/Math.max(1,count-1));await save();elapsed+=1000/60;}},
 };
 const ctl=createReelFeatureEffects(a),e=example.spin.mechanic;
 ctl.set(e,'before');await a.hold(400);
 await ctl.step(e,{award:value=>paid+=value,state(){}});
 ctl.set(e,'after');await a.hold(900);ctl.destroy();
 fs.writeFileSync(`${output}/${id}-timeline.json`,JSON.stringify({viewport:[vw,vh],geometry:g,durationMs:elapsed,initialWin:example.previousTotal,finalWin:paid,cues,snapshots},null,2)+'\n');
 execFileSync('python',['scripts/mix-performance-proof-v62.py',`${output}/${id}-timeline.json`,`${temp}/${id}.wav`]);
 execFileSync('ffmpeg',['-v','error','-y','-framerate','60','-i',`${temp}/${id}-%04d.png`,'-i',`${temp}/${id}.wav`,'-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart',`${output}/${id}.mp4`]);
 stages.push({id,frames:frame,geometry:g,initialWin:example.previousTotal,finalWin:paid,cues});
 for(const file of fs.readdirSync(temp))if(file.startsWith(id+'-')&&file.endsWith('.png'))fs.unlinkSync(`${temp}/${file}`);
 console.log(`${id}: ${frame} frames with ${cues.length} synchronized cues`);
}
fs.writeFileSync(`${output}/${process.env.KILO_MAX_LOSS_ONLY==='1'?'loss-manifest':'manifest'}.json`,JSON.stringify({method:'Offline native Canvas rasterization of production effect display lists. Real source geometry, assets and v60 outcome. Minimal WIN harness; not a browser, full game UI or GPU capture.',stages},null,2)+'\n');
