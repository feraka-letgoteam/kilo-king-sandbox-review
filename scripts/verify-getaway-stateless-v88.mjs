/** v88: The Getaway is stateless. Each Max round is generated, presented and
 * settled on its own; nothing from a previous attempt (boat position, stall,
 * HUD or feature state) is read by the next one, and no storage holds it.
 * Run: node scripts/verify-getaway-stateless-v88.mjs */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';

const LIB = 'src/lib/kilo';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kilo-getaway-'));
for (const f of fs.readdirSync(LIB).filter(f => f.endsWith('.ts'))) {
  const js = ts.transpileModule(fs.readFileSync(path.join(LIB, f), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    .replace(/from\s+['"]\.\/([\w-]+?)(\.ts)?['"]/g, (_, m) => `from './${m}.mjs'`);
  fs.writeFileSync(path.join(tmp, f.replace(/\.ts$/, '.mjs')), js);
}
const E = await import(path.join(tmp, 'engine.mjs'));
const { vsSeeded } = await import(path.join(tmp, 'vs-progression.mjs'));
const { maxRevealFromDraw } = await import(path.join(tmp, 'max-spin-reveal.mjs'));
let checks = 0;
const ok = (c, m) => { assert(c, m); checks++; };

// 1. A Getaway record depends only on its own draws: identical whether it is
// generated first, after a stalled loss, after a win, or after other modes.
const fresh = seed => JSON.stringify(E.generateSplashCandidate(1000, 'getaway', vsSeeded(seed)));
const reference = new Map();
for (let seed = 1; seed <= 3000; seed++) reference.set(seed, fresh(seed));
const noise = vsSeeded(88);
for (let seed = 3000; seed >= 1; seed--) {
  const mode = ['spin', 'ante', 'buy', 'getaway'][Math.floor(noise() * 4)];
  E.playSplash(1000, mode, vsSeeded(Math.floor(noise() * 2 ** 32)));
  ok(fresh(seed) === reference.get(seed), `Getaway seed ${seed} independent of history`);
}
// 2. Every record is a single closed round: one spin, nothing held or pending.
let partial = 0;
for (const json of reference.values()) {
  const r = JSON.parse(json), spin = r.free[0], e = spin.mechanic, rec = e.reel;
  ok(r.free.length === 1 && spin.left === 0 && e.final === true, 'one closed spin');
  ok(e.heldBefore.length === 0 && e.heldAfter.length === 0 && e.pendingBefore === 0 && e.pendingAfter === 0, 'nothing carried in or out');
  ok(rec.type === 'binary' && (rec.won ? r.payout === 25_000_000 : r.payout === 0), 'all-or-nothing payout');
  if (!rec.won) { partial++; ok(rec.reveal.segments >= 1 && rec.reveal.segments <= 4, 'loss stops short of five'); }
}
ok(partial > 0, 'losses sampled');
// 3. The reveal stop is a pure function of the round's own draw.
for (const d of [0, .01, .05, .2, .5, .99]) ok(JSON.stringify(maxRevealFromDraw(d, .04)) === JSON.stringify(maxRevealFromDraw(d, .04)), 'pure reveal');
// 4. Presentation: the card/boat is destroyed at the end of each round, the Max
// completion clears HUD and feature state, and no Max code touches storage.
const card = fs.readFileSync('src/components/kilo/god-card-performance.ts', 'utf8');
ok(/} finally {[\s\S]{0,300}view\.destroy\(\)/.test(card), 'card destroyed at end of every round');
const play = fs.readFileSync('src/components/kilo/play.tsx', 'utf8');
const maxEnd = play.slice(play.indexOf('if (isMaxSpinRound(script)) {'), play.indexOf('} else if (done.feature) {'));
ok(maxEnd.includes('setHud(null)') && maxEnd.includes('setFeatureState?.(null)'), 'Max completion parks nothing');
ok(!/current\s*\?\s*{\s*\.\.\.current,\s*active:\s*false/.test(maxEnd), 'previous Max HUD is not retained');
for (const f of fs.readdirSync('src/components/kilo').filter(f => /^(god-|max-|reel-feature-)/.test(f)))
  ok(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(fs.readFileSync(path.join('src/components/kilo', f), 'utf8')), `${f} uses no storage`);
for (const f of ['reel-feature-math.ts', 'max-spin-reveal.ts', 'engine.ts'])
  ok(!/localStorage|sessionStorage|indexedDB/.test(fs.readFileSync(path.join(LIB, f), 'utf8')), `${f} uses no storage`);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`PASS ${checks} Getaway statelessness checks (3,000 seeds, history-independent; ${partial} partial-boat losses all closed).`);
