// Render actual React purchase and rules markup. No browser screenshots.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/"))
      specifier = new URL("../src/" + specifier.slice(2), import.meta.url).href;
    if (
      (specifier.startsWith(".") || specifier.startsWith("file:")) &&
      !/\.(tsx?|css|m?js)$/.test(specifier)
    ) {
      const url = new URL(specifier, context.parentURL);
      for (const ext of [".ts", ".tsx"])
        if (existsSync(fileURLToPath(url) + ext))
          return next(url.href + ext, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if(url.endsWith(".json"))return {format:"module",source:`export default ${readFileSync(fileURLToPath(url),"utf8")};`,shortCircuit:true};
    if (url.endsWith(".css"))
      return { format: "module", source: "export {};", shortCircuit: true };
    if (/\.tsx?$/.test(url))
      return {
        format: "module",
        shortCircuit: true,
        source: transpile(readFileSync(fileURLToPath(url), "utf8")),
      };
    return next(url, context);
  },
});
function transpile(source) {
  return ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
}
const { createElement: el } = await import("react");
const { renderToStaticMarkup: render } = await import("react-dom/server");
const { FeatureTakeoverView } =
  await import("../src/components/kilo/feature-takeover.tsx");

const { FEATURES } = await import('../src/components/kilo/feature-catalog.ts');
const { InfoPanel } = await import('../src/components/kilo/info-panel.tsx');
const { BonusEntryScene } = await import('../src/components/kilo/BonusEntryScene.tsx');
const { sceneForRound, phaseForPresentation } = await import('../src/components/kilo/scene-system.ts');
const { splashCost } = await import('../src/lib/kilo/engine.ts');
const examples=JSON.parse(readFileSync('art/kilo-features-v51/playable-examples.json','utf8'));
const noop=()=>{};
const props={stake:100,bank:1000000,ante:false,locked:false,onAnte:noop,onEditBet:noop,onStake:noop,onBuy:noop,onClose:noop,onView:noop,onConfirm:noop,reducedMotion:true};
const results=[];
for(const feature of FEATURES.filter(f=>f.kind==='purchase'))for(const variant of ['valid','balance','limit']){
  const stake=variant==='limit'?100000:100,bank=variant==='balance'?0:100000000;
  const html=render(el(FeatureTakeoverView,{...props,view:feature.mode,stake,bank}));
  assert(html.includes(feature.title));assert(html.includes(splashCost(stake,feature.mode).toLocaleString('en-US')));
  const button=html.match(/<button[^>]*data-testid="confirm-purchase"[^>]*>/)?.[0];assert(button);
  assert.equal(button.includes('disabled'),variant!=='valid');
  assert(html.includes(variant==='balance'?'Insufficient balance':variant==='limit'?'purchase limit':'Confirm purchase'));
  assert(!html.includes('modifier may increase'));
  results.push({mode:feature.mode,variant,passed:true});
}
const gallery=render(el(FeatureTakeoverView,{...props,view:'features'}));
for(const mode of ['buy','yacht','chopper','getaway'])assert(gallery.includes(`data-feature-action="${mode}"`));
const restricted=render(el(FeatureTakeoverView,{...props,view:'features',anteOnly:true}));
for(const mode of ['buy','yacht','chopper','getaway'])assert(!restricted.includes(`data-feature-action="${mode}"`));
const info=render(el(InfoPanel,{stake:1000,round:{line:0,collect:0,scatter:0},onClose:noop,onSettings:noop}));
for(const title of ['Dockside Catch','Yacht Stash','Chopper Route','The Getaway'])assert(info.includes(title));
assert(!info.includes('Neither can currently be played'));assert(info.includes('Not verified'));
assert(!info.includes('the lower of'));
assert(info.includes('25,000× the base bet'));
const highBetInfo=render(el(InfoPanel,{stake:10000,round:{line:0,collect:0,scatter:0},onClose:noop,onSettings:noop}));
assert(highBetInfo.includes('250,000,000'));
assert(!highBetInfo.includes('5,000,000'));
for(const mode of ['buy','yacht','chopper','getaway']){
  const round=examples[mode],html=render(el(BonusEntryScene,{round,scene:sceneForRound(round),reducedMotion:true}));
  assert(html.includes(mode==='getaway'?'Cases · three checkpoints':'Free spins'));
}
assert.equal(phaseForPresentation({booted:true,summary:null,round:examples.getaway,hud:{active:true,phase:'entry',note:'The Getaway · three cases · three checkpoints'}}),'entry');
for(const path of ['src/lib/kilo/bank.ts','src/components/kilo/layout.ts','src/components/slot-controls/layout.ts','src/components/slot-controls/tokens.ts','src/components/slot-controls/controls.css','src/components/kilo/modular-controls.css'])assert.equal(readFileSync(path,'utf8'),execFileSync('git',['show',`19139a6:${path}`],{encoding:'utf8'}),`Protected ${path}`);
writeFileSync('art/kilo-features-v51/ui-verification.json',JSON.stringify({method:'Actual React SSR markup; source equality for bank, geometry and control styling. No browser layout or screenshots.',results,entryModes:4,jurisdictionGallery:true,protectedGeometry:true},null,2)+'\n');
console.log('PASS 12 real purchase-confirmation states, 4 entries, mode rules, jurisdiction gallery and unchanged geometry/control CSS.');
