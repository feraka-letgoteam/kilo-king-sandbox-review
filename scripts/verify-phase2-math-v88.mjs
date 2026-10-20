/** v88 phase 2: exact in-game RTP of every mode from the shipped outcome catalogues.
 * Every catalogue entry is regenerated through the same engine call playSplash uses, so the
 * result is the game's exact return (local candidate, not certified Stake Engine RTP).
 * Asserts: each mode <= 96.70% (exact integer test) and within 1e-6 of it; all modes within
 * 0.5%; minimum weight 1; Mystery Dock/Yacht picks return the bought modes' RTP; max win
 * more frequent than 1 in 10M. With KILO_BOOKS=<dir> it also compares every entry with the
 * Stake Engine lookup tables (lookUpTable_<mode>_0.csv) written by phase2/builders/export-books.mjs.
 * Run: node scripts/verify-phase2-math-v88.mjs */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';

const LIB = 'src/lib/kilo', STAKE = 1000, TARGET = 967n, SCALE = 1000n; // 96.7%
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kilo-p2-'));
for (const f of fs.readdirSync(LIB).filter(f => f.endsWith('.ts'))) {
  const js = ts.transpileModule(fs.readFileSync(path.join(LIB, f), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    .replace(/from\s+['"]\.\/([\w-]+?)(\.ts)?['"]/g, (_, m) => `from './${m}.mjs'`);
  fs.writeFileSync(path.join(tmp, f.replace(/\.ts$/, '.mjs')), js);
}
const E = await import(path.join(tmp, 'engine.mjs'));
const { vsSeeded } = await import(path.join(tmp, 'vs-progression.mjs'));
const { REEL_FEATURE_PROFILE } = await import(path.join(tmp, 'reel-feature-math.mjs'));
const { VS_OUTCOME_CATALOGUE, VS_CATALOGUE_TOTAL_WEIGHT } = await import(path.join(tmp, 'vs-outcome-catalogue.mjs'));
const { EXPERIENCE_CATALOGUES, EXPERIENCE_WEIGHT_TOTAL } = await import(path.join(tmp, 'experience-outcome-catalogue.mjs'));
const { MYSTERY_OUTCOME_CATALOGUES, MYSTERY_COMPONENT_TOTAL } = await import(path.join(tmp, 'mystery-outcome-catalogue.mjs'));
const { MYSTERY_BONUSES, MYSTERY_WEIGHT_TOTAL } = await import(path.join(tmp, 'mystery-bonus.mjs'));
const BOOKS = process.env.KILO_BOOKS;
const lut = name => BOOKS ? fs.readFileSync(path.join(BOOKS, `lookUpTable_${name}_0.csv`), 'utf8').trimEnd().split('\n').map(l => l.split(',').map(BigInt)) : null;
const rowsOf = (cat, total) => { const r = []; let prev = 0; for (let i = 0; i < cat.length; i += 2) { const w = cat[i + 1] - prev; assert(w >= 1, 'min weight 1'); r.push([cat[i], w]); prev = cat[i + 1]; } assert.equal(prev, total); return r; };
const results = {};
function account(name, cost, cap, entries, table) {
  let W = 0n, PM = 0n, hit = 0n, capW = 0n, n = 0;
  for (const [w, payout] of entries) {
    const pm = BigInt(payout / 10); assert(Number.isInteger(payout / 10)); W += w; PM += w * pm; if (pm > 0n) hit += w; if (pm >= BigInt(cap * 100)) capW += w;
    if (table) { const row = table[n]; assert(row && row[1] === w && row[2] === pm, `${name} entry ${n + 1} differs from the book LUT`); }
    n++;
  }
  if (table) assert.equal(table.length, n, `${name} LUT rows`);
  const c = BigInt(Math.round(cost * 100)), rtp = Number(PM * 10n ** 12n / (W * c)) / 1e12;
  assert(PM * SCALE <= TARGET * W * c, `${name} RTP ${rtp} above 96.70%`);
  assert(0.967 - rtp <= 1e-6, `${name} RTP ${rtp} more than 1e-6 under 96.7%`);
  const capRate = Number(capW * 10n ** 12n / W) / 1e12; assert(capRate > 1e-7, `${name} max win rarer than 1 in 10M`);
  results[name] = { rows: n, rtp, hitRate: Number(hit * 10n ** 12n / W) / 1e12, maxWinX: cap, oneInMaxWin: 1 / capRate, lutChecked: !!table };
  console.log(JSON.stringify({ [name]: results[name] }));
}
function* experience(mode) { for (const [seed, w] of rowsOf(EXPERIENCE_CATALOGUES[mode], EXPERIENCE_WEIGHT_TOTAL)) yield [BigInt(w), E.generateSplashCandidate(STAKE, mode, vsSeeded(seed), vsSeeded(E.naturalSuperSeed(seed))).payout]; }
// playSplash draws exactly these entries: probe a few catalogue positions with a fixed draw.
for (const mode of ['spin', 'ante', 'buy']) { const cat = EXPERIENCE_CATALOGUES[mode];
  for (const k of [0, 1, Math.floor(cat.length / 4), cat.length / 2 - 1].map(row => row * 2)) { const prev = k ? cat[k - 1] : 0, draw = (prev + 0.5) / EXPERIENCE_WEIGHT_TOTAL;
    const live = E.playSplash(STAKE, mode, (() => { let first = true; return () => first ? (first = false, draw) : 0.5; })());
    assert.equal(live.catalogueSeed, cat[k]); assert.equal(live.payout, E.generateSplashCandidate(STAKE, mode, vsSeeded(cat[k]), vsSeeded(E.naturalSuperSeed(cat[k]))).payout, `${mode} playSplash replays its entry`); } }
account('base', 1, 25000, experience('spin'), lut('base'));
account('ante', 1.5, 25000, experience('ante'), lut('ante'));
account('dockside', 100, 25000, experience('buy'), lut('dockside'));
account('yacht', 200, 18000, (function* () { for (const [seed, w] of rowsOf(VS_OUTCOME_CATALOGUE, VS_CATALOGUE_TOTAL_WEIGHT)) yield [BigInt(w), E.yachtRound(STAKE, seed).payout]; })(), lut('yacht'));
const mix = Object.fromEntries(MYSTERY_BONUSES.map(o => [o.feature, BigInt(o.weight)])); assert.equal(MYSTERY_BONUSES.reduce((a, o) => a + o.weight, 0), MYSTERY_WEIGHT_TOTAL);
const pick = {};
account('mystery', 200, 25000, (function* () { for (const sel of ['dock', 'yacht', 'yacht25']) { let s = 0n;
  for (const [seed, w] of rowsOf(MYSTERY_OUTCOME_CATALOGUES[sel], MYSTERY_COMPONENT_TOTAL)) { const p = E.mysteryRound(STAKE, sel, seed).payout; s += BigInt(w) * BigInt(p); yield [mix[sel] * BigInt(w), p]; }
  pick[sel] = Number(s) / MYSTERY_COMPONENT_TOTAL / STAKE; } })(), lut('mystery'));
assert(Math.abs(pick.dock / 100 - results.dockside.rtp) < 1e-9, `Mystery Dock pick ${pick.dock / 100} vs bought ${results.dockside.rtp}`);
assert(Math.abs(pick.yacht / 200 - results.yacht.rtp) < 1e-9, `Mystery Yacht pick ${pick.yacht / 200} vs bought ${results.yacht.rtp}`);
results.mystery.picks = { dockRtp: pick.dock / 100, yachtRtp: pick.yacht / 200, superMeanX: pick.yacht25 };
// Getaway: analytic, 25,000x with p or zero.
const p = REEL_FEATURE_PROFILE.getawayWinChance; assert.equal(p, 967 / 25000);
results.getaway = { rtp: 25000 * p / 1000, hitRate: p, maxWinX: 25000, oneInMaxWin: 1 / p, analytic: true };
if (BOOKS) { const g = lut('getaway'); let W = 0n, PM = 0n; for (const [, w, pm] of g) { W += w; PM += w * pm; } assert(PM * SCALE === TARGET * W * 100000n, 'Getaway book RTP exactly 96.7%'); results.getaway.lutChecked = true; }
const r = Object.values(results).map(x => x.rtp); assert(Math.max(...r) - Math.min(...r) <= 0.005, 'modes within 0.5%');
fs.rmSync(tmp, { recursive: true, force: true });
console.log(JSON.stringify({ pass: true, results }));
