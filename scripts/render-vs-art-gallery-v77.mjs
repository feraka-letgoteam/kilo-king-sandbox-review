/** Exact production VS art units at real desktop/phone cell sizes.
 * This is a typesetting coverage gallery, not an invented paying round. */
import fs from 'node:fs';
import ts from 'typescript';
import {createOfflineRuntime,createCanvas,drawNode,allMasks} from './offline-runtime-v77.mjs';
import {sourceFingerprint} from './v77-source-fingerprint.mjs';
const runtime=createOfflineRuntime(),{createVsGroupArt,VS_GROUP_ART_URLS}=runtime.load('src/components/kilo/vs-group-art.ts'),{groupVsReels}=runtime.load('src/lib/kilo/vs-groups.ts'),{fitGameLayout}=runtime.load('src/components/kilo/layout.ts');
const source=fs.readFileSync('src/components/kilo/pixiStage.ts','utf8'),tree=ts.createSourceFile('x.ts',source,ts.ScriptTarget.Latest,true);
function declaration(name){let text;const scan=n=>{if(ts.isFunctionDeclaration(n)&&n.name?.getText(tree)===name)text=n.getText(tree);ts.forEachChild(n,scan);};scan(tree);if(!text)throw Error(name);return text;}
const fit=new Function(ts.transpile(['edgeFor','frameBorders','fitReels'].map(declaration).join('\n'),{target:ts.ScriptTarget.ES2022})+';return fitReels;')();
for(const url of VS_GROUP_ART_URLS)await runtime.pixi.Assets.load(url);
const output='art/kilo-v77/proofs';fs.mkdirSync(output,{recursive:true});
const entries=[],fingerprint=sourceFingerprint();
for(const[vw,vh]of[[1440,900],[390,844]]){
 const p=vw<900?12:24,l=fitGameLayout(vw-p*2,vh-p*2),g=fit(Math.round(l.reelWidth),Math.round(l.reelHeight));
 for(const side of['king','vice'])for(let width=1;width<=5;width++){
  const members=[3,4,10,5,2].slice(0,width).map((multiplier,reel)=>({reel,multiplier,duelist:side})),group=groupVsReels(members)[0],w=width*g.cell+(width-1)*g.gap,h=3*g.cell;
  const parent=new runtime.pixi.Container(),art=createVsGroupArt(group,{...g,gx:0,gy:0},runtime.textures.get(`/kilo-v77/vs/${side}-${width}.webp`));parent.addChild(art);
  const canvas=createCanvas(w,h),c=canvas.getContext('2d');await drawNode(c,parent,allMasks(parent));
  const file=`VS-${side}-${width}-${vw}x${vh}.webp`;fs.writeFileSync(`${output}/${file}`,await canvas.encode('webp',94));
  const number=art.children.find(n=>n.label==='vs-group-multiplier');entries.push({file,viewport:[vw,vh],side,width,pixels:[w,h],multiplier:group.multiplier,font:number.style.fontFamily,fontSize:number.style.fontSize,inkWidth:number.width});
 }
}
if(sourceFingerprint()!==fingerprint)throw Error('Production changed during gallery capture');
fs.writeFileSync(`${output}/VS-art-gallery.json`,JSON.stringify({method:'Production createVsGroupArt display lists; native source cell dimensions; typesetting coverage, not a paying fixture.',sourceFingerprint:fingerprint,entries},null,2)+'\n');
console.log(`Rendered ${entries.length} native VS type/art samples.`);
