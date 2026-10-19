import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {registerHooks} from 'node:module';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
registerHooks({resolve(s,c,next){if(s.startsWith('@/'))s=new URL('../src/'+s.slice(2),import.meta.url).href;if((s.startsWith('.')||s.startsWith('file:'))&&!/\.(tsx?|css|m?js|json)$/.test(s)){const u=new URL(s,c.parentURL);for(const ext of ['.ts','.tsx'])if(fs.existsSync(fileURLToPath(u)+ext))return next(u.href+ext,c);}return next(s,c);},load(url,c,next){if(url.endsWith('.css'))return{format:'module',source:'export {};',shortCircuit:true};if(url.endsWith('.json'))return{format:'module',source:`export default ${fs.readFileSync(fileURLToPath(url),'utf8')};`,shortCircuit:true};if(/\.tsx?$/.test(url))return{format:'module',shortCircuit:true,source:ts.transpileModule(fs.readFileSync(fileURLToPath(url),'utf8'),{fileName:fileURLToPath(url),compilerOptions:{target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText};return next(url,c);}});
const {createElement:el}=await import('react'),{renderToStaticMarkup:render}=await import('react-dom/server');
const {FeatureTakeoverView}=await import('../src/components/kilo/feature-takeover.tsx');
const {FEATURES}=await import('../src/components/kilo/feature-catalog.ts');
const {PURCHASE_PRESENTATION}=await import('../src/components/kilo/feature-presentation.ts');
const {InfoPanel}=await import('../src/components/kilo/info-panel.tsx');
const {splashCost}=await import('../src/lib/kilo/engine.ts');
const noop=()=>{},props={stake:1000,bank:100000000,ante:false,locked:false,onAnte:noop,onEditBet:noop,onStake:noop,onBuy:noop,onClose:noop,onView:noop,onConfirm:noop,reducedMotion:true};
let assertions=0;const check=(v,m)=>{assert(v,m);assertions++;};
const states=[];
for(const f of FEATURES.filter(f=>f.kind==='purchase'))for(const state of ['valid','insufficient','limit']){
 const stake=state==='limit'?100000:1000,bank=state==='insufficient'?0:100000000;
 const html=render(el(FeatureTakeoverView,{...props,view:f.mode,stake,bank}));
 const button=html.match(/<button[^>]*data-testid="confirm-purchase"[^>]*>/)?.[0];check(!!button,'same explicit confirmation');check(button.includes('disabled')===(state!=='valid'),'validation at confirm');
 check(html.includes(splashCost(stake,f.mode).toLocaleString('en-US')),'live cost');
 if(f.mode==='getaway')check(html.includes('1 spin. Max win or nothing.'),'binary warning visible before charge');
 states.push({mode:f.mode,state});
}
for(const ante of [false,true]){
 const html=render(el(FeatureTakeoverView,{...props,view:'features',ante}));
 for(const mode of ['buy','yacht','getaway'])check(html.includes(`data-feature-action="${mode}"`),'three visible purchases');
 check(!html.includes('data-feature-action="chopper"'),'Chopper is not sold');check(html.includes(`Ante ${ante?'On':'Off'}`),'explicit Ante state');
 check(!html.includes('kf-scene-thumbnail')&&!html.includes('kk-integrated'),'no illustrated modal scene');
 check((html.match(/class="kf-art"/g)||[]).length===3,'three dedicated card illustrations');
}
const restricted=render(el(FeatureTakeoverView,{...props,view:'features',anteOnly:true}));check(!restricted.includes('data-feature-action='),'jurisdiction hides purchase cards');
const info=render(el(InfoPanel,{stake:1000,round:{line:0,collect:0,scatter:0},onClose:noop,onSettings:noop}));
for(const text of ['Chopper Route cannot be bought','five or more','3.82%','96.18%','18,000','25,000','Chopper Route cluster payouts'])check(info.includes(text),`rules: ${text}`);
const src=fs.readFileSync('src/components/kilo/play.tsx','utf8');check(src.includes('visualRound.version !== 4'),'v4 entry skips full-screen scene');check(src.includes('summary && visualRound?.version === 4 ? <ReelFeatureCompletion'),'v4 result uses on-reel panel');
// Compare actual protected implementation declarations, not hand-written hashes.
function declaration(code,name){const tree=ts.createSourceFile('x.ts',code,ts.ScriptTarget.Latest,true);let found;const walk=n=>{if((ts.isFunctionDeclaration(n)||ts.isMethodDeclaration(n))&&n.name?.getText(tree)===name)found=n.getText(tree);ts.forEachChild(n,walk);};walk(tree);assert(found,name);return found;}
const protectedDeclarations={'src/lib/kilo/engine.ts':['splashCost','splashStakeOk','lineHit','fitAward','hookRespin','runFeature'],'src/components/kilo/pixiStage.ts':['fitReels','collect','tool','spinTo'],'src/components/kilo/play.tsx':['credit']};
for(const [file,names] of Object.entries(protectedDeclarations)){const old=execFileSync('git',['show',`3bfbb66:${file}`],{encoding:'utf8'}),now=fs.readFileSync(file,'utf8');for(const name of names){assert.equal(declaration(now,name),declaration(old,name),`Protected ${name}`);assertions++;}}
// Source layout budget uses the actual shipped font advances; it is NOT a
// browser box model or screenshot. Keep the method explicit in the report.
const fonts=JSON.parse(fs.readFileSync('art/kilo-features-v52/font-metrics.json','utf8'));
const textWidth=(text,size,font='body')=>[...text].reduce((n,c)=>n+(fonts[font].advances[c]??fonts[font].advances[' '])*size/fonts[font].units,0);
const lines=(text,size,width,font='body')=>{let count=1,line='';for(const word of text.split(' ')){const next=line?line+' '+word:word;if(textWidth(next,size,font)>width&&line){count++;line=word;}else line=next;assert(textWidth(word,size,font)<=width,`word fits: ${word}`);}return count;};
const summaries=Object.values(PURCHASE_PRESENTATION).map(f=>f.summary);
const results=[];
for(const [width,height] of [[360,800],[390,844],[844,390],[1440,900]])for(const unavailable of [false,true])for(const safe of [0,...(width<600?[47]:[])]){
 const portrait=width<600,landscape=height<=480;
 const contentW=Math.min(width,1060)-(portrait?24:landscape?36:56),gap=portrait?8:landscape?10:16;
 const cardW=portrait?contentW:(contentW-2*gap)/3;
 const cardHeights=summaries.map((description,i)=>{
   const reason=unavailable?'Above the 1,000,000 purchase limit':'Buy feature';
   if(portrait||landscape){const inner=cardW-22,copyW=inner-(portrait?86:68)-(portrait?10:6);
     const copy=12+3+23+4+lines(description,13,copyW)*(portrait?17:16);
     const top=portrait?80:96;check(copy<=top,`${width} copy fits its row: ${copy}/${top}`);
     const buttonW=portrait?(inner-8)*1.2/2.2:(inner-6)/2;
     const button=Math.max(44,12+2+lines(reason,unavailable?12:portrait?14:13,buttonW-(portrait?18:12))*(unavailable?(portrait?15:14):18));
     return 22+top+6+Math.max(41,button);
   }
   const copy=15+4+32+8+lines(description,15,cardW-38)*20;check(copy<=106,'desktop card copy fits reserved area');
   const button=Math.max(46,18+lines(reason,unavailable?13:15,cardW-38-24)*(unavailable?16:18));
   return 32+164+106+47+10+button;
 });
 const gridH=portrait?cardHeights.reduce((a,b)=>a+b,0)+2*gap:Math.max(...cardHeights);
 const used=portrait?Math.max(8,safe)+Math.max(8,safe?34:0)+44+52+16+64+gridH+16+16:landscape?12+44+48+12+54+gridH+16+12:36+48+58+32+80+gridH+18+32;
 check(used<=height,`${width}×${height} source layout budget (${used}) fits ${unavailable?'disabled':'valid'} safe ${safe}`);
 const confirmW=portrait?contentW:landscape?Math.min(704,width-140):480;
 const confirmCopyW=portrait?confirmW-34:landscape?(confirmW-28-28-82)*1.3/2.3:confirmW-46-120-16;
 const confirmationHeights=Object.values(PURCHASE_PRESENTATION).map(f=>{
   const d=lines(f.confirmation,portrait?13:landscape?12:14,confirmCopyW)*(portrait?18:landscape?16:19);
   const short=lines(f.summary,portrait?13:landscape?15:15,confirmCopyW)*(portrait?17:20);
   const copy=(portrait?12:landscape?12:15)+4+(portrait?30:landscape?28:32)+4+short+8+d;
   if(portrait)return 34+90+copy+112+106+36;
   if(landscape)return 30+Math.max(copy,110+10+106);
   return 48+Math.max(120,copy)+112+106+32;
 });
 const confirmAvailable=height-(portrait?Math.max(8,safe)+Math.max(8,safe?34:0)+44+52+16:landscape?68:36+48+58+32);
 for(const h of confirmationHeights)check(h<=confirmAvailable,`${width} confirmation budget ${h}/${confirmAvailable}`);
 results.push({viewport:[width,height],unavailable,safeTop:safe,estimatedUsedHeight:Math.round(used*10)/10,remaining:Math.round((height-used)*10)/10,cardWidth:cardW,cardHeights,confirmationHeights});
}
const css=fs.readFileSync('src/components/kilo/feature-takeover.css','utf8');check(css.includes('#kilo-features-takeover .kk-scrim { background:rgba(35,38,41,.88)'),'gray scrim overrides global dark modal');
check(css.includes('min-height:44px'),'touch target declaration');
fs.writeFileSync('art/kilo-v56/ui-verification.json',JSON.stringify({method:'Real React SSR + protected source declaration equality + source-derived responsive budget using shipped font advances. Not computed browser layout; screenshots remain pending.',assertions,states,layout:results,protectedDeclarations},null,2)+'\n');
console.log(`PASS ${assertions} UI/source checks and ${results.length} responsive font-budget cases; no browser claim.`);
