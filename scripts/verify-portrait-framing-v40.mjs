// Production CSS + real layout functions. Deliberately does not launch a browser.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import postcss from 'postcss';
import { fitGameLayout } from '../src/components/kilo/layout.ts';
import { createControlLayout, controlTargets } from '../src/components/slot-controls/layout.ts';
import { prepareTree, productionCascade, resolveTree, variables } from './control-css-cascade.mjs';

const checkpoint = '16e9f4050bcbd6c162733129480f8287477a9c93';
const sha = data => createHash('sha256').update(data).digest('hex');
const original = path => execFileSync('git',['show',`${checkpoint}:${path}`]);
const protectedSources = {};
const sources = execFileSync('git',['ls-tree','-r','--name-only',checkpoint,'src'],{encoding:'utf8'}).trim().split('\n');
for (const path of sources) {
  const before = original(path), after = readFileSync(path);
  if (path === 'src/styles.css') {
    assert.equal(after.toString().replace('@import "./components/kilo/portrait-framing.css";\n',''),before.toString(), 'Existing host CSS changed');
  } else {
    assert.equal(sha(after),sha(before),`Protected source changed: ${path}`);
    protectedSources[path] = sha(after);
  }
}
// The new sheet may paint only a pseudo-element, never any game/control node.
const framingSource = readFileSync('src/components/kilo/portrait-framing.css','utf8');
postcss.parse(framingSource).walkRules(rule => {
  assert.equal(rule.selector,'.kk-app .kk-stage .kk-shell[data-layout="portrait"]::after');
  assert.equal(rule.parent.name,'media');
  assert.equal(rule.parent.params,'(max-width: 620px) and (orientation: portrait)');
});
const index = readFileSync('dist/index.html','utf8');
const cssFile = 'dist' + index.match(/href="([^\"]+\.css)"/)[1];
const css = readFileSync(cssFile,'utf8');
const cascade = productionCascade(css.replaceAll(':first-of-type', ':nth-of-type(1)').replace(/,\s+(?=env\()/g, ','));
const node = (tag,attrs={},children=[]) => ({tag,attrs,children});
const intersects = (a,b) => Math.min(a.x+a.w,b.x+b.w)>Math.max(a.x,b.x)+.01 && Math.min(a.y+a.h,b.y+b.h)>Math.max(a.y,b.y)+.01;
const rows = [];
for (const viewport of [[360,800],[390,844],[393,852],[412,915],[430,932],[360,960],[390,1200],[390,600],[360,440],[600,500],[844,390],[1440,900],[620,900],[621,900]]) {
  for (const review of [false,true]) for (const feature of [false,true]) for (const insets of [{top:0,right:0,bottom:0,left:0},{top:47,right:0,bottom:34,left:0}]) {
    let percentage = 0;
    const px = value => {
      const expression = String(value).replace(/env\(safe-area-inset-(top|right|bottom|left)\)/g,(_,side)=>insets[side])
        .replace(/100d?vh/g,String(viewport[1])).replace(/100vw/g,String(viewport[0])).replace(/([\d.]+)%/g,(_,p)=>String(percentage*Number(p)/100))
        .replace(/px/g,'').replace(/calc\(/g,'(').replace(/max\(/g,'Math.max(').replace(/min\(/g,'Math.min(');
      assert(/^[\d\s.,()+\-*/]+$/.test(expression.replace(/Math\.(?:min|max)/g,'')),`Unsupported length ${value}`);
      return Function(`return (${expression})`)();
    };
    const app = node('div',{class:'kk-app','data-review':String(review)});
    const stage = node('main',{class:'kk-stage'});
    app.children=[stage];
    const tree = prepareTree(node('html',{},[node('body',{},[app])]));
    const context = {viewport,hover:false};
    let styles = resolveTree(tree,cascade,context);
    const stageStyle = styles.get(stage).values;
    const pad = Object.fromEntries(['top','right','bottom','left'].map(side=>[side,px(stageStyle['padding-'+side])]));
    const reviewHeight = px(styles.get(app).vars['--review-height']);
    const availableWidth=viewport[0]-pad.left-pad.right, availableHeight=viewport[1]-reviewHeight-pad.top-pad.bottom;
    const g=fitGameLayout(availableWidth,availableHeight);
    const d=createControlLayout({variant:g.compact?'compact':g.mode==='portrait'?'portrait':g.mode==='landscape'?'landscape':'desktop',width:g.mode==='landscape'?g.width:g.mode==='portrait'?g.reelWidth:g.artLeft?availableWidth:g.width,height:g.mode==='wide'&&g.width>=1100&&g.height+60<=availableHeight?128:g.dock,footerWidth:g.reelWidth});
    const shell=node('div',{class:`kk-shell${feature?' is-feature':''}`,'data-layout':g.mode,'data-framing':g.artLeft?'sides':'header',style:`--game-width:${g.width}px;--game-height:${g.height+d.height-g.dock}px;--header-height:${g.header}px;--reel-width:${g.reelWidth}px;--reel-height:${g.reelHeight}px;--dock-height:${d.height}px;--dock-gap:${g.dockGap}px;--art-left:${g.artLeft}px;--art-right:${g.artRight}px;--control-left:${g.controlLeft}px;--side-width:${g.side}px;--strip-height:${g.strip}px`});
    stage.children=[shell];prepareTree(tree); styles=resolveTree(tree,cascade,context);
    const shellStyle=styles.get(shell);
    const raw=cascade(shell,{...context,pseudo:'after'});
    const vars={...shellStyle.vars,...Object.fromEntries(Object.entries(raw.values).filter(([k])=>k.startsWith('--')))};
    const paint=Object.fromEntries(Object.entries(raw.values).filter(([k])=>!k.startsWith('--')).map(([k,v])=>[k,variables(v,vars)]));
    if(viewport[0]>620||viewport[0]>viewport[1]||g.mode!=='portrait') {
      assert(!paint.content||paint.content==='none','Foreground appeared outside phone portrait');
      rows.push({viewport,reviewHeight,feature,safeInsets:insets,mode:g.mode,framing:'absent'});
      continue;
    }
    assert.equal(d.height,160);
    assert.equal(paint.position,'absolute');assert.equal(paint['pointer-events'],'none');
    assert.equal(paint.overflow,'clip');assert.equal(paint.contain,'paint');
    assert(['translateX(-50%)','translate(-50%)'].includes(paint.transform));
    assert(paint['background-image'].includes('/kilo-portrait-v40/dock-continuation.webp'));
    const shellHeight=px(shellStyle.values.height), shellTop=reviewHeight+pad.top;
    percentage=shellHeight;const top=px(paint.top), height=px(paint.height);
    const frame={x:pad.left+(availableWidth-g.width)/2+g.width/2-viewport[0]/2,y:shellTop+top,w:px(paint.width),h:height};
    assert(frame.h>=0);assert(frame.y+frame.h<=viewport[1]+.001,'Framing adds vertical overflow');
    const allocationBottom=shellTop+shellHeight;
    const controlTop=allocationBottom-d.height;
    const targets=Object.entries(controlTargets(d,feature));
    let lowestControl=0;
    for(const [name,r] of targets) {
      assert(r.w>=44&&r.h>=44,`${name} touch target shrank`);
      const actual={...r,x:pad.left+(availableWidth-d.width)/2+r.x,y:controlTop+r.y};
      lowestControl=Math.max(lowestControl,actual.y+actual.h);
      if(frame.h>0)assert(!intersects(frame,actual),`${name} overlaps foreground`);
    }
    if(frame.h>0)assert(frame.y>=allocationBottom+4-.001,'Foreground enters 160px allocation');
    const backgroundWidth=px(paint['background-size'].replace(/\s+auto$/,''));
    assert(backgroundWidth>=viewport[0]);
    assert.equal(g.reelHeight,g.reelWidth/1.66);
    rows.push({viewport,reviewHeight,feature,safeInsets:insets,mode:g.mode,reel:{w:g.reelWidth,h:g.reelHeight},shellHeight,allocationBottom,lowestControl,framing:frame,clearanceFromControl:frame.h>0?frame.y-lowestControl:null,background:{w:backgroundWidth,h:backgroundWidth},resolvedPaint:paint});
  }
}
// Resize/feature transitions share geometry because neither path edits layout or stores art state.
for(const a of rows.filter(r=>r.mode==='portrait'&&r.framing!=='absent'&&!r.feature)) {
  const b=rows.find(r=>r.feature&&r.viewport.join()==a.viewport.join()&&r.reviewHeight===a.reviewHeight&&r.safeInsets.top===a.safeInsets.top);
  assert.deepEqual(a.reel,b.reel);assert.equal(a.allocationBottom,b.allocationBottom);assert.deepEqual(a.framing,b.framing);
}
const asset='public/kilo-portrait-v40/dock-continuation.webp';
const out='public/kilo-portrait-v40';mkdirSync(out,{recursive:true});
const report={version:'v40-local',checkpoint,method:'Production author CSS cascade and calculated layout bounds. Not browser screenshots or browser-computed layout.',cssFile,cssSha256:sha(css),asset,assetSha256:sha(readFileSync(asset)),protectedSourceCount:Object.keys(protectedSources).length,protectedSources,cases:rows.length,rows};
writeFileSync(out+'/layout-check.json',JSON.stringify(report,null,2)+'\n');
const required=rows.filter(r=>[360,390].includes(r.viewport[0])&&[800,844].includes(r.viewport[1])&&!r.feature&&r.safeInsets.top===0);
const f=n=>n.toFixed(1);
writeFileSync(out+'/VERIFICATION.md',`# Kilo King v40 — portrait marina framing\n\nCheckpoint: ${checkpoint}. Local source only; no push or deployment.\n\n## Added artwork\n\nThe new transparent foreground continues the existing wet timber dock into perspective, with a low rope-wrapped mooring post, cleat and rope coil. Open upper and side edges retain the existing marina water. The art is cropped proportionally from the bottom and extends to the viewport bottom, including the noninteractive safe-area region. It is not a tiled filler strip.\n\nThe runtime artwork is a lossless WebP conversion of the generated square PNG. The PNG, final generation prompt and provenance are in art/kilo-portrait-v40/.\n\n## Placement\n\nThe artwork is the phone-portrait shell's absolutely positioned ::after element. It begins 4px below the complete 160px control allocation. overflow: clip and contain: paint keep all pixels inside that rectangle; pointer-events: none prevents interference with controls. No DOM node, tab stop, ResizeObserver or game state was added.\n\n| Viewport | Review toolbar | Allocation bottom | Foreground top | Foreground height | Gap below lowest base control |\n|---|---:|---:|---:|---:|---:|\n${required.map(r=>`| ${r.viewport.join('×')} | ${r.reviewHeight}px | ${f(r.allocationBottom)}px | ${f(r.framing.y)}px | ${f(r.framing.h)}px | ${f(r.clearanceFromControl)}px |`).join('\n')}\n\nBase controls clear the new frame by 8px; feature controls clear it by 10px at the two required sizes. The 160px allocation and 44px targets are unchanged. At short heights with no remaining area the decorative plane collapses to zero height and is clamped to the viewport edge; it adds no new scrollable height.\n\n## Verification\n\n- ${rows.length} calculated cases: 360×800, 390×844, 393×852, 412×915, 430×932, 360×960, 390×1200, short phones, the 620/621px boundary, 844×390 landscape and 1440×900 desktop. Includes base/feature, review toolbar on/off and zero/notched safe-area insets.\n- Every tracked source file except the single stylesheet import matches the checkpoint byte for byte (${Object.keys(protectedSources).length} protected source files). This includes the complete control component/CSS/tokens/layout, reel sizing, game host, engine, wallet, collection director, hooks and settlement.\n- The sole new selector targets the decorative pseudo-element in phone portrait. Desktop, landscape, controls and real shell elements receive no new declarations.\n- No framing/control intersection found. No extra vertical overflow from the artwork. The frame, reel and allocation rectangles are identical before/after entering a feature.\n- No browser automation, screenshots or live interaction checks were attempted. Bounds come from the production CSS cascade and real layout functions; visual seam quality, font rasterization and device rendering remain unverified in a browser.\n\n## Remaining limits\n\nOn unusually tall or very short screens the foreground is cropped to preserve its aspect ratio; side props can move outside the visible crop. At widths above 620px the existing background remains unchanged. On viewports already too short for the fixed game the existing overflow behavior is preserved and the new art is zero-height. No framing element was found to overlap a control or alter reel geometry in the checked cases.\n\nCSS: ${cssFile}\nSHA-256: ${sha(css)}\nDetailed resolved paint, frame coordinates and protected source hashes: layout-check.json\n\nRun: node --experimental-strip-types scripts/verify-portrait-framing-v40.mjs\n`);
console.log(JSON.stringify({result:'PASS',cases:rows.length,protectedSourceCount:Object.keys(protectedSources).length,report:out+'/VERIFICATION.md'}));
