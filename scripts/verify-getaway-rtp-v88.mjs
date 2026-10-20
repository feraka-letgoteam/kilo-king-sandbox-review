/** v88: The Getaway targets 96.7% RTP exactly (p = 967/25000 = 0.03868).
 * Exact (analytic) check plus the record/reveal contracts that depend on p.
 * Run: node scripts/verify-getaway-rtp-v88.mjs */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';

const LIB = 'src/lib/kilo';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kilo-getaway-rtp-'));
for (const f of fs.readdirSync(LIB).filter(f => f.endsWith('.ts'))) {
  const js = ts.transpileModule(fs.readFileSync(path.join(LIB, f), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    .replace(/from\s+['"]\.\/([\w-]+?)(\.ts)?['"]/g, (_, m) => `from './${m}.mjs'`);
  fs.writeFileSync(path.join(tmp, f.replace(/\.ts$/, '.mjs')), js);
}
const { REEL_FEATURE_PROFILE, runReelFeature } = await import(path.join(tmp, 'reel-feature-math.mjs'));
const { maxRevealFromDraw } = await import(path.join(tmp, 'max-spin-reveal.mjs'));
const E = await import(path.join(tmp, 'engine.mjs'));
const p = REEL_FEATURE_PROFILE.getawayWinChance;
let checks = 0; const ok = (c, m) => { assert(c, m); checks++; };

ok(p === 967 / 25000 && Math.abs(p - 0.03868) < 1e-15, `p = 0.03868 (got ${p})`);
const rtp = 25000 * p / 1000;
ok(Math.abs(rtp - 0.967) < 1e-12, `exact RTP 96.7% (got ${rtp})`);
ok(E.splashCost(100, 'getaway') === 100_000, 'cost 1,000x');

// Hit rate 1 in 25.85; SD of return in cost units.
const sd = 25 * Math.sqrt(p * (1 - p));
// Threshold contract: draw < p wins, draw >= p loses.
ok(runReelFeature('getaway', 1000, () => p, 25_000_000).total === 0, 'threshold loss');
ok(runReelFeature('getaway', 1000, () => p - 1e-9, 25_000_000).total === 25_000_000, 'threshold win');
// Reveal stops (v59/v62 contract) still map to the same segments.
for (const [draw, seg] of [[.8, 1], [.3, 2], [.12, 3], [.06, 4], [.01, 5]])
  ok(maxRevealFromDraw(draw, p).segments === seg, `reveal draw ${draw} -> ${seg}`);
// Exact segment probabilities from the reveal gates p^(k/4).
const gate = k => Math.pow(p, k / 4);
const seg = { 1: 1 - gate(1), 2: gate(1) - gate(2), 3: gate(2) - gate(3), 4: gate(3) - gate(4), 5: gate(4) };
// Empirical cross-check of the gate model on a fine grid of draws.
const N = 200_000, counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
for (let i = 0; i < N; i++) counts[maxRevealFromDraw((i + .5) / N, p).segments]++;
for (const k of [1, 2, 3, 4, 5]) ok(Math.abs(counts[k] / N - seg[k]) < 2 / N + 1e-9, `segment ${k} share`);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(JSON.stringify({ pass: true, checks, p, rtp, hitRate: p, oneIn: 1 / p, sdPerCost: sd,
  revealSegments: Object.fromEntries(Object.entries(seg).map(([k, v]) => [k, +v.toFixed(6)])) }));
