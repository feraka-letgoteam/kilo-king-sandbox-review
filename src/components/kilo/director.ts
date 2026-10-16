import {
  collectMult,
  meterLevel,
  LEVEL_MULT,
  PAYLINES,
  type SplashCell,
  type SplashLine,
  type SplashScript,
} from "@/lib/kilo/engine";
import { bonusExit, cue, whirStop } from "@/lib/kilo/sound";

export type Mood = "idle" | "cast" | "cheer" | "slump";
export type MeterFace = {
  filled: number;
  maxed: boolean;
  nextMult: number | null;
  nextSpins: number;
  mult: number;
  holding: boolean;
};
export type FeatureHud = {
  active: boolean;
  label: string;
  left: number | null;
  mult: number;
  wilds: number;
  total: number;
  line: number;
  collect: number;
  scatter: number;
  spinLine: number;
  spinCollect: number;
  note: string;
  filled: number;
  maxed: boolean;
  nextMult: number | null;
  nextSpins: number;
  holding: boolean;
  bonusWin: number;
  triggerWin: number;
};
export type PresentOpts = {
  turbo: boolean;
  reduced: boolean;
  skipped: () => boolean;
  onHud?: (hud: FeatureHud) => void;
  /** Review harness only. When it returns true the preview reports a failure and does not play the action. */
  fault?: () => boolean;
  /** Review playback only. Skips the base animation and earlier free spins. */
  startFreeIndex?: number;
};
export type SymbolEdge = {
  name: string;
  cell: number;
  state: "idle" | "peak" | "turn";
  source: string;
  sourceWidth: number;
  sourceHeight: number;
  frameWidth: number;
  frameHeight: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  insideCell: boolean;
  clearsPlaque: boolean;
};

export type SymbolCompareResult = { rows: SymbolEdge[] };

export interface ReelScene {
  setStake(stake: number): void;
  setPace(turbo: boolean, reduced: boolean): void;
  setMood(mood: Mood): void;
  setCopy(title: string): void;
  setTally(tally: {
    line: number;
    collect: number;
    mult: number;
    total: number;
  }): void;
  setMeter(
    wilds: number,
    feature: boolean,
    left: number | null,
    label: string,
  ): void;
  setLocks(reels: number[]): void;
  /**
   * `landed` stretches every still-unresolved reel once two scatters have
   * landed in the first four reels. `ordinary` is the purchased-feature reveal:
   * the feature is guaranteed, so the reels do not tease.
   */
  spinTo(
    grid: SplashCell[][],
    reels: number[] | null,
    pace?: "ordinary" | "landed",
  ): Promise<void>;
  show(grid: SplashCell[][]): void;
  /** Marks the restored preview board before the named action. Optional for tests. */
  armPreview?(kind: string): void;
  highlight(lines: SplashLine[]): Promise<void>;
  collect(spin: {
    grid: SplashCell[][];
    mult: number;
    got: number;
    wilds: number;
  }): Promise<void>;
  /** Flies one marker per newly landed collector. Optional so tests can omit it. */
  deliverCollectors?(
    count: number,
    onLand?: (index: number) => void | Promise<void>,
  ): Promise<void>;
  tool(spin: {
    tool: string;
    grid: SplashCell[][];
    toolReel?: number;
    toolShift?: "up" | "down";
  }): Promise<void>;
  intro(round: SplashScript): Promise<void>;
  retrigger(
    extra: number,
    nextMult: number,
    onAward?: () => void,
  ): Promise<void>;
  finishPlate(text: string): void;
  /** Review sheet only. Does not spin, debit, credit, or replace the board. */
  symbolCompare?(): { canvas: HTMLCanvasElement; report: SymbolCompareResult };
}

const money = (n: number) => Math.max(0, Math.round(n)).toLocaleString();
const lineSum = (lines: SplashLine[]) =>
  lines.reduce((n, line) => n + line.pay, 0);

// Poll only during a short presentation hold, so Skip never waits for a whole plate.
async function hold(opts: PresentOpts, ms: number) {
  if (opts.reduced || opts.skipped()) return;
  const end = performance.now() + ms * (opts.turbo ? 0.4 : 1);
  while (!opts.skipped() && performance.now() < end)
    await new Promise<void>((resolve) =>
      window.setTimeout(resolve, Math.min(40, end - performance.now())),
    );
}

/** Plays an already-drawn result. No draw, debit or credit happens in this module. */
export async function presentScript(
  scene: ReelScene,
  round: SplashScript,
  opts: PresentOpts,
) {
  scene.setStake(round.stake);
  scene.setPace(opts.turbo, opts.reduced);
  let line = 0,
    collect = 0,
    scatter = 0,
    wilds = round.banked,
    triggerLine = 0;
  let spinLine = 0,
    spinCollect = 0;
  let shownWilds: number | null = null;
  const spinBonus = round.mods.includes("extraSpins") ? 2 : 0;
  const modeLabel =
    round.mode === "chopper"
      ? "Chopper"
      : round.mode === "buy"
        ? "Bought feature"
        : "Free spins";
  const publish = (
    note: string,
    active: boolean,
    left: number | null,
    face?: MeterFace,
  ) => {
    const total = Math.min(round.payout, line + collect + scatter);
    const count = shownWilds ?? wilds;
    const shown = face ?? faceFor(count, spinBonus);
    const mult = shown.mult;
    scene.setTally({ line, collect, mult, total });
    scene.setCopy(note);
    scene.setMeter(count, active, left, active ? modeLabel : "Base game");
    opts.onHud?.({
      active,
      label: active ? modeLabel : "Base game",
      left,
      mult,
      wilds: count,
      total,
      line,
      collect,
      scatter,
      spinLine,
      spinCollect,
      note,
      filled: shown.filled,
      maxed: shown.maxed,
      nextMult: shown.nextMult,
      nextSpins: shown.nextSpins,
      holding: shown.holding,
      bonusWin: Math.max(0, line - triggerLine + collect),
      triggerWin: triggerLine + scatter,
    });
  };
  const interrupted = () => {
    if (!opts.skipped()) return false;
    snap(scene, round, opts);
    return true;
  };

  const startFree = Math.max(
    0,
    Math.min(round.free.length, opts.startFreeIndex ?? 0),
  );
  let remaining = round.awarded;
  if (startFree > 0) {
    triggerLine = lineSum(round.base.lines);
    line = triggerLine;
    scatter = round.base.scatterPay;
    for (let i = 0; i < startFree; i++) {
      const prior = round.free[i]!;
      line += lineSum(prior.lines);
      collect += prior.got;
      wilds += prior.wilds;
      remaining = prior.left;
    }
    scene.setLocks([]);
    scene.show(round.free[startFree - 1]?.grid ?? round.base.grid);
    scene.setMood("cast");
    publish("Free spin", true, remaining);
  } else {
  scene.setMood("cast");
  publish("Good luck", false, null);
  cue("spin");
  const pace = round.mode === "buy" || round.mode === "chopper" ? "ordinary" : "landed";
  if (round.base.hook && round.base.primed) {
    await scene.spinTo(round.base.primed, null, pace);
    if (interrupted()) return;
    const locked = round.base.primed.flatMap((col, reel) =>
      col.some((c) => c.s === "bars") ? [reel] : [],
    );
    scene.setLocks(locked);
    publish("Two scatters locked · one respin", false, null);
    cue("scatter");
    await hold(opts, 450);
    if (interrupted()) return;
    scene.setMood("cast");
    await scene.spinTo(round.base.grid, round.base.hook, pace);
    scene.setLocks([]);
    if (interrupted()) return;
    publish(round.awarded ? "Third scatter landed" : "No third scatter", false, null);
    await hold(opts, 250);
  } else await scene.spinTo(round.base.grid, null, pace);
  if (interrupted()) return;

  spinLine = lineSum(round.base.lines);
  if (spinLine > 0) {
    publish(`Line win ${money(spinLine)}`, false, null);
    scene.setMood("cheer");
    await scene.highlight(round.base.lines);
    if (interrupted()) return;
    line += spinLine;
    triggerLine = spinLine;
    publish(`Line win ${money(spinLine)}`, false, null);
  }
  if (round.base.scatterPay > 0) {
    scatter = round.base.scatterPay;
    publish(`Scatter award ${money(scatter)}`, false, null);
    cue("scatter");
    await hold(opts, 350);
  }
  if (interrupted()) return;
  if (!round.free.length) {
    const note = round.capped
      ? `Maximum win · ${money(round.payout)}`
      : round.payout > 0
        ? `Round pays ${money(round.payout)}`
        : "No win this round";
    publish(note, false, null);
    // A small return below the charge is acknowledged, without a win celebration.
    scene.setMood(round.payout > round.cost ? "cheer" : "slump");
    scene.finishPlate(note);
    if (round.payout > round.cost) cue("end");
    return;
  }

  spinLine = 0;
  publish(
    `${round.awarded} free spins · starts at ×${collectMult(wilds)}`,
    true,
    round.awarded,
  );
  await scene.intro(round);
  if (interrupted()) return;
  remaining = round.awarded;
  }

  // spin.left is POST-retrigger (and can be forced to zero at the cap).
  // Carry the previous remaining count instead of displaying spin.left + 1.
  for (let index = startFree; index < round.free.length; index++) {
    const spin = round.free[index]!;
    if (interrupted()) return;
    spinLine = 0;
    spinCollect = 0;
    scene.setMood("cast");
    publish("Free spin", true, remaining);
    cue("spin");
    if (spin.tool && spin.primed) {
      await scene.spinTo(spin.primed, null);
      if (interrupted()) return;
      publish(toolTitle(spin.tool), true, Math.max(0, remaining - 1));
      cue("tool");
      await scene.tool({ ...spin, tool: spin.tool });
    } else await scene.spinTo(spin.grid, null);
    if (interrupted()) return;
    const leftBeforeAward = Math.max(0, remaining - 1);
    spinLine = lineSum(spin.lines);
    if (spinLine > 0) {
      publish(`Line win ${money(spinLine)}`, true, leftBeforeAward);
      scene.setMood("cheer");
      await scene.highlight(spin.lines);
      if (interrupted()) return;
      line += spinLine;
      publish(`Line win ${money(spinLine)}`, true, leftBeforeAward);
    }
    if (spin.got > 0) {
      publish(`Collecting at ×${spin.mult}`, true, leftBeforeAward);
      cue("collect");
      await scene.collect(spin);
      if (interrupted()) return;
      scene.setMood("cheer");
      spinCollect = spin.got;
      collect += spin.got;
      publish(`Collected ${money(spin.got)}`, true, leftBeforeAward);
      await hold(opts, 120);
    }
    if (interrupted()) return;
    if (spin.wilds > 0 && scene.deliverCollectors) {
      const beforeWilds = wilds;
      const spinMult = collectMult(beforeWilds);
      await scene.deliverCollectors(spin.wilds, async (index) => {
        const now = beforeWilds + index + 1;
        shownWilds = now;
        const mark = thresholdCrossed(beforeWilds, now);
        if (mark == null) {
          publish(
            resultPreview(spin, spinLine),
            true,
            leftBeforeAward,
            faceFor(now, spinBonus, spinMult),
          );
          return;
        }
        // Keep the finished set, at the multiplier this spin collected with,
        // until the retrigger announcement. Overflow collectors wait here.
        publish(
          resultPreview(spin, spinLine),
          true,
          leftBeforeAward,
          holdFace(mark, spinBonus, spinMult),
        );
        if (now === mark) await hold(opts, 480);
      });
      shownWilds = null;
    }
    if (interrupted()) return;
    const beforeWilds = wilds;
    wilds += spin.wilds;
    const resultNote = resultPreview(spin, spinLine);
    if (spin.extra > 0) {
      const nextMult = collectMult(wilds);
      const during = announcementFace(beforeWilds, wilds, spinBonus);
      let awarded = false;
      publish(resultNote, true, leftBeforeAward, during);
      cue("level");
      await scene.retrigger(spin.extra, nextMult, () => {
        if (awarded) return;
        awarded = true;
        remaining = spin.left;
        publish(
          `+${spin.extra} spins · next collection ×${nextMult}`,
          true,
          remaining,
          during,
        );
      });
      if (!awarded) remaining = spin.left;
      publish(resultNote, true, remaining, faceFor(wilds, spinBonus));
    } else {
      remaining = spin.left;
      publish(resultNote, true, remaining);
    }
    await hold(opts, spin.wilds > 0 ? 400 : 200);
  }
  if (interrupted()) return;
  const note = round.capped
    ? `Maximum win · ${money(round.payout)}`
    : `Round complete · ${money(round.payout)}`;
  // Keep the completed meter on screen until the next paid round.
  publish(note, true, 0);
  scene.setMood(round.payout > round.cost ? "cheer" : "slump");
  scene.finishPlate(note);
  if (round.payout > round.cost) cue("end");
}

function snap(scene: ReelScene, round: SplashScript, opts: PresentOpts) {
  whirStop();
  bonusExit();
  const hud = finalHud(round);
  scene.show(round.free.at(-1)?.grid ?? round.base.grid);
  scene.setLocks([]);
  scene.setTally({
    line: hud.line,
    collect: hud.collect,
    mult: hud.mult,
    total: hud.total,
  });
  scene.setMeter(hud.wilds, hud.active, hud.left, hud.label);
  scene.setMood(round.payout > round.cost ? "cheer" : "slump");
  scene.finishPlate(hud.note);
  opts.onHud?.(hud);
}

/** The settled ledger. Skip and a thrown animation both land here. */
export function finalHud(round: SplashScript): FeatureHud {
  const line =
    lineSum(round.base.lines) +
    round.free.reduce((n, spin) => n + lineSum(spin.lines), 0);
  const collect = round.free.reduce((n, spin) => n + spin.got, 0);
  const wilds =
    round.banked + round.free.reduce((n, spin) => n + spin.wilds, 0);
  const active = round.free.length > 0;
  const label =
    round.mode === "chopper"
      ? "Chopper"
      : round.mode === "buy"
        ? "Bought feature"
        : "Free spins";
  const note = round.capped
    ? `Maximum win · ${money(round.payout)}`
    : `Round complete · ${money(round.payout)}`;
  return {
    active,
    label: active ? label : "Base game",
    left: active ? 0 : null,
    wilds,
    total: round.payout,
    line,
    collect,
    scatter: round.base.scatterPay,
    spinLine: 0,
    spinCollect: 0,
    note,
    ...faceFor(
      wilds,
      round.mods.includes("extraSpins") ? 2 : 0,
    ),
    bonusWin: Math.max(0, line - lineSum(round.base.lines) + collect),
    triggerWin: lineSum(round.base.lines) + round.base.scatterPay,
  };
}

/**
 * Split a capped collection across collectors and fish.
 * Every collector is given every fish. The shares sum to `got`.
 */
export function collectionShares(
  weights: number[],
  got: number,
  collectors: number,
) {
  if (collectors <= 0 || weights.length === 0 || got <= 0) return [];
  const cells: { c: number; i: number; w: number }[] = [];
  for (let c = 0; c < collectors; c++)
    for (let i = 0; i < weights.length; i++)
      cells.push({ c, i, w: Math.max(1, weights[i]!) });
  const totalW = cells.reduce((n, cell) => n + cell.w, 0) || 1;
  const base = cells.map((cell) => Math.floor((got * cell.w) / totalW));
  let left = got - base.reduce((n, v) => n + v, 0);
  const order = cells
    .map((cell, index) => ({
      index,
      frac: (got * cell.w) / totalW - base[index]!,
    }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);
  for (const item of order) {
    if (left <= 0) break;
    base[item.index]! += 1;
    left -= 1;
  }
  const table = Array.from({ length: collectors }, () =>
    Array(weights.length).fill(0),
  );
  cells.forEach((cell, index) => {
    table[cell.c]![cell.i] = base[index];
  });
  return table;
}

export function winningCells(line: SplashLine) {
  const rows = PAYLINES[line.i];
  if (!rows) return [];
  const cells: { reel: number; row: number }[] = [];
  for (let reel = 0; reel < Math.min(line.n, rows.length); reel++)
    cells.push({ reel, row: rows[reel]! });
  return cells;
}

export type PreviewKind =
  | "hook"
  | "dynamite"
  | "bazooka"
  | "collectors"
  | "upgrade"
  | "capped";

export type EventPreview = {
  kind: PreviewKind;
  label: string;
  fixtureId: string;
  spinIndex: number;
};

export type RoundGroup = {
  id: string;
  title: string;
  note: string;
  aliases: { id: string; title: string }[];
  previews: EventPreview[];
};

/** Ledger immediately before free spin `spinIndex`. Reads the recorded script only. */
export function ledgerBefore(round: SplashScript, spinIndex: number) {
  let wilds = round.banked;
  let line = lineSum(round.base.lines);
  let collect = 0;
  let remaining = round.awarded;
  for (let i = 0; i < spinIndex; i++) {
    const spin = round.free[i]!;
    line += lineSum(spin.lines);
    collect += spin.got;
    wilds += spin.wilds;
    remaining = spin.left;
  }
  const scatter = round.base.scatterPay;
  const spin = round.free[spinIndex];
  return {
    wilds,
    line,
    collect,
    scatter,
    total: Math.min(round.payout, line + collect + scatter),
    remaining,
    mult: spin?.mult ?? collectMult(wilds),
    leftShown: Math.max(0, remaining - 1),
  };
}

function splashCount(spin: SplashScript["free"][number]) {
  return spin.grid.flat().filter((cell) => cell.s === "splash" && !cell.part)
    .length;
}

function cappedSpin(round: SplashScript) {
  if (!round.capped) return -1;
  let line = lineSum(round.base.lines);
  let collect = 0;
  for (let i = 0; i < round.free.length; i++) {
    const spin = round.free[i]!;
    const next =
      line + lineSum(spin.lines) + collect + spin.got + round.base.scatterPay;
    if (spin.got > 0 && next >= round.payout) return i;
    line += lineSum(spin.lines);
    collect += spin.got;
  }
  return -1;
}

/** One button per recorded script. Later copies are aliases, not extra coverage. */
export function groupRounds(
  list: { id: string; title: string; note: string; script: SplashScript }[],
): RoundGroup[] {
  const groups: (RoundGroup & { script: SplashScript })[] = [];
  const index = new Map<string, number>();
  for (const item of list) {
    const key = JSON.stringify(item.script);
    const at = index.get(key);
    if (at != null) {
      groups[at]!.aliases.push({ id: item.id, title: item.title });
      continue;
    }
    index.set(key, groups.length);
    groups.push({
      id: item.id,
      title: item.title,
      note: item.note,
      aliases: [],
      previews: [],
      script: item.script,
    });
  }
  const take = (
    kind: PreviewKind,
    label: string,
    pick: (script: SplashScript) => number,
  ) => {
    for (const group of groups) {
      const spinIndex = pick(group.script);
      if (spinIndex < 0) continue;
      group.previews.push({
        kind,
        label,
        fixtureId: group.id,
        spinIndex,
      });
      return;
    }
  };
  take("hook", "Preview: Hook contact, pull and release", (script) =>
    script.free.findIndex((spin) => spin.tool === "hook" && !!spin.primed),
  );
  take("dynamite", "Preview: Dynamite", (script) =>
    script.free.findIndex((spin) => spin.tool === "dynamite" && !!spin.primed),
  );
  take("bazooka", "Preview: Bazooka", (script) =>
    script.free.findIndex((spin) => spin.tool === "bazooka" && !!spin.primed),
  );
  take("collectors", "Preview: Multiple collectors", (script) =>
    script.free.findIndex(
      (spin) => !spin.tool && splashCount(spin) >= 2 && spin.got > 0,
    ),
  );
  take("upgrade", "Preview: Fourth collector upgrade", (script) => {
    let wilds = script.banked;
    for (let i = 0; i < script.free.length; i++) {
      const spin = script.free[i]!;
      if (wilds < 4 && wilds + spin.wilds >= 4 && spin.extra > 0) return i;
      wilds += spin.wilds;
    }
    return -1;
  });
  take("capped", "Preview: Capped collection", cappedSpin);
  return groups.map(({ script: _script, ...group }) => group);
}

export const PREVIEW_BANNER = "Event preview — no balance changes.";

/**
 * Plays one recorded event from an existing script.
 * Does not copy the script into a new round, roll, debit, or credit.
 */
export async function presentEventPreview(
  scene: ReelScene,
  round: SplashScript,
  preview: EventPreview,
  opts: PresentOpts,
) {
  const fingerprint = JSON.stringify(round);
  const spin = round.free[preview.spinIndex];
  if (!spin) return;
  const led = ledgerBefore(round, preview.spinIndex);
  const spinBonus = round.mods.includes("extraSpins") ? 2 : 0;
  const modeLabel =
    round.mode === "chopper"
      ? "Chopper"
      : round.mode === "buy"
        ? "Bought feature"
        : "Free spins";
  scene.setStake(round.stake);
  scene.setPace(opts.turbo, opts.reduced);
  const publish = (
    note: string,
    wilds: number,
    left: number | null,
    total: number,
    line: number,
    collect: number,
    face?: MeterFace,
    spinLine = 0,
    spinCollect = 0,
  ) => {
    const shown = face ?? faceFor(wilds, spinBonus, spin.mult);
    scene.setTally({ line, collect, mult: shown.mult, total });
    scene.setCopy(note);
    scene.setMeter(wilds, true, left, modeLabel);
    opts.onHud?.({
      active: true,
      label: modeLabel,
      left,
      mult: shown.mult,
      wilds,
      total,
      line,
      collect,
      scatter: led.scatter,
      spinLine,
      spinCollect,
      note,
      filled: shown.filled,
      maxed: shown.maxed,
      nextMult: shown.nextMult,
      nextSpins: shown.nextSpins,
      holding: shown.holding,
      bonusWin: Math.max(0, line - lineSum(round.base.lines) + collect),
      triggerWin: lineSum(round.base.lines) + led.scatter,
    });
  };
  const faceNow = (wilds: number, mult = spin.mult) =>
    faceFor(wilds, spinBonus, mult);
  const arm = async () => {
    scene.armPreview?.(preview.kind);
    if (!opts.skipped()) await hold(opts, 420);
    if (opts.skipped()) return false;
    if (opts.fault?.()) throw new Error("event preview failed");
    return true;
  };
  scene.setMood("cast");
  scene.setLocks([]);
  if (
    preview.kind === "hook" ||
    preview.kind === "dynamite" ||
    preview.kind === "bazooka"
  ) {
    if (!spin.primed || !spin.tool) return;
    scene.show(spin.primed);
    publish(
      PREVIEW_BANNER,
      led.wilds,
      led.leftShown,
      led.total,
      led.line,
      led.collect,
      faceNow(led.wilds),
    );
    if (!(await arm())) return;
    await scene.tool({ ...spin, tool: spin.tool });
  } else if (preview.kind === "collectors" || preview.kind === "capped") {
    scene.show(spin.grid);
    publish(
      PREVIEW_BANNER,
      led.wilds,
      led.leftShown,
      led.total,
      led.line,
      led.collect,
      faceNow(led.wilds),
    );
    if (!(await arm())) return;
    if (!opts.skipped()) await scene.collect(spin);
    if (!opts.skipped()) {
      const total = Math.min(
        round.payout,
        led.total + lineSum(spin.lines) + spin.got,
      );
      publish(
        preview.kind === "capped"
          ? `Capped at ${money(total)}`
          : `Collected ${money(spin.got)}`,
        led.wilds,
        led.leftShown,
        total,
        led.line + lineSum(spin.lines),
        led.collect + spin.got,
        faceNow(led.wilds),
        lineSum(spin.lines),
        spin.got,
      );
    }
  } else {
    const arrived = Math.min(
      round.payout,
      led.total + lineSum(spin.lines) + spin.got,
    );
    scene.show(spin.grid);
    publish(
      PREVIEW_BANNER,
      led.wilds,
      led.leftShown,
      arrived,
      led.line + lineSum(spin.lines),
      led.collect + spin.got,
      faceNow(led.wilds),
      lineSum(spin.lines),
      spin.got,
    );
    if (!(await arm())) return;
    if (!opts.skipped() && scene.deliverCollectors && spin.wilds > 0) {
      const beforeWilds = led.wilds;
      await scene.deliverCollectors(spin.wilds, async (index) => {
        const now = beforeWilds + index + 1;
        const mark = thresholdCrossed(beforeWilds, now);
        publish(
          PREVIEW_BANNER,
          now,
          led.leftShown,
          arrived,
          led.line + lineSum(spin.lines),
          led.collect + spin.got,
          mark == null
            ? faceNow(now, collectMult(beforeWilds))
            : holdFace(mark, spinBonus, collectMult(beforeWilds)),
          lineSum(spin.lines),
          spin.got,
        );
        if (mark != null && now === mark) await hold(opts, 480);
      });
    }
    if (!opts.skipped() && spin.extra > 0) {
      const beforeWilds = led.wilds;
      const afterWilds = beforeWilds + spin.wilds;
      const nextMult = collectMult(afterWilds);
      const during = announcementFace(beforeWilds, afterWilds, spinBonus);
      let awarded = false;
      publish(
        PREVIEW_BANNER,
        afterWilds,
        led.leftShown,
        arrived,
        led.line + lineSum(spin.lines),
        led.collect + spin.got,
        during,
        lineSum(spin.lines),
        spin.got,
      );
      await scene.retrigger(spin.extra, nextMult, () => {
        if (awarded) return;
        awarded = true;
        publish(
          `+${spin.extra} spins · next collection ×${nextMult}`,
          afterWilds,
          spin.left,
          arrived,
          led.line + lineSum(spin.lines),
          led.collect + spin.got,
          during,
          lineSum(spin.lines),
          spin.got,
        );
      });
      if (!opts.skipped())
        publish(
          PREVIEW_BANNER,
          afterWilds,
          spin.left,
          arrived,
          led.line + lineSum(spin.lines),
          led.collect + spin.got,
          faceFor(afterWilds, spinBonus),
          lineSum(spin.lines),
          spin.got,
        );
    }
  }
  if (!opts.skipped()) scene.finishPlate(PREVIEW_BANNER);
  if (JSON.stringify(round) !== fingerprint)
    throw new Error("event preview mutated a recorded script");
}

export type RecordedPair = { fixtureId: string; spinIndex: number };

/**
 * The saved two-fish, two-collector board.
 * Selected by the recorded cells, not by a pasted payout.
 */
export function findPairCollection(
  list: { id: string; script: SplashScript }[],
): RecordedPair | null {
  let found: RecordedPair | null = null;
  for (const item of list) {
    const stake = item.script.stake;
    for (let spinIndex = 0; spinIndex < item.script.free.length; spinIndex++) {
      const spin = item.script.free[spinIndex]!;
      if (spin.tool || spin.mult !== 2 || spin.extra <= 0 || spin.got <= 0)
        continue;
      const fish = spin.grid
        .flat()
        .filter((cell) => cell.s === "brick" && !cell.part && cell.v != null);
      const collectors = spin.grid
        .flat()
        .filter((cell) => cell.s === "splash" && !cell.part);
      if (fish.length !== 2 || collectors.length !== 2) continue;
      const values = fish.map((cell) => cell.v ?? 0).sort((a, b) => a - b);
      if (values[0] !== 2 || values[1] !== 10) continue;
      const printed = fish.reduce(
        (sum, cell) => sum + Math.round(stake * (cell.v ?? 0)),
        0,
      );
      if (printed * spin.mult * collectors.length !== spin.got) continue;
      found = { fixtureId: item.id, spinIndex };
    }
  }
  return found;
}

/**
 * Review only. Restores one recorded spin after the reels have settled and
 * before collection, then plays that spin's collect, portraits, and retrigger.
 * Does not roll, debit, credit, or copy the script.
 */
export async function presentSettledCollection(
  scene: ReelScene,
  round: SplashScript,
  spinIndex: number,
  opts: PresentOpts,
) {
  const fingerprint = JSON.stringify(round);
  const spin = round.free[spinIndex];
  if (!spin || spin.got <= 0) return;
  const led = ledgerBefore(round, spinIndex);
  const spinBonus = round.mods.includes("extraSpins") ? 2 : 0;
  const modeLabel =
    round.mode === "chopper"
      ? "Chopper"
      : round.mode === "buy"
        ? "Bought feature"
        : "Free spins";
  scene.setStake(round.stake);
  scene.setPace(opts.turbo, opts.reduced);
  let shownWilds: number | null = null;
  const publish = (
    note: string,
    wilds: number,
    left: number | null,
    total: number,
    line: number,
    collect: number,
    face?: MeterFace,
    spinLine = 0,
    spinCollect = 0,
  ) => {
    const count = shownWilds ?? wilds;
    const shown = face ?? faceFor(count, spinBonus, spin.mult);
    scene.setTally({ line, collect, mult: shown.mult, total });
    scene.setCopy(note);
    scene.setMeter(count, true, left, modeLabel);
    opts.onHud?.({
      active: true,
      label: modeLabel,
      left,
      mult: shown.mult,
      wilds: count,
      total,
      line,
      collect,
      scatter: led.scatter,
      spinLine,
      spinCollect,
      note,
      filled: shown.filled,
      maxed: shown.maxed,
      nextMult: shown.nextMult,
      nextSpins: shown.nextSpins,
      holding: shown.holding,
      bonusWin: Math.max(0, line - lineSum(round.base.lines) + collect),
      triggerWin: lineSum(round.base.lines) + led.scatter,
    });
  };
  const spinLine = lineSum(spin.lines);
  const arrived = Math.min(round.payout, led.total + spinLine + spin.got);
  const line = led.line + spinLine;
  const collected = led.collect + spin.got;
  const leftBefore = led.leftShown;
  scene.setMood("cast");
  scene.setLocks([]);
  scene.show(spin.grid);
  publish(
    `Collecting at ×${spin.mult}`,
    led.wilds,
    leftBefore,
    led.total,
    led.line,
    led.collect,
    faceFor(led.wilds, spinBonus, spin.mult),
  );
  if (!opts.skipped()) await hold(opts, 420);
  if (opts.skipped()) return;
  cue("collect");
  await scene.collect(spin);
  if (opts.skipped()) return;
  scene.setMood("cheer");
  publish(
    `Collected ${money(spin.got)}`,
    led.wilds,
    leftBefore,
    arrived,
    line,
    collected,
    faceFor(led.wilds, spinBonus, spin.mult),
    spinLine,
    spin.got,
  );
  if (!opts.skipped()) await hold(opts, 120);
  if (opts.skipped()) return;
  if (spin.wilds > 0 && scene.deliverCollectors) {
    const beforeWilds = led.wilds;
    const spinMult = collectMult(beforeWilds);
    await scene.deliverCollectors(spin.wilds, async (index) => {
      if (opts.skipped()) return;
      const now = beforeWilds + index + 1;
      shownWilds = now;
      const mark = thresholdCrossed(beforeWilds, now);
      publish(
        resultPreview(spin, spinLine),
        led.wilds,
        leftBefore,
        arrived,
        line,
        collected,
        mark == null
          ? faceFor(now, spinBonus, spinMult)
          : holdFace(mark, spinBonus, spinMult),
        spinLine,
        spin.got,
      );
      if (mark != null && now === mark) await hold(opts, 480);
    });
    shownWilds = null;
  }
  if (opts.skipped()) return;
  const afterWilds = led.wilds + spin.wilds;
  if (spin.extra > 0) {
    const nextMult = collectMult(afterWilds);
    const during = announcementFace(led.wilds, afterWilds, spinBonus);
    let awarded = false;
    publish(
      resultPreview(spin, spinLine),
      afterWilds,
      leftBefore,
      arrived,
      line,
      collected,
      during,
      spinLine,
      spin.got,
    );
    cue("level");
    await scene.retrigger(spin.extra, nextMult, () => {
      if (awarded) return;
      awarded = true;
      publish(
        `+${spin.extra} spins · next collection ×${nextMult}`,
        afterWilds,
        spin.left,
        arrived,
        line,
        collected,
        during,
        spinLine,
        spin.got,
      );
    });
    if (!opts.skipped())
      publish(
        resultPreview(spin, spinLine),
        afterWilds,
        awarded ? spin.left : leftBefore,
        arrived,
        line,
        collected,
        faceFor(afterWilds, spinBonus),
        spinLine,
        spin.got,
      );
  }
  if (JSON.stringify(round) !== fingerprint)
    throw new Error("review playback mutated a recorded script");
}

function toolTitle(tool: string) {
  return tool === "dynamite"
    ? "Dynamite · packages incoming"
    : tool === "bazooka"
      ? "Bazooka · board refill"
      : "Hook · reel pulled";
}

function resultPreview(
  spin: { got: number; wilds: number },
  spinLine: number,
) {
  return spin.got > 0
    ? `Collected ${money(spin.got)}`
    : spinLine > 0
      ? `Line win ${money(spinLine)}`
      : spin.wilds > 0
        ? `+${spin.wilds} collector${spin.wilds === 1 ? "" : "s"}`
        : "No win this spin";
}

/** Sockets within the active tier. A count of 4, 8, or 12 is the next tier with an empty set. */
export function faceFor(
  wilds: number,
  bonus = 0,
  mult = collectMult(wilds),
): MeterFace {
  const maxed = wilds >= 12;
  const level = meterLevel(wilds);
  const base = [0, 4, 8, 12][level] ?? 0;
  return {
    filled: maxed ? 4 : Math.max(0, wilds - base),
    maxed,
    nextMult: maxed ? null : (LEVEL_MULT[level + 1] ?? null),
    nextSpins: maxed ? 0 : 10 + bonus,
    mult,
    holding: false,
  };
}

/** The completed four-portrait set, before the tier advances. */
export function holdFace(
  threshold: number,
  bonus: number,
  mult: number,
): MeterFace {
  const level = meterLevel(threshold);
  return {
    filled: 4,
    maxed: false,
    nextMult: LEVEL_MULT[level] ?? null,
    nextSpins: 10 + bonus,
    mult,
    holding: true,
  };
}

/** Highest 4, 8, or 12 mark crossed between two collector counts. */
export function thresholdCrossed(before: number, after: number): number | null {
  let hit: number | null = null;
  for (const mark of [4, 8, 12]) {
    if (before < mark && after >= mark) hit = mark;
  }
  return hit;
}

/** Meter held through the retrigger line. Overflow is applied only after it. */
export function announcementFace(
  before: number,
  after: number,
  bonus: number,
): MeterFace {
  const mark = thresholdCrossed(before, after);
  const mult = collectMult(before);
  if (mark == null) return faceFor(after, bonus, mult);
  return holdFace(mark, bonus, mult);
}

/** What the completion panel may say. Continue never charges or credits. */
export function featureSummary(round: SplashScript) {
  const purchased = round.mode === "buy" || round.mode === "chopper";
  return {
    feature: round.free.length > 0,
    payout: round.payout,
    purchaseCost: purchased ? round.cost : null,
    celebrate: round.payout > round.cost,
    returnMode: "spin" as const,
    chargeOnContinue: 0,
    creditOnContinue: 0,
  };
}

/** The main button after a feature must not stay armed as another purchase. */
export function spinControl(state: {
  ready: boolean;
  busy: boolean;
  summary: boolean;
  mode: string;
  cost: number;
}) {
  if (!state.ready) return { label: "LOADING", purchase: false };
  if (state.busy) return { label: "SKIP", purchase: false };
  if (state.summary) return { label: "SPIN", purchase: false };
  if (state.mode === "buy" || state.mode === "chopper")
    return { label: `BUY ${money(state.cost)}`, purchase: true };
  return { label: "SPIN", purchase: false };
}
