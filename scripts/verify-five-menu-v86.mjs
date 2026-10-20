/** Source/SSR + conservative text-box model, not a browser layout assertion. */
import fs from 'node:fs';import assert from 'node:assert/strict';
import React from 'react';import{renderToStaticMarkup}from'react-dom/server';
import {GlobalFonts,createCanvas}from'@napi-rs/canvas';
import{createOfflineRuntime}from'./offline-runtime-v79.mjs';
GlobalFonts.registerFromPath('public/kilo-ui-v11/fonts/SourceSans3-600.woff2','Source Sans 3');
GlobalFonts.registerFromPath('public/kilo-ui-v11/fonts/BarlowCondensed-600.woff2','Barlow Condensed');
const r=createOfflineRuntime(),{FeatureTakeoverView}=r.load('src/components/kilo/feature-takeover.tsx');
const {FEATURES}=r.load('src/components/kilo/feature-catalog.ts'),{PURCHASE_PRESENTATION}=r.load('src/components/kilo/feature-presentation.ts');
const quote=r.load('src/components/kilo/control-model.ts').purchaseQuote;
const props={ante:false,locked:false,onAnte(){},onEditBet(){},onStake(){},onBuy(){},onClose(){},onView(){},onConfirm(){}};
const cards=FEATURES.filter(f=>f.kind==='purchase'&&f.mode!=='chopper'),ctx=createCanvas(1,1).getContext('2d');
const textWidth=(t,size,font='Source Sans 3')=>{ctx.font=`600 ${size}px "${font}"`;return ctx.measureText(t).width;};
function lines(t,w,size,font){let line='',n=1;for(const word of t.split(' ')){assert(textWidth(word,size,font)<=w,`Required word fits ${word}`);const next=line?line+' '+word:word;if(line&&textWidth(next,size,font)>w){n++;line=word;}else line=next;}return n;}
const results=[];
for(const [width,height]of[[1440,900],[390,844],[360,800],[844,390]])for(const[stake,bank]of[[1000,1e6],[1000,0],[100000,1e6]]){
 const html=renderToStaticMarkup(React.createElement(FeatureTakeoverView,{...props,view:'features',stake,bank}));
 assert.equal((html.match(/data-feature-action=/g)||[]).length,4);assert(!/NaN|undefined/.test(html));
 const phone=height>500&&width<=600,land=height<=500;
 const columns=phone?2:4,shell=Math.min(width,land?1060:1020),content=shell-(phone?24:land?32:48),gap=phone?9:land?8:12;
 const grid=land?content-148:content,cardW=(grid-(columns-1)*gap)/columns,inner=cardW-(phone||land?22:38);
 const numberSize=phone?22:land?21:28,titleSize=phone?23:land?22:28,titleLine=phone?24:land?23:29;
 const summarySize=phone?12:land?11:15,summaryLine=phone?15:land?14:19;
 const heights=cards.map(f=>{
  const visual=PURCHASE_PRESENTATION[f.mode],q=quote(stake,f.mode,bank);
  assert(textWidth(q.cost.toLocaleString('en-US'),numberSize)<=inner,'Price stays on one line');
  const copy=(phone?8:land?6:13)+(phone?15:land?13:17)+lines(f.title.toUpperCase(),inner,titleSize,'Barlow Condensed')*titleLine+(phone?5:land?4:7)+lines(visual.summary,inner,summarySize)*summaryLine;
  const reason=q.reason??'Buy',button=Math.max(phone||land?44:46,lines(reason,inner-(phone||land?16:24),q.reason?(phone||land?11:13):(phone?16:land?15:17))* (q.reason?(phone?14:land?13:16):(phone?19:land?16:19))+(phone||land?12:16));
  const price=(phone?24:land?23:30)+1+(phone?13:land?12:15);
  const purchase=(phone?8:land?5:14)+price+(phone?7:land?5:8)+button;
  return(phone?72:land?56:202)+Math.max(phone?83:land?88:97,copy)+purchase+(phone?12:land?11:20);
 });
 const gridH=phone?Math.max(...heights.slice(0,2))+gap+Math.max(...heights.slice(2)):Math.max(...heights);
 const estimate=gridH+(phone?76+9:land?0:88+12)+(phone?44+50+18+16:land?44+44+10+12:44+52+28+36);
 assert(estimate<=height,`Conservative menu height ${estimate} <= ${height} at ${width}`);
 results.push({width,height,stake,bank,columns,cardWidth:cardW,estimatedMenuHeight:estimate,remainingHeight:height-estimate,minimumButton:44});
}
const confirm=renderToStaticMarkup(React.createElement(FeatureTakeoverView,{...props,view:'mystery',stake:1000,bank:1e6}));
assert(confirm.includes('data-testid="confirm-purchase"'));assert(confirm.includes('200,000'));assert(confirm.includes('Super Yacht'));assert(confirm.includes('1.2646%'));assert(confirm.includes('Charged once when you confirm.'));
const restricted=renderToStaticMarkup(React.createElement(FeatureTakeoverView,{...props,view:'features',stake:1000,bank:1e6,anteOnly:true}));assert(!restricted.includes('data-feature-action='));
fs.writeFileSync('art/kilo-v86/verification/menu.json',JSON.stringify({method:'Actual React SSR and conservative font-measured box model from authoritative breakpoint rules. Not computed browser CSS/DOM layout; live browser confirmation remains required.',results,confirmation:true,jurisdictionHidesAllBuys:true},null,2)+'\n');console.log(`PASS ${results.length} menu model cases + confirmation/flags`);
