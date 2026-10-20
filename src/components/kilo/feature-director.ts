import type { SplashScript, SplashLine } from "@/lib/kilo/engine";
import { isPurchaseMode } from "@/lib/kilo/engine";
import { FEATURE_NAMES, type FeatureEvent } from "@/lib/kilo/feature-math";
import type { FeatureHud, PresentOpts, ReelScene } from "./director";
import { cue, bonusExit, whirStop } from "@/lib/kilo/sound";

const sum = (lines: SplashLine[]) => lines.reduce((n, l) => n + l.pay, 0);
const money = (n: number) => Math.round(n).toLocaleString("en-US");
export function cargoNote(e: FeatureEvent) {
  switch (e.action) {
    case "duel":
      return "VS reel locked · multiplier stays until final spin";
    case "hold":
      return `${e.heldAfter.length}/12 holds · cargo ${money(e.pendingAfter)}`;
    case "shipment":
      return `${e.final ? "Final shipment" : "Shipment"} · ${money(e.credited)}`;
    case "pickup":
      return `Column ${e.route + 1} · ${e.sources.length ? "cargo secured" : "no pickup"} · route ×${e.multiplier}`;
    case "delivery":
      return `Route delivered · ${money(e.credited)}`;
    case "load":
      return "Three cases loaded · clear the checkpoints";
    case "checkpoint":
      return `Checkpoint ${e.checkpoint}/3 · case ${(e.targetCase ?? 0) + 1} doubled`;
    case "extract":
      return `Getaway complete · ${money(e.credited)}`;
    default:
      // Marked cargo (carry/expire) was removed from the math in Dockside M1.
      return "";
  }
}
function hudFor(
  round: SplashScript,
  line: number,
  collect: number,
  scatter: number,
  left: number | null,
  active: boolean,
  note: string,
  e?: FeatureEvent,
): FeatureHud {
  return {
    active,
    label: active ? FEATURE_NAMES[round.feature!] : "Base game",
    left,
    mult: e?.multiplier ?? 1,
    wilds: 0,
    total: Math.min(round.payout, line + collect + scatter),
    line,
    collect,
    scatter,
    spinLine: 0,
    spinCollect: e?.credited ?? 0,
    note,
    filled: 0,
    maxed: false,
    nextMult: null,
    nextSpins: 0,
    holding: false,
    bonusWin: collect,
    triggerWin: line + scatter,
    mechanic: e,
  };
}
export function cargoFinalHud(round: SplashScript): FeatureHud {
  return hudFor(
    round,
    sum(round.base.lines),
    round.free.reduce((n, s) => n + s.got, 0),
    round.base.scatterPay,
    0,
    true,
    round.capped
      ? `Maximum win · ${money(round.payout)}`
      : `Round complete · ${money(round.payout)}`,
    round.free.at(-1)?.mechanic,
  );
}
/** Consumes a finished script. Never rolls, charges, persists or settles. */
export async function presentCargoFeature(
  scene: ReelScene,
  round: SplashScript,
  opts: PresentOpts,
) {
  scene.setStake(round.stake);
  scene.setPace(opts.turbo, opts.reduced, opts.speed);
  scene.setFeatureState?.(null);
  let line = 0,
    collect = 0,
    scatter = 0;
  const publish = (
    active: boolean,
    left: number | null,
    note: string,
    e?: FeatureEvent,
    entry = false,
  ) => {
    const hud = hudFor(round, line, collect, scatter, left, active, note, e);
    if (entry) hud.phase = 'entry';
    scene.setCopy(note);
    scene.setMeter(0, active, left, hud.label);
    scene.setTally({ line, collect, mult: hud.mult, total: hud.total });
    opts.onHud?.(hud);
  };
  const snap = () => {
    if (!opts.skipped()) return false;
    const last = round.free.at(-1),
      hud = cargoFinalHud(round);
    scene.show(last?.grid ?? round.base.grid);
    scene.setLocks([]);
    scene.setFeatureState?.(last?.mechanic ?? null, "after");
    scene.setTally({
      line: hud.line,
      collect: hud.collect,
      mult: hud.mult,
      total: hud.total,
    });
    scene.setMeter(0, true, 0, hud.label);
    scene.finishPlate(hud.note);
    opts.onHud?.(hud);
    whirStop();
    bonusExit();
    return true;
  };
  const start = Math.max(
    0,
    Math.min(round.free.length, opts.startFreeIndex ?? 0),
  );
  if (!start) {
    publish(false, null, "Good luck");
    scene.setMood("cast");
    cue("spin");
    const pace = isPurchaseMode(round.mode) ? "ordinary" : "landed";
    if (round.base.hook && round.base.primed) {
      await scene.spinTo(round.base.primed, null, pace);
      if (snap()) return;
      scene.setLocks(
        round.base.primed.flatMap((col, i) =>
          col.some((c) => c.s === "bars") ? [i] : [],
        ),
      );
      publish(false, null, "Two scatters locked · one respin");
      await scene.spinTo(round.base.grid, round.base.hook, pace);
      scene.setLocks([]);
    } else await scene.spinTo(round.base.grid, null, pace);
    if (snap()) return;
    if (round.base.lines.length) {
      let last = -1;
      await scene.highlight(round.base.lines, (_, index) => {
        if (index <= last || opts.skipped()) return;
        last = index;
        line = sum(round.base.lines.slice(0, index + 1));
        publish(false, null, `Line win ${money(line)}`);
      });
      line = sum(round.base.lines);
      if (snap()) return;
    }
    scatter = round.base.scatterPay;
    publish(true, round.awarded,
      round.feature === 'getaway' ? 'The Getaway · three cases · three checkpoints'
        : `${FEATURE_NAMES[round.feature!]} · ${round.awarded} free spins`,
      undefined, true);
    await (scene.featureIntro?.(round) ?? scene.intro(round));
    if (snap()) return;
  } else {
    line = sum(round.base.lines);
    scatter = round.base.scatterPay;
    collect = round.free.slice(0, start).reduce((n, s) => n + s.got, 0);
  }
  for (let i = start; i < round.free.length; i++) {
    const spin = round.free[i]!,
      e = spin.mechanic!;
    if (snap()) return;
    scene.setFeatureState?.(e, "before");
    const previous = round.free[i - 1]?.mechanic;
    publish(
      true,
      i ? round.free[i - 1]!.left : round.awarded,
      round.feature === "getaway" ? "Getaway in progress" : "Free spin",
      {
        ...e,
        credited: 0,
        beforeCap: 0,
        sources: [],
        heldAfter: e.heldBefore,
        pendingAfter: e.pendingBefore,
        casesAfter: e.casesBefore,
        quality: previous?.quality ?? 0,
        shipments: previous?.shipments ?? 0,
        checkpoint: previous?.checkpoint ?? 0,
        targetCase: null,
        multiplier: previous?.nextMultiplier ?? 1,
      },
    );
    if (round.feature === "getaway" && i > 0) {
      scene.show(round.free[i - 1]!.grid);
    } else {
      cue("spin");
      await scene.spinTo(spin.grid, null, "ordinary");
    }
    if (snap()) return;
    if (scene.featureStep) await scene.featureStep(e, spin.grid);
    if (snap()) return;
    scene.show(spin.grid);
    scene.setFeatureState?.(e, "after");
    collect += spin.got;
    publish(true, spin.left, cargoNote(e), e);
  }
  if (snap()) return;
  const hud = cargoFinalHud(round);
  opts.onHud?.(hud);
  scene.setTally({
    line: hud.line,
    collect: hud.collect,
    mult: hud.mult,
    total: hud.total,
  });
  scene.finishPlate(hud.note);
  scene.setMood(round.payout > round.cost ? "cheer" : "idle");
  whirStop();
  bonusExit();
}
