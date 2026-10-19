// Exact production math checks. This file does not emulate animation or a GPU.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { readBaseline, BASELINE_COMMIT, verifyBaselineBundle } from './v77-baseline.mjs';

const CHECKPOINT = BASELINE_COMMIT;
const nativeRequire = createRequire(import.meta.url);
function productionLoader(checkpoint) {
  const cache = new Map();
  return function load(filename) {
    let file = path.relative(process.cwd(), path.resolve(filename));
    if (!path.extname(file)) file += '.ts';
    if (cache.has(file)) return cache.get(file);
    const source = checkpoint
      ? readBaseline(file)
      : fs.readFileSync(file, 'utf8');
    const result = {};
    cache.set(file, result);
    const code = ts.transpileModule(source, {
      fileName: file,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const require = id => id.startsWith('.')
      ? load(path.join(path.dirname(file), id))
      : id.startsWith('@/') ? load(path.join('src', id.slice(2))) : nativeRequire(id);
    new Function('require', 'exports', code)(require, result);
    return result;
  };
}
const load = productionLoader();
const baselineLoad = productionLoader(CHECKPOINT);
const portableBaseline = verifyBaselineBundle();
const { groupVsReels, vsGroupsFor, vsLineMultiplier, hasVsCombiningRule, VS_COMBINING_RULE } = load('src/lib/kilo/vs-groups.ts');
const current = load('src/lib/kilo/reel-feature-math.ts');
const baseline = baselineLoad('src/lib/kilo/reel-feature-math.ts');
const { PAYLINES, lineHit } = load('src/lib/kilo/engine.ts');
let checks = 0;
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const check = (condition, message) => { assert(condition, message); checks++; };
function seeded(seed) {
  let calls = 0;
  const rng = () => {
    calls++; seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Object.defineProperty(rng, 'calls', { get: () => calls });
  return rng;
}
const member = (reel, multiplier, duelist = 'king') => ({ reel, multiplier, duelist });
const members = [member(0, 3), member(1, 4)];
const frozen = Object.freeze(members.map(value => Object.freeze(value)));
const pair = groupVsReels(frozen);
equal(pair.map(({ side, reels, multiplier, width }) => ({ side, reels, multiplier, width })),
  [{ side: 'king', reels: [0, 1], multiplier: 12, width: 2 }], 'adjacent 3 and 4 form one x12 King group');
equal(members, [member(0, 3), member(1, 4)], 'grouping does not mutate original per-reel values');
equal(groupVsReels([...members, member(2, 10)])[0].multiplier, 120, 'expansion to three multiplies the new member once');
equal(groupVsReels([...members, member(2, 10), member(3, 5)])[0].multiplier, 600, 'expansion to four gives x600');
equal(groupVsReels([member(4, 2), member(2, 10), member(0, 3), member(3, 5), member(1, 4)])[0].multiplier,
  1200, 'five-reel group uses sorted contiguous members');
equal(groupVsReels([member(0, 3), member(2, 5)]).map(group => group.reels), [[0], [2]], 'non-adjacent King reels never combine');
equal(groupVsReels([member(0, 3), member(1, 4, 'vice'), member(2, 10)]).map(group => group.reels),
  [[0], [1], [2]], 'opposing side blocks a King bridge');
equal(groupVsReels([member(0, 2, 'vice'), member(1, 5, 'vice'), member(2, 3), member(3, 4)]).map(group => group.multiplier),
  [10, 12], 'King and Cop own separate product groups');
const bridged = [member(0, 3), member(1, 4), member(3, 5), member(4, 2)];
equal(groupVsReels(bridged).map(group => group.reels), [[0, 1], [3, 4]], 'gap keeps existing groups distinct');
equal(groupVsReels([...bridged, member(2, 10)]).map(group => ({ reels: group.reels, multiplier: group.multiplier })),
  [{ reels: [0, 1, 2, 3, 4], multiplier: 1200 }], 'new middle member bridges both matching groups');
equal(vsLineMultiplier(members, 5, VS_COMBINING_RULE), 12, 'group product applies exactly once, not 12 plus 3 plus 4');
equal(vsLineMultiplier([member(0, 3), member(1, 4), member(3, 5, 'vice'), member(4, 2, 'vice')], 5, VS_COMBINING_RULE),
  22, 'separate products retain additive cross-group rule: 12 plus 10');
equal(vsLineMultiplier([member(0, 3), member(2, 5)], 5, VS_COMBINING_RULE), 8, 'non-adjacent singles retain additive rule');
equal(vsLineMultiplier([member(0, 3), member(1, 4), member(4, 10)], 3, VS_COMBINING_RULE),
  12, 'non-participating group does not contribute');
equal(vsLineMultiplier([], 5, VS_COMBINING_RULE), 1, 'ordinary line with no VS uses one');
equal(vsLineMultiplier(Array.from({ length: 5 }, (_, reel) => member(reel, 10)), 5, VS_COMBINING_RULE),
  100000, 'full x10 group stays exact');
equal(vsLineMultiplier(members, 5), 7, 'unmarked replay retains historical individual addition');
equal(vsLineMultiplier(members, 5, 'adjacent-products-v75'), 12, 'recovered v75/v76 records retain their explicit grouping rule');
equal(vsLineMultiplier(members, 5, 'unknown-future-rule'), 7, 'unsupported flag cannot silently reinterpret a record');
for (const flag of [undefined, '', 'pure-vs', 'adjacent-products-v76', 'adjacent-products-v78']) {
  equal(hasVsCombiningRule(flag), false, 'a nearby or inferred version flag is not assumed to be an approved rule');
  equal(vsLineMultiplier(members, 5, flag), 7, 'every unsupported flag retains historical replay');
}
const legacy = { before: [], after: members, groupsAfter: pair };
equal(vsGroupsFor(legacy).map(group => group.reels), [[0], [1]], 'unmarked record ignores coincidental group metadata');
equal(vsGroupsFor({ ...legacy, combining: VS_COMBINING_RULE }).map(group => group.reels), [[0, 1]],
  'explicit grouped record resolves to continuous composition');
equal(vsGroupsFor({ ...legacy, combining: 'adjacent-products-v75' }).map(group => group.reels), [[0, 1]],
  'old explicitly grouped records retain continuous composition');
equal(vsGroupsFor({ before: members, after: [], combining: VS_COMBINING_RULE }, 'before').map(group => group.multiplier),
  [12], 'before groups resolve independently of after');
assert.throws(() => groupVsReels([member(1, 3), member(1, 4)]), /one owner/); checks++;
assert.throws(() => groupVsReels([member(5, 3)]), /0 through 4/); checks++;
assert.throws(() => groupVsReels([member(0, 0)]), /positive integer/); checks++;

// Independent oracle deliberately does not use the production grouping helper.
function productSum(wilds, reelCount) {
  const sorted = [...wilds].sort((a, b) => a.reel - b.reel);
  let total = 0, last = -2, side = null, product = 1, participates = false;
  const finish = () => { if (participates) total += product; };
  for (const wild of sorted) {
    if (wild.reel !== last + 1 || wild.duelist !== side) {
      finish(); product = 1; participates = false;
    }
    product *= wild.multiplier; participates ||= wild.reel < reelCount;
    last = wild.reel; side = wild.duelist;
  }
  finish(); return Math.max(1, total);
}
let generatedSpins = 0, naturalMergedGroups = 0, ledgerCases = 0;
function inspect(result, stake, room) {
  let paid = 0, previous = [];
  for (const spin of result.free) {
    const event = spin.mechanic, record = event.reel;
    equal(record.combining, VS_COMBINING_RULE, 'new Yacht record opts into combining');
    equal(record.before, previous, 'persistent individual ownership survives every later spin');
    equal(record.groupsBefore, groupVsReels(previous), 'groupsBefore records the actual pre-spin state');
    equal(record.groupsAfter, groupVsReels(record.after), 'groupsAfter records all post-spin groups');
    for (const old of previous) equal(record.after.find(wild => wild.reel === old.reel), old, 'members cannot reroll or disappear');
    for (const group of record.groupsAfter) {
      equal(group.multiplier, group.members.reduce((value, item) => value * item.multiplier, 1), 'recorded product equals members');
      equal(group.width, group.end - group.start + 1, 'group occupies its complete continuous width');
      naturalMergedGroups += Number(group.width > 1);
      for (const reel of group.reels) check(record.finalGrid[reel].every(cell => cell.s === 'splash'), 'each occupied reel is entirely wild');
    }
    let raw = 0, spinPaid = 0;
    const lines = [];
    PAYLINES.forEach((rows, index) => {
      const hit = lineHit(record.finalGrid, rows); if (!hit) return;
      const multiplier = productSum(record.after, hit.n);
      const beforeCap = Math.round(stake * hit.mult * multiplier);
      const credited = Math.min(Math.max(0, room - paid - spinPaid), beforeCap);
      raw += beforeCap; spinPaid += credited;
      if (credited) lines.push({ i: index, s: hit.s, n: hit.n, pay: credited });
    });
    equal(record.lineBeforeCap, raw, 'raw winning lines use each independent product once');
    equal(record.lines, lines, 'recorded credited lines exactly match independent cap ledger');
    equal(event.beforeCap, raw, 'complete raw event amount retained');
    equal(event.credited, spinPaid, 'complete credited event amount retained');
    equal(spin.got, spinPaid, 'spin credits once');
    equal(record.collection, { beforeCap: 0, credited: 0 }, 'VS has no collector side award');
    equal(record.finalCash, { beforeCap: 0, credited: 0 }, 'VS has no terminal cash sweep');
    equal(event.multiplier, Math.max(1, ...record.groupsAfter.map(group => group.multiplier)), 'event readout reflects group product');
    paid += spinPaid; previous = record.after; generatedSpins++;
  }
  equal(result.total, paid, 'full feature equals sum of line credits');
  check(result.total <= room, 'existing room remains authoritative');
  ledgerCases++;
}

for (let seed = 1; seed <= 512; seed++) {
  // High room prevents a new, legitimate cap from shortening the recorded RNG
  // stream, so every pre-existing draw/board/duel can be compared directly.
  const oldRng = seeded(seed), newRng = seeded(seed), stake = [100, 500, 1000][seed % 3], room = 1e15;
  const old = baseline.runReelFeature('yacht', stake, oldRng, room);
  const next = current.runReelFeature('yacht', stake, newRng, room);
  equal(newRng.calls, oldRng.calls, 'combining introduces no RNG draws');
  equal(next.free.length, old.free.length, 'all original spins retained when uncapped');
  for (let index = 0; index < old.free.length; index++) {
    const prior = old.free[index], after = next.free[index], a = prior.mechanic.reel, b = after.mechanic.reel;
    equal(after.grid, prior.grid, 'landed symbols and VS triggers unchanged');
    equal(b.before, a.before, 'original sticky members before spin unchanged');
    equal(b.after, a.after, 'original sticky members after spin unchanged');
    equal(b.conversions, a.conversions, 'duel winner, rivals and individual multipliers unchanged');
    equal(b.collectGrid, a.collectGrid, 'recorded collection compatibility grid unchanged');
    equal(b.finalGrid, a.finalGrid, 'settled symbol board unchanged');
    equal(vsLineMultiplier(a.after, 5), Math.max(1, a.after.reduce((sum, wild) => sum + wild.multiplier, 0)),
      'old saved record retains additive member interpretation');
  }
  if (seed <= 8) equal(next, current.runReelFeature('yacht', stake, seeded(seed), room), 'new record is deterministic');
  inspect(next, stake, room);
}
check(naturalMergedGroups > 0, 'real seeded feature distribution exercises merging');

for (const seed of [1, 2, 6, 19, 129, 1569831]) for (const room of [0, 1, 17, 12345, 18000000]) {
  inspect(current.runReelFeature('yacht', 1000, seeded(seed), room), 1000, room);
}

// Other feature math must be exactly unchanged. God presentation alone removes
// the old forced scatter row, retaining the same normal-grid RNG consumption.
let unchangedRouteRecords = 0, maxOutcomesChecked = 0, maxWinsChecked = 0;
for (let seed = 1; seed <= 128; seed++) {
  const oldRouteRng = seeded(seed), nextRouteRng = seeded(seed);
  equal(current.runReelFeature('route', 1000, nextRouteRng, 25000000), baseline.runReelFeature('route', 1000, oldRouteRng, 25000000),
    'Chopper record remains byte-for-byte equivalent');
  equal(nextRouteRng.calls, oldRouteRng.calls, 'Chopper RNG stream unchanged'); unchangedRouteRecords++;
}
for (let seed = 1; seed <= 2048; seed++) {
  const oldRng = seeded(seed), nextRng = seeded(seed);
  const old = baseline.runReelFeature('getaway', 1000, oldRng, 25000000);
  const next = current.runReelFeature('getaway', 1000, nextRng, 25000000);
  const a = old.free[0].mechanic.reel, b = next.free[0].mechanic.reel;
  equal(nextRng.calls, oldRng.calls, 'God Mode keeps exact RNG consumption');
  equal({ total: next.total, capped: next.capped, won: b.won, result: b.result, reveal: b.reveal },
    { total: old.total, capped: old.capped, won: a.won, result: a.result, reveal: a.reveal },
    'God binary outcome, payout, cap and reveal unchanged');
  if (!a.won) equal(next, old, 'God losses have no record changes');
  else {
    maxWinsChecked++;
    const allowed = new Set(['10', 'J', 'Q', 'K', 'A', 'cuffs', 'keys', 'lamp', 'duffel']);
    check(b.finalGrid.flat().every(cell => allowed.has(cell.s)), 'God win keeps valid ordinary symbols, not forced scatters');
    equal(next.free[0].grid, b.finalGrid, 'God landed and final presentation grids agree');
    for (let reel = 0; reel < 5; reel++) for (const row of [0, 2]) equal(b.finalGrid[reel][row], a.finalGrid[reel][row], 'only old forced row can differ');
  }
  maxOutcomesChecked++;
}
check(maxWinsChecked > 0, 'God win presentation-grid exception exercised');
equal(current.REEL_FEATURE_PROFILE, baseline.REEL_FEATURE_PROFILE, 'all published probabilities and value tables unchanged');
equal(current.REEL_FEATURE_SPINS, baseline.REEL_FEATURE_SPINS, 'all feature spin counts unchanged');
console.log(JSON.stringify({ checkpoint: CHECKPOINT, portableBaseline, checks, generatedSpins, ledgerCases, naturalMergedGroups,
  unchangedRouteRecords, maxOutcomesChecked, maxWinsChecked, rule: VS_COMBINING_RULE,
  godPresentationOnlyException: 'Stop on ordinary generated symbols; remove forced winning scatter row.' }, null, 2));
