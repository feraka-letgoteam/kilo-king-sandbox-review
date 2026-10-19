/** Offline SVG/Sharp proof of v56 production VS curves and real character parts.
 * NOT browser, Pixi/GPU, gameplay, or outcome-validation evidence.
 * The two recorded-style examples below are illustrative: this script never
 * supplies an outcome to the engine. Production TS supplies all joint curves
 * and reveal timing; SVG mirrors the current duelReveal/paintWild placements.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { loadProduction } from './kilo-v56-test-loader.mjs';

// Rasterize the same bundled numeric family rather than a host font fallback.
const fontDir = '/workspace/scratch/6281bb86619d/v56-vs-proof-fonts';
fs.mkdirSync(fontDir, { recursive: true });
execFileSync('python', ['-c', `import sys, types, subprocess
# fontTools is installed; use Node's native Brotli decoder in this environment.
decoder=types.ModuleType('brotli')
decoder.decompress=lambda data: subprocess.run(['node','-e','process.stdout.write(require("node:zlib").brotliDecompressSync(require("node:fs").readFileSync(0)))'],input=data,stdout=subprocess.PIPE,check=True).stdout
sys.modules['brotli']=decoder
from fontTools.ttLib import TTFont
for weight in [400,600,700]:
 f=TTFont('public/kilo-ui-v11/fonts/SourceSans3-'+str(weight)+'.woff2')
 f.flavor=None
 f.save('${fontDir}/SourceSans3-'+str(weight)+'.ttf')
`]);
fs.writeFileSync(`${fontDir}/fonts.conf`, `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>/usr/share/fonts</dir><dir>${fontDir}</dir><cachedir>${fontDir}/cache</cachedir></fontconfig>`);
process.env.FONTCONFIG_FILE = `${fontDir}/fonts.conf`;
const require = createRequire(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules', 'package.json'));
const sharp = require('sharp');
const { CHARACTER_RIGS, rigTransforms, visibleRigParts } = loadProduction('src/components/kilo/character-rig-model.ts');
const { characterPoseAt } = loadProduction('src/components/kilo/rig-performance.ts');
const { vsMotionAt, VS_REVEAL_MS } = loadProduction('src/components/kilo/feature-motion.ts');
const out = 'art/kilo-v56/proofs';
const frameDir = '/workspace/scratch/6281bb86619d/v56-vs-proof-frames';
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(frameDir, { recursive: true });
const W = 900, H = 660, cell = 160, FPS = 24, HOLD_MS = 500;
const GOLD = '#d8b66f', TEAL = '#89e6d9', WHITE = '#fff8e9', INK = '#07131a';
const examples = [
  { id: 'king', x: 205, winner: 'king', kingMultiplier: 8, viceMultiplier: 2, multiplier: 8 },
  { id: 'vice', x: 535, winner: 'vice', kingMultiplier: 2, viceMultiplier: 6, multiplier: 6 },
];
const partImages = {};
for (const actor of ['king', 'vice']) {
  const def = CHARACTER_RIGS[actor]; partImages[actor] = {};
  for (const [id, p] of Object.entries(def.parts)) {
    const { x: left, y: top, w: width, h: height } = p.frame;
    const png = await sharp('public' + def.atlas).extract({ left, top, width, height }).png().toBuffer();
    partImages[actor][id] = 'data:image/png;base64,' + png.toString('base64');
  }
}
function rig(actor, action = 'rest', progress = 0, expressive = false) {
  const def = CHARACTER_RIGS[actor], joints = rigTransforms(def, characterPoseAt(actor, action, progress));
  return visibleRigParts(def, expressive).map(([id, p]) => {
    const t = joints[id], f = p.frame;
    return `<g transform="translate(${t.x} ${t.y}) rotate(${t.rotation * 180 / Math.PI})"><image href="${partImages[actor][id]}" x="${-p.pivot[0]}" y="${-p.pivot[1]}" width="${f.w}" height="${f.h}"/></g>`;
  }).join('');
}
function label(value, x, y, size, fill = WHITE, extra = '') {
  return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="Source Sans 3" font-size="${size}" font-weight="800" fill="${fill}" stroke="${INK}" stroke-width="3" paint-order="stroke" ${extra}>${value}</text>`;
}
function note(value, x, y, size = 14, fill = '#a6bdbd') {
  return `<text x="${x}" y="${y}" text-anchor="middle" font-family="sans-serif" font-size="${size}" fill="${fill}">${value}</text>`;
}
function bust(example, actor, t, beat) {
  const isKing = actor === 'king', top = cell * (isKing ? .36 : 1.67), clip = `${example.id}-${actor}`;
  const loser = example.winner !== actor, dx = loser ? cell * .2 * beat.resolve * (isKing ? -1 : 1) : 0;
  const action = t > .60 && loser ? 'defeat' : 'challenge';
  const scale = cell * .95 / 260;
  return `<g transform="translate(${dx} 0)">
    <rect x="6" y="${top}" width="${cell - 12}" height="${cell * .98}" fill="${isKing ? '#332319' : '#12353c'}"/>
    <defs><clipPath id="${clip}"><rect x="5" y="${top}" width="${cell - 10}" height="${cell * .98}"/></clipPath></defs>
    <g clip-path="url(#${clip})"><g transform="translate(${cell / 2} ${top}) scale(${scale}) translate(-192 -28)">${rig(actor, action, beat.challenge)}</g></g>
    ${label(`×${isKing ? example.kingMultiplier : example.viceMultiplier}`, cell / 2, cell * (isKing ? .22 : 2.77), Math.max(20, cell * .30), isKing ? GOLD : TEAL)}
  </g>`;
}
function wild(example, t, resting = false) {
  const edge = example.winner === 'vice' ? TEAL : GOLD;
  const h = cell * 3, scale = Math.min(cell * .98 / 260, cell * 2.4 / 552);
  const progress = Math.max(0, Math.min(1, (t - .60) / .40));
  return `<rect x="3" y="2" width="${cell - 6}" height="${h - 4}" fill="${example.winner === 'vice' ? '#0b2830' : '#241b15'}" stroke="${edge}" stroke-width="2"/>
    <path d="M7 8V${h - 12}M${cell - 7} 8V${h - 12}" stroke="${edge}" stroke-width="1" opacity=".38"/>
    <path d="M5 4H${cell - 5}V${cell * .38}L${cell / 2} ${cell * .47}L5 ${cell * .38}Z" fill="#031017" stroke="${edge}" stroke-width="1"/>
    <rect x="5" y="${h - cell * .34}" width="${cell - 10}" height="${cell * .28}" fill="#031017"/>
    <g transform="translate(${cell / 2} ${cell * 2.68}) scale(${scale}) translate(-192 -552)">${rig(example.winner, resting ? 'rest' : 'victory', progress, !resting && t > .72 && t < .92)}</g>
    ${label(`×${example.multiplier}`, cell / 2, cell * .24, Math.max(19, cell * .28), TEAL)}
    ${label('WILD', cell / 2, h - cell * .18, Math.max(12, cell * .16), GOLD)}`;
}
function duel(example, t, settled = false) {
  const beat = vsMotionAt(t, false), h = (cell * 3 - 4) * beat.expand, top = (cell * 3 - h) / 2;
  let svg = `<rect x="3" y="${top}" width="${cell - 6}" height="${h}" fill="${INK}" stroke="${GOLD}" stroke-width="2"/>`;
  if (beat.candidates && !settled) {
    const alpha = t < .60 ? Math.min(1, (t - .16) / .07) : 1 - beat.resolve;
    svg += `<g opacity="${Math.max(0, alpha)}">${bust(example, 'king', t, beat)}${bust(example, 'vice', t, beat)}
      <path d="M${cell * .5} ${cell * 1.22}L${cell * .86} ${cell * 1.5}L${cell * .5} ${cell * 1.78}L${cell * .14} ${cell * 1.5}Z" fill="#061116" stroke="${GOLD}" stroke-width="2"/>
      ${label('VS', cell / 2, cell * 1.5, Math.max(24, cell * .4))}</g>`;
  }
  // Production slash is added after opponents and before the whole-reel winner.
  if (t >= .56 && t < .74 && !settled) {
    const u = (t - .56) / .18;
    svg += `<path d="M6 ${cell * (1.7 - .4 * u)}L${cell - 6} ${cell * (1.3 + .4 * u)}" stroke="${WHITE}" stroke-width="${Math.max(2, cell * .035)}" opacity="${1 - u}"/>`;
  }
  if (t >= .82 && t < 1 && !settled) {
    const u = beat.lock, edge = example.winner === 'king' ? GOLD : TEAL;
    svg += `<path d="M5 5V${5 + (cell * 3 - 10) * u}M${cell - 5} 5V${5 + (cell * 3 - 10) * u}" stroke="${edge}" stroke-width="3" opacity="${1 - u * .6}"/>`;
  }
  if (beat.winner || settled) svg += `<g opacity="${settled ? 1 : beat.resolve}" transform="translate(0 ${settled ? 0 : (1 - beat.resolve) * cell * .08})">${wild(example, t, settled)}</g>`;
  return svg;
}
async function frameAt(milliseconds, target) {
  const t = Math.min(1, Math.max(0, milliseconds / VS_REVEAL_MS)), settled = milliseconds >= VS_REVEAL_MS;
  const phase = settled ? 'Sticky wilds · stable hold' : t < .16 ? 'Expand' : t < .60 ? 'Challenge' : t < .82 ? 'Resolve recorded winner' : 'Lock and settle';
  let body = note('OFFLINE ART PROOF — not browser playback', W / 2, 27, 19, WHITE)
    + note('Production v56 joint curves and reveal timing · illustrative recorded multipliers', W / 2, 51, 13);
  for (const example of examples) {
    body += note(`KING ×${example.kingMultiplier} / VICE ×${example.viceMultiplier}`, example.x + cell / 2, 82, 14, WHITE);
    body += `<defs><clipPath id="board-${example.id}"><rect width="${cell}" height="${cell * 3}"/></clipPath></defs>
      <g transform="translate(${example.x} 95)"><rect width="${cell}" height="${cell * 3}" fill="#031017"/>
      <g clip-path="url(#board-${example.id})">${duel(example, t, settled)}</g></g>`;
    body += note(`${example.winner.toUpperCase()} wins · ×${example.multiplier} persists`, example.x + cell / 2, 598, 14, example.winner === 'king' ? GOLD : TEAL);
  }
  body += note(`${Math.round(milliseconds)} ms · ${phase}`, W / 2, 633, 14, '#c9d7d4');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#061820"/>${body}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(target);
}
const count = Math.ceil((VS_REVEAL_MS + HOLD_MS) / 1000 * FPS);
for (let i = 0; i < count; i++) await frameAt(i / FPS * 1000, `${frameDir}/${String(i).padStart(4, '0')}.png`);
await frameAt(VS_REVEAL_MS * .44, `${out}/vs-challenge.png`);
await frameAt(VS_REVEAL_MS + HOLD_MS, `${out}/vs-motion.png`);
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', `${frameDir}/%04d.png`, '-c:v', 'libx264', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${out}/vs-motion.mp4`]);
fs.writeFileSync(`${out}/vs-proof.json`, JSON.stringify({
  kind: 'offline SVG/Sharp artwork proof; not browser or Pixi/GPU playback',
  dimensions: [W, H], fps: FPS, frameCount: count,
  productionRevealMs: VS_REVEAL_MS, requestedStableHoldMs: HOLD_MS,
  clipDurationMs: count / FPS * 1000,
  examples: examples.map(({ x, ...example }) => example),
  productionImports: ['vsMotionAt', 'VS_REVEAL_MS', 'CHARACTER_RIGS', 'rigTransforms', 'visibleRigParts', 'characterPoseAt'],
  geometrySource: 'duelReveal and paintWild in src/components/kilo/reel-feature-effects.ts',
  limitations: ['SVG text rasterization is not Pixi Text rendering', 'No live interaction, wallet, settlement, engine or GPU validation', 'Two illustrative outcome examples, not a randomly generated spin'],
}, null, 2) + '\n');
console.log(`Wrote ${count} normal-speed proof frames plus VS challenge/stable PNGs; reveal ${VS_REVEAL_MS} ms.`);
