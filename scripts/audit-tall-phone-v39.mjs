// Resolve the published CSS and use the real layout functions; no browser or screenshots.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fitGameLayout } from '../src/components/kilo/layout.ts';
import { createControlLayout, controlTargets } from '../src/components/slot-controls/layout.ts';
import { prepareTree, productionCascade, resolveTree } from './control-css-cascade.mjs';

const html = readFileSync('dist/index.html', 'utf8');
const cssFile = 'dist' + html.match(/href="([^\"]+\.css)"/)[1];
const css = readFileSync(cssFile, 'utf8');
const cascade = productionCascade(css.replaceAll(':first-of-type', ':nth-of-type(1)').replace(/,\s+(?=env\()/g, ','));
const node = (tag, attrs = {}, children = []) => ({ tag, attrs, children });
const overlap = (a, b) => Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) + .01 && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y) + .01;
const rows = [];
for (const viewport of [[360,800], [390,844], [393,852], [412,915], [430,932], [360,960], [390,1200]]) {
  for (const review of [false, true]) for (const insets of [{top:0,right:0,bottom:0,left:0}, {top:47,right:0,bottom:34,left:0}]) {
    const app = node('div', {class:'kk-app', 'data-review':String(review)});
    const stage = node('main', {class:'kk-stage'});
    const shell = node('div', {class:'kk-shell', 'data-layout':'portrait', 'data-framing':'header'});
    app.children = [stage]; stage.children = [shell];
    const tree = prepareTree(node('html', {}, [node('body', {}, [app])]));
    const context = {viewport, hover:false};
    const length = value => {
      const expression = String(value).replace(/env\(safe-area-inset-(top|right|bottom|left)\)/g, (_,side) => insets[side])
        .replace(/100d?vh/g, String(viewport[1])).replace(/px/g,'').replace(/calc\(/g,'(').replace(/max\(/g,'Math.max(').replace(/min\(/g,'Math.min(');
      assert(/^[\d\s.,()+\-*/]+$/.test(expression.replace(/Math\.(?:min|max)/g,'')), `Unsupported length: ${value}`);
      return Function(`return (${expression})`)();
    };
    // The first pass only needs the app/stage; avoid unresolved shell variables.
    shell.attrs.style = '--game-height:0px;--game-width:0px;--header-height:0px;--reel-height:0px;--dock-height:160px;--dock-gap:0px;--reel-width:0px';
    let styles = resolveTree(tree, cascade, context);
    const stageStyle = styles.get(stage).values;
    const pad = Object.fromEntries(['top','right','bottom','left'].map(side => [side,length(stageStyle['padding-'+side])]));
    const reviewHeight = length(styles.get(app).vars['--review-height']);
    const availableWidth = viewport[0] - pad.left - pad.right;
    const availableHeight = viewport[1] - reviewHeight - pad.top - pad.bottom;
    const game = fitGameLayout(availableWidth, availableHeight);
    assert.equal(game.mode, 'portrait');
    const dock = createControlLayout({variant:'portrait',width:game.reelWidth,height:game.dock,footerWidth:game.reelWidth});
    shell.attrs.style = `--game-height:${game.height}px;--game-width:${game.width}px;--header-height:${game.header}px;--reel-height:${game.reelHeight}px;--dock-height:${dock.height}px;--dock-gap:0px;--reel-width:${game.reelWidth}px`;
    styles = resolveTree(tree, cascade, context);
    const shellStyle = styles.get(shell).values;
    const clearance = length(shellStyle['row-gap']);
    const shellHeight = length(shellStyle.height);
    assert.equal(stageStyle['align-items'] ?? stageStyle['place-items']?.split(/\s+/)[0], 'start');
    assert.equal(dock.height,160); assert.equal(clearance,16);
    assert(shellHeight <= availableHeight, 'Game overflows tall-phone height');
    assert(game.width <= availableWidth, 'Game overflows tall-phone width');
    const controlTop = reviewHeight + pad.top + game.header + game.reelHeight + clearance;
    for (const feature of [false,true]) {
      const targets = Object.entries(controlTargets(dock,feature));
      for (const [name,r] of targets) {
        assert(r.w >=44 && r.h >=44, `${name} is below 44px`);
        assert(r.x>=0 && r.y>=0 && r.x+r.w<=dock.width+.01 && r.y+r.h<=160.01);
        for (const [other,s] of targets) if(name<other) assert(!overlap(r,s),`${name}/${other} overlap`);
      }
    }
    rows.push({viewport,reviewHeight,safeInsets:insets,availableWidth,availableHeight,
      reelWidth:game.reelWidth,reelHeight:game.reelHeight,header:game.header,dockHeight:dock.height,clearance,
      shellTop:reviewHeight+pad.top,shellHeight,controlTop,
      shellBottom:reviewHeight+pad.top+shellHeight,
      viewportBelowShell:viewport[1]-(reviewHeight+pad.top+shellHeight),
      spareContentHeight:availableHeight-shellHeight,
      stateGeometry:'Base and feature share the same shell, reels and Spin rectangle.'});
  }
}
const out = 'public/kilo-portrait-v39'; mkdirSync(out,{recursive:true});
writeFileSync(out+'/tall-phone-check.json',JSON.stringify({version:'v39',method:'Production CSS cascade and calculated layout; not browser-computed bounds.',cssFile,cssSha256:createHash('sha256').update(css).digest('hex'),cases:rows.length,rows},null,2)+'\n');
console.log(JSON.stringify({result:'PASS',cases:rows.length,portraitStates:rows.length*2,report:out+'/tall-phone-check.json'}));
