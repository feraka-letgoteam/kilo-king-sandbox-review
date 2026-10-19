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
fs.mkdirSync('art/kilo-v58',{recursive:true});
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
 check((html.match(/class="kf-art-wrap"/g)||[]).length===3 && html.includes('/kilo-v58/vs/king-ready.webp'),'three dedicated illustrated card heroes');
}
const restricted=render(el(FeatureTakeoverView,{...props,view:'features',anteOnly:true}));check(!restricted.includes('data-feature-action='),'jurisdiction hides purchase cards');
const info=render(el(InfoPanel,{stake:1000,round:{line:0,collect:0,scatter:0},onClose:noop,onSettings:noop}));
for(const text of ['Chopper Route cannot be bought','five or more','3.82%','96.18%','18,000','25,000','Chopper Route cluster payouts'])check(info.includes(text),`rules: ${text}`);
const src=fs.readFileSync('src/components/kilo/play.tsx','utf8');check(src.includes('visualRound.version !== 4'),'v4 entry skips full-screen scene');check(src.includes('summary && visualRound?.version === 4 ? <ReelFeatureCompletion'),'v4 result uses on-reel panel');
// Compare actual protected implementation declarations, not hand-written hashes.
function declaration(code,name){const tree=ts.createSourceFile('x.ts',code,ts.ScriptTarget.Latest,true);let found;const walk=n=>{if((ts.isFunctionDeclaration(n)||ts.isMethodDeclaration(n))&&n.name?.getText(tree)===name)found=n.getText(tree);ts.forEachChild(n,walk);};walk(tree);assert(found,name);return found;}
const protectedDeclarations={'src/lib/kilo/engine.ts':['splashCost','splashStakeOk','lineHit','fitAward','hookRespin','runFeature'],'src/components/kilo/pixiStage.ts':['fitReels','tool','spinTo'],'src/components/kilo/play.tsx':['credit']};
for(const [file,names] of Object.entries(protectedDeclarations)){const old=execFileSync('git',['show',`3bfbb66:${file}`],{encoding:'utf8'}),now=fs.readFileSync(file,'utf8');for(const name of names){assert.equal(declaration(now,name),declaration(old,name),`Protected ${name}`);assertions++;}}
const fonts=JSON.parse(fs.readFileSync('art/kilo-features-v52/font-metrics.json','utf8'));
const textWidth=(text,size,font='body')=>[...text].reduce((n,c)=>n+(fonts[font].advances[c]??fonts[font].advances[' '])*size/fonts[font].units,0);
const lines=(text,size,width,font='body')=>{let count=1,line='';for(const word of text.split(' ')){const next=line?line+' '+word:word;if(textWidth(next,size,font)>width&&line){count++;line=word;}else line=next;assert(textWidth(word,size,font)<=width,`word fits: ${word}`);}return count;};
const css=fs.readFileSync('src/components/kilo/feature-takeover.css','utf8');
check(css.includes('grid-template-rows:104px minmax(89px,auto) auto'),'phone budget uses the shipped rows');
check(css.includes('grid-template-rows:74px minmax(77px,auto) auto'),'landscape budget uses the shipped rows');
check(css.includes('background:rgba(24,27,30,.84)'),'gray blurred overlay');
const presentations=Object.values(PURCHASE_PRESENTATION),features=FEATURES.filter(f=>f.kind==='purchase');
const result=[];
for(const [W,H]of[[360,800],[390,844],[844,390],[1440,900]])for(const unavailable of [false,true])for(const safe of [0,...(W<600?[47]:[])]){
 const phone=W<600,land=H<=500,pad=phone?12:land?16:24;
 const content=Math.min(W,land?1060:1020)-2*pad,gap=phone?9:land?8:12;
 const gridWidth=land?content-170-8:content;
 const cardW=(gridWidth-(phone?gap:2*gap))/(phone?2:3);
 const sizes=presentations.map((visual,i)=>{
   const maxWide=phone&&i===2,inner=(maxWide?content:cardW)-(phone||land?22:38);
   const copyW=maxWide?inner*.58-12:inner;
   const headingSize=phone?23:land?22:28,bodySize=phone?12:land?11:15;
   const copy=(phone?8:land?6:13)+(phone?12:land?11:14)+(phone?3:land?2:3)+lines(features[i].title.toUpperCase(),headingSize,copyW,'title')*(phone?24:land?23:29)+(phone?5:land?4:7)+lines(visual.summary,bodySize,copyW)*(phone?15:land?14:19);
   const buttonText=unavailable?'Above the 1,000,000 purchase limit':i===2?'Activate':'Buy';
   const button=Math.max(phone||land?44:46,(phone||land?14:18)+lines(buttonText,unavailable?(phone||land?11:13):phone?16:land?15:17,copyW-(phone?16:land?12:24),unavailable?'body':'title')*(unavailable?(phone?14:land?13:16):19));
   const purchase=(phone?8:land?5:14)+(phone?38:land?36:46)+(phone?7:land?5:8)+button;
   if(maxWide)return 22+copy-8+purchase-1;
   return (phone?104:land?74:202)+Math.max(phone?89:land?77:97,copy)+purchase+(phone?12:land?11:20);
 });
 const gridH=phone?Math.max(sizes[0],sizes[1])+gap+sizes[2]:Math.max(...sizes);
 const catalogue=phone?76+9+gridH+9+15:land?Math.max(gridH,244)+8+12:96+12+gridH+12+16;
 const overhead=phone?Math.max(8,safe)+Math.max(8,safe?34:0)+44+50+18:land?12+44+44+10:36+44+52+28;
 const used=catalogue+overhead;
 check(used<=H,`${W}x${H} ${unavailable?'disabled':'valid'} safe${safe}: ${used}px fits`);
 // Real copy in the selected-card confirmation; long rules wrap, never truncate.
 const confirmW=phone?Math.min(content,350):land?Math.min(content,690):350;
 const confirmInner=land?confirmW-32-160-16:confirmW-46;
 const confirmationHeights=presentations.map(visual=>{
   const copy=14+3+(land?24:30)+7+lines(visual.summary,land?12:14,confirmInner)*(land?15:18)+8+lines(visual.confirmation,land?12:13,confirmInner)*(land?15:17);
   const note=lines('No charge to activate. Each press of Spin is a new paid attempt.',land?11:12,confirmInner)*(land?14:16);
   return land?24+copy+8+75+8+note+4+44:140+copy+12+104+12+note+8+46+2+44+14+24;
 });
 const available=H-overhead;
 for(const ch of confirmationHeights)check(ch<=available,`${W} confirmation ${ch} fits ${available}`);
 result.push({viewport:[W,H],unavailable,safeTop:safe,estimatedUsedHeight:used,remaining:H-used,cardWidths:phone?[cardW,content]:[cardW],cardHeights:sizes,confirmationHeights});
}
const active=render(el(FeatureTakeoverView,{...props,view:'features',maxActive:true,bank:0}));
check(active.includes('Deactivate'),'active Max can be deactivated even with insufficient balance');
const confirm=render(el(FeatureTakeoverView,{...props,view:'getaway'}));
check(confirm.includes('No charge to activate.')&&confirm.includes('Cost per spin')&&confirm.includes('Activate Max spins'),'activation and per-spin price are unambiguous');
check(!confirm.includes('Charged once when you confirm.'),'Max activation cannot claim an immediate debit');
fs.writeFileSync('art/kilo-v62/ui-verification.json',JSON.stringify({method:'Actual React SSR, protected declarations and source-derived layout budgets using shipped font advances. Not browser-computed layout or screenshots.',assertions,states,layout:result,protectedDeclarations},null,2)+'\n');
console.log(`PASS ${assertions} React/UI/source checks and ${result.length} responsive text budgets.`);
