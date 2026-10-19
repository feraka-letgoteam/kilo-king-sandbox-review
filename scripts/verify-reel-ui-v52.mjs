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
 check((html.match(/class="kf-art"/g)||[]).length===3,'existing cutout card artwork retained');
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
const summaries=['10 free spins. Collect kilos; climb the multiplier ladder.','15 free spins. Sticky VS wild reels with ×2–×10 multipliers.','1 spin. Max win or nothing.'];
const results=[];
for(const [width,height] of [[360,800],[390,844],[844,390],[1440,900]])for(const unavailable of [false,true])for(const safe of [0,...(width<600?[47]:[])]){
 const portrait=width<600,landscape=height<=480;
 const contentW=Math.min(width,1060)-(portrait?32:landscape?44:48),gap=portrait?8:landscape?10:14;
 const cardW=portrait?contentW:(contentW-2*gap)/3;
 const cardHeights=summaries.map((description,i)=>{
   const reason=unavailable?(i===0?'Insufficient balance':'Above the 1,000,000 purchase limit'):'';
   if(portrait){const inner=cardW-22,copyW=inner-68-8;const copy=Math.max(66,24+5+lines(description,14,copyW)*18);const rh=reason?lines(reason,13,inner)*16+8:0;return 22+copy+44+8+rh;}
   if(landscape){const inner=cardW-22,copyW=inner-48-8;const copy=Math.max(64,22+3+lines(description,13,copyW)*16);const rh=reason?lines(reason,12,inner)*15+6:0;return 22+copy+26+44+12+rh;}
   return 40+104+90+47+48+4*12+(reason?lines(reason,13,cardW-38)*16:0);
 });
 const gridH=portrait?cardHeights.reduce((a,b)=>a+b,0)+2*gap:Math.max(...cardHeights);
 const used=portrait?60+safe+4+30.8+10+gridH+12+62+29+Math.max(16,safe?34:0):landscape?56+34+gridH+64+21+8:80+12+65+gridH+18+66+29+24;
 check(used<=height,`${width}×${height} source layout budget (${used}) fits ${unavailable?'disabled':'valid'} states, safe ${safe}`);
 results.push({viewport:[width,height],unavailable,safeTop:safe,estimatedUsedHeight:Math.round(used*10)/10,remaining:Math.round((height-used)*10)/10,cardWidth:cardW,cardHeights});
}
const css=fs.readFileSync('src/components/kilo/feature-takeover.css','utf8');check(css.includes('#kilo-features-takeover .kk-scrim { background:#36393e'),'gray scrim overrides global dark modal');
check(css.includes('min-height:44px'),'touch target declaration');
fs.writeFileSync('art/kilo-features-v52/ui-verification.json',JSON.stringify({method:'Real React SSR + protected source declaration equality + source-derived responsive budget using shipped font advances. Not computed browser layout; screenshots remain pending.',assertions,states,layout:results,protectedDeclarations},null,2)+'\n');
console.log(`PASS ${assertions} UI/source checks and ${results.length} responsive font-budget cases; no browser claim.`);
