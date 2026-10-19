/** Actual React server markup checks. Not CSS-layout, browser or screenshot evidence. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createOfflineRuntime} from './offline-runtime-v79.mjs';
import {sourceFingerprint} from './v79-source-fingerprint.mjs';
const output='art/kilo-v79/ui-markup';fs.mkdirSync(output,{recursive:true});
const runtime=createOfflineRuntime(),load=runtime.load;
const {LoadingScreen,CompletionScreenContent}=load('src/components/kilo/SceneScreens.tsx');
const {FeatureTakeoverView}=load('src/components/kilo/feature-takeover.tsx');
const {BonusEntryScene}=load('src/components/kilo/BonusEntryScene.tsx');
const {ReelFeatureCompletion}=load('src/components/kilo/ReelFeatureCompletion.tsx');
const {FEATURE_ART}=load('src/components/kilo/feature-presentation.ts');
const fixture=load('src/lib/kilo/fixtures.json')['tool-bazooka'].script;
const noop=()=>{};
const purchase={stake:1000,bank:10000000,ante:false,locked:false,onAnte:noop,onStake:noop,onEditBet:noop,onBuy:noop,onClose:noop,onView:noop,onConfirm:noop};
const examples=[
 ['loading-card',LoadingScreen,{ready:true,artReady:true,error:'',onRetry:noop,onEnter:noop,reducedMotion:false}],
 ['completion-win',CompletionScreenContent,{payout:14826000,purchaseCost:200000,celebrate:true,bonusName:'Dockside Catch',onContinue:noop,reducedMotion:false}],
 ['feature-menu',FeatureTakeoverView,{...purchase,view:'features'}],
 ['feature-confirmation',FeatureTakeoverView,{...purchase,view:'yacht'}],
 ['entry-dock',BonusEntryScene,{scene:'scatter-3',round:fixture,reducedMotion:false}],
 ['reel-completion-win',ReelFeatureCompletion,{name:'Yacht Stash',feature:'yacht',payout:14826000,cost:200000,maxed:false,onContinue:noop}],
];
const rows=[];
for(const[name,component,props]of examples){
 const markup=renderToStaticMarkup(React.createElement(component,props));
 assert(!markup.includes('NaN'),'No invalid amount');
 const urls=[...new Set([...markup.matchAll(/(?:src|href|xlink:href)="(\/[^"?#]+)(?:[^\"]*)"/g)].map(m=>m[1]))];
 const assets=urls.map(url=>{assert(fs.existsSync('public'+url),`${name}: missing active asset ${url}`);const bytes=fs.readFileSync('public'+url);return{url,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};});
 const path=`${output}/${name}.html`;fs.writeFileSync(path,`<!doctype html><html><head><meta charset="utf-8"><title>${name} — server markup proof</title></head><body>${markup}</body></html>\n`);
 rows.push({name,path,assets,markupSha256:crypto.createHash('sha256').update(markup).digest('hex')});
 if(name==='completion-win')assert(markup.includes('14,826,000')&&markup.includes('200,000')&&markup.includes('Continue'),'Completion full return/cost/actions');
 if(name==='feature-menu')assert(markup.includes('Choose your feature')&&markup.includes('Chopper Route'),'Feature copy retained');
 if(name==='reel-completion-win')assert(markup.includes(FEATURE_ART.yacht),'Result uses active shared emblem');
}
const report={sourceFingerprint:sourceFingerprint(),method:'Actual production React server markup. No browser, layout engine, focus/interaction, CSS overflow or screenshot claim.',viewportsToReview:[[1440,900],[390,844]],rows};
fs.writeFileSync('art/kilo-v79/ui-markup-verification.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:rows.length,method:report.method}));
