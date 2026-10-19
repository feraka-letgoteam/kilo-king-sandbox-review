import { isPurchaseMode, type SplashScript } from '@/lib/kilo/engine';
import { FEATURE_NAMES, type FeatureEvent } from '@/lib/kilo/feature-math';
import type { FeatureHud, PresentOpts, ReelScene } from './director';
import { cue, bonusExit, whirStop } from '@/lib/kilo/sound';
import { vsGroupsFor } from '@/lib/kilo/vs-groups';

const money = (n: number) => Math.round(n).toLocaleString('en-US');
export function reelFeatureNote(e: FeatureEvent) {
  const r = e.reel!;
  if (r.type === 'binary') return r.won ? 'Maximum win · 25,000×' : 'No win';
  if (r.type === 'vs') return r.rules === 'pure-vs'
    ? `${r.after.length} sticky wild ${r.after.length === 1 ? 'reel' : 'reels'} · locked until the final spin`
    : `${r.after.length} sticky wild ${r.after.length === 1 ? 'reel' : 'reels'} · ${e.heldAfter.length} locked packages`;
  return `${r.cascades.length ? `${r.cascades.length} cascades · ` : ''}Cash locked · board ×${r.globalAfter}`;
}
function featureHud(round: SplashScript, total: number, left: number, note: string, e?: FeatureEvent, entry = false): FeatureHud {
  const baseLine = round.base.lines.reduce((n, l) => n + l.pay, 0), scatter = round.base.scatterPay;
  const triggerWin = baseLine + scatter;
  return { active: round.feature !== 'getaway', label: FEATURE_NAMES[round.feature!], left, mult: e?.multiplier ?? 1,
    wilds: 0, total: triggerWin + total, line: baseLine, collect: total, scatter,
    spinLine: 0, spinCollect: 0, note, filled: 0, maxed: false, nextMult: null,
    nextSpins: 0, holding: false, bonusWin: total, triggerWin, mechanic: e,
    ...(entry ? { phase: 'entry' as const } : {}) };
}
export function reelFeatureFinalHud(round: SplashScript) {
  return featureHud(round, round.free.reduce((n, s) => n + s.got, 0), 0,
    round.capped ? `Maximum win · ${money(round.payout)}` : round.payout ? `Feature complete · ${money(round.payout)}` : 'No win', round.free.at(-1)?.mechanic);
}

/** Presentation only. Every intermediate credit comes from the recorded outcome. */
export async function presentReelFeature(scene: ReelScene, round: SplashScript, opts: PresentOpts) {
  scene.setStake(round.stake); scene.setPace(opts.turbo, opts.reduced, opts.speed);
  scene.setFeatureState?.(null);
  let total = 0;
  const publish = (left: number, note: string, e?: FeatureEvent, entry = false) => {
    const h = featureHud(round, total, left, note, e, entry);
    scene.setCopy(note); scene.setMeter(0, round.feature !== 'getaway', left, h.label);
    scene.setTally({ line: h.line, collect: total, mult: h.mult, total: h.total });
    opts.onHud?.(h);
  };
  const snap = () => {
    if (!opts.skipped()) return false;
    const last = round.free.at(-1), e = last?.mechanic;
    scene.show(e?.reel?.finalGrid ?? last?.grid ?? round.base.grid);
    scene.setLocks([]); scene.setFeatureState?.(e ?? null, 'after');
    const h = reelFeatureFinalHud(round);
    scene.setTally({ line: h.line, collect: h.collect, mult: h.mult, total: h.total });
    scene.setMeter(0, round.feature !== 'getaway', 0, h.label); scene.finishPlate(h.note);
    opts.onHud?.(h); whirStop(); bonusExit(); return true;
  };
  const start = Math.max(0, Math.min(round.free.length, opts.startFreeIndex ?? 0));
  if (!start) {
    // Getaway has one paid spin from its recorded feature grid below. Skip
    // the bought base-trigger animation, which would be a second spin.
    if (round.feature !== 'getaway') {
      scene.setMood('idle'); cue('spin');
      const pace = isPurchaseMode(round.mode) ? 'ordinary' : 'landed';
      if (round.base.hook && round.base.primed) {
        await scene.spinTo(round.base.primed, null, pace); if (snap()) return;
        scene.setLocks(round.base.primed.flatMap((c, i) => c.some(s => s.s === 'bars') ? [i] : []));
        await scene.spinTo(round.base.grid, round.base.hook, pace); scene.setLocks([]);
      } else await scene.spinTo(round.base.grid, null, pace);
      if (snap()) return;
      if (round.base.lines.length) {
        let shown = 0;
        await scene.highlight(round.base.lines, (line) => {
          shown += line.pay;
          const h = featureHud(round, 0, round.awarded, `Line win ${money(shown)}`);
          opts.onHud?.({ ...h, active: false, line: shown, total: shown, triggerWin: shown, scatter: 0 });
        });
        if (snap()) return;
      }
    }
    if (round.feature !== 'getaway') {
      publish(round.awarded, `${FEATURE_NAMES[round.feature!]} · ${round.awarded} free spins`, undefined, true);
      await scene.featureIntro?.(round); if (snap()) return;
    }
  } else total = round.free.slice(0, start).reduce((n, s) => n + s.got, 0);
  for (let index = start; index < round.free.length; index++) {
    if (snap()) return;
    const spin = round.free[index]!, e = spin.mechanic!;
    scene.setFeatureState?.(e, 'before');
    const before = structuredClone(e);
    before.credited = 0; before.beforeCap = 0; before.sources = [];
    before.heldAfter = before.heldBefore; before.pendingAfter = before.pendingBefore;
    if (before.reel?.type === 'vs') {
      before.reel.after = before.reel.before; before.reel.conversions = [];
      before.reel.groupsAfter = vsGroupsFor(before.reel, 'before');
      before.multiplier = Math.max(1,...before.reel.groupsAfter.map(group=>group.multiplier));
    }
    if (before.reel?.type === 'tumble') {
      before.reel.globalAfter = before.reel.globalBefore;
      before.multiplier = before.reel.globalBefore; before.reel.cascades = [];
    }
    publish(spin.left + 1, round.feature === 'getaway' ? '1 spin · max win or nothing' : 'Free spin', before);
    cue('spin');
    // This is the one recorded God spin as well as the ordinary free spin for
    // other modes. Its stopped populated board remains beneath the card.
    await scene.spinTo(spin.grid, null, 'ordinary'); if (snap()) return;
    const initialTotal = total;
    await scene.reelFeatureStep?.(e, {
      award: value => {
        if (opts.skipped()) return;
        total += value;
        publish(spin.left + 1, value ? `Won ${money(value)}` : 'No win', before);
      },
      state: state => {
        if (opts.skipped()) return;
        Object.assign(before, state);
        publish(spin.left + 1, reelFeatureNote(before), before);
      },
    });
    if (snap()) return;
    // Missing/double presentation credit is an error, never a second settlement.
    if (scene.reelFeatureStep && total - initialTotal !== spin.got) throw new Error('Feature presentation does not match its recorded awards');
    if (!scene.reelFeatureStep) total += spin.got;
    scene.show(e.reel!.finalGrid); scene.setFeatureState?.(e, 'after');
    publish(spin.left, reelFeatureNote(e), e);
  }
  if (snap()) return;
  const h = reelFeatureFinalHud(round); opts.onHud?.(h);
  scene.finishPlate(h.note); scene.setMood(round.payout > round.cost ? 'cheer' : 'idle');
  whirStop(); bonusExit();
}
