import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  playSplash,
  splashCost,
  splashRoundCap,
  splashStakeOk,
  type SplashMode,
  type SplashScript,
  type SplashCell,
} from "@/lib/kilo/engine";
import {
  readBank,
  recallRound,
  rememberRound,
  resetBank,
  SANDBOX_START,
  settle,
  writeBank,
} from "@/lib/kilo/bank";
import { muted, setMuted } from "@/lib/kilo/sound";
import {
  presentScript,
  presentEventPreview,
  presentSettledCollection,
  findPairCollection,
  featureSummary,
  finalHud,
  spinControl,
  faceFor,
  groupRounds,
  PREVIEW_BANNER,
  type FeatureHud,
  type EventPreview,
  type SymbolCompareResult,
} from "./director";
import { ReelStage, type MountedScene } from "./ReelStage";
import fixtures from "@/lib/kilo/fixtures.json";

const STAKES = [100, 500, 1000, 2500, 10000];
const SOURCE_ZIP = "/kilo-source-only.zip";
const SOURCE_NAME = "kilo-source-only.zip";
/** KING emblem is the live scatter. Packages carry the cash plaque. */
const SCATTER_IS_KING = true;

type Fixture = {
  id: string;
  title: string;
  note: string;
  seed: number;
  mode: string;
  stake: number;
  script: SplashScript;
};

const ALL = Object.values(fixtures as Record<string, Fixture>);
const GROUPS = groupRounds(ALL);
const PAIR = findPairCollection(ALL);

function cryptoRng() {
  const buf = new Uint32Array(32);
  let i = 32;
  return () => {
    if (i >= buf.length) {
      crypto.getRandomValues(buf);
      i = 0;
    }
    return buf[i++]! / 4294967296;
  };
}

function money(n: number) {
  return Math.max(0, Math.round(n)).toLocaleString();
}

type FisherPose = "idle" | "cast" | "cheer" | "slump";

/** One coherent illustration. A full character rig is a separate art deliverable. */
function FisherPortrait({
  pose,
  mini = false,
}: {
  pose: FisherPose;
  mini?: boolean;
}) {
  return (
    <div
      className={`kk-fisher is-${pose}${mini ? " is-mini" : ""}`}
      data-pose={pose}
    >
      {mini ? (
        <img src="/kilo-motion-v7/collector-idle.png" alt="" />
      ) : (
        <picture>
          <source
            media="(max-width: 740px)"
            srcSet="/kilo-night-v3/hero-bust.png"
          />
          <img src="/kilo-presentation-v6/hero-fishing.png" alt="" />
        </picture>
      )}
    </div>
  );
}

type CollectionDisplay = {
  index: number;
  count: number;
  mult: number;
  subtotal: number;
  completed: number;
  phase: "gather" | "bank";
  capped?: boolean;
} | null;

type Saved = { v: 2; script: SplashScript; credited: boolean };

function readSaved(): Saved | null {
  const raw = recallRound();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Saved | SplashScript;
    if (parsed && typeof parsed === "object" && "v" in parsed && parsed.v === 2)
      return parsed;
    if (parsed && typeof parsed === "object" && "mode" in parsed)
      return { v: 2, script: parsed, credited: true };
  } catch {
    return null;
  }
  return null;
}

const SETTLEMENT_KEYS = ["kilo-sandbox-bank-v1", "kilo-sandbox-last-v1"];

/** Reports bank and saved-round writes. Does not undo them. */
function watchSettlementWrites(report: (key: string) => void) {
  const proto = Storage.prototype;
  const originalSet = proto.setItem;
  const originalRemove = proto.removeItem;
  const note = (key: string) => {
    if (SETTLEMENT_KEYS.includes(key)) report(key);
  };
  proto.setItem = function (key: string, value: string) {
    note(key);
    return originalSet.call(this, key, value);
  };
  proto.removeItem = function (key: string) {
    note(key);
    return originalRemove.call(this, key);
  };
  return () => {
    proto.setItem = originalSet;
    proto.removeItem = originalRemove;
  };
}

export function KiloTable({ review = false }: { review?: boolean }) {
  const sceneRef = useRef<MountedScene | null>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const [collection, setCollection] = useState<CollectionDisplay>(null);
  const [awardLanded, setAwardLanded] = useState(false);
  const [capNotice, setCapNotice] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [ready, setReady] = useState(false);
  const [bank, setBank] = useState(SANDBOX_START);
  const [stake, setStake] = useState(1000);
  const [mode, setMode] = useState<SplashMode>("spin");
  const [busy, setBusy] = useState(false);
  const [mute, setMute] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [win, setWin] = useState(0);
  const [sourceNote, setSourceNote] = useState("");
  const [panel, setPanel] = useState(review);
  const [help, setHelp] = useState(false);
  const [buyPanel, setBuyPanel] = useState(false);
  const [summary, setSummary] = useState<null | {
    payout: number;
    purchaseCost: number | null;
    celebrate: boolean;
  }>(null);
  const [settled, setSettled] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const busyRef = useRef(false);
  const [note, setNote] = useState("");
  const [previewNote, setPreviewNote] = useState("");
  const [symbolReport, setSymbolReport] = useState<SymbolCompareResult | null>(null);
  const compareSlot = useRef<HTMLDivElement>(null);
  const compareCanvas = useRef<HTMLCanvasElement | null>(null);
  const [storageFault, setStorageFault] = useState("");
  const previewingRef = useRef(false);
  const previewGrid = useRef<SplashCell[][] | null>(null);
  const [hud, setHud] = useState<FeatureHud | null>(null);
  const [fisher, setFisher] = useState<{ pose: FisherPose; tick: number }>({
    pose: "idle",
    tick: 0,
  });
  const [round, setRound] = useState<SplashScript | null>(null);
  const skipRef = useRef(false);
  const creditRef = useRef<string | null>(null);
  const onReady = useCallback((scene: MountedScene) => {
    sceneRef.current = scene;
    setReady(true);
  }, []);

  useEffect(() => {
    const slot = compareSlot.current;
    const canvas = compareCanvas.current;
    if (!slot || !canvas || !symbolReport) return;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    slot.replaceChildren(canvas);
  }, [symbolReport]);

  function openSymbolCompare() {
    const out = sceneRef.current?.symbolCompare?.();
    if (!out) return;
    compareCanvas.current = out.canvas;
    setSymbolReport(out.report);
  }

  useEffect(() => {
    const saved = readSaved(),
      scene = sceneRef.current;
    if (!ready || !saved || !scene) return;
    const script = saved.script;
    const line =
      script.base.lines.reduce((n, l) => n + l.pay, 0) +
      script.free.reduce(
        (n, s) => n + s.lines.reduce((v, l) => v + l.pay, 0),
        0,
      );
    const collect = script.free.reduce((n, s) => n + s.got, 0);
    const baseLine = script.base.lines.reduce((n, l) => n + l.pay, 0);
    const wilds = script.banked + script.free.reduce((n, s) => n + s.wilds, 0);
    scene.setStake(script.stake);
    scene.show(script.free.at(-1)?.grid ?? script.base.grid);
    scene.setCopy(`Last result · ${money(script.payout)}`);
    scene.setMood("idle");
    setSettled(true);
    setHud({
      active: false,
      label: "Base game",
      left: null,
      wilds,
      total: script.payout,
      line,
      collect,
      scatter: script.base.scatterPay,
      spinLine: 0,
      spinCollect: 0,
      note: "Last result",
      ...faceFor(wilds, script.mods.includes("extraSpins") ? 2 : 0),
      bonusWin: Math.max(0, line - baseLine + collect),
      triggerWin: baseLine + script.base.scatterPay,
    });
  }, [ready]);

  useEffect(() => {
    const onMood = (event: Event) => {
      const mood = (event as CustomEvent<{ mood?: FisherPose }>).detail?.mood;
      if (
        mood !== "idle" &&
        mood !== "cast" &&
        mood !== "cheer" &&
        mood !== "slump"
      )
        return;
      setFisher((prev) => ({ pose: mood, tick: prev.tick + 1 }));
    };
    let landTimer = 0;
    const onCollection = (event: Event) => {
      const detail = (event as CustomEvent<CollectionDisplay>).detail;
      setCollection(detail);
      if (detail?.phase === "bank" && detail.capped) setCapNotice(true);
      if (detail?.phase === "bank") {
        setAwardLanded(true);
        window.clearTimeout(landTimer);
        landTimer = window.setTimeout(() => setAwardLanded(false), 720);
      }
    };
    const root = appRef.current;
    root?.addEventListener("kilo-mood", onMood);
    root?.addEventListener("kilo-collection", onCollection);
    return () => {
      window.clearTimeout(landTimer);
      root?.removeEventListener("kilo-mood", onMood);
      root?.removeEventListener("kilo-collection", onCollection);
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!hud?.active || hud.note === "Free spin") setCapNotice(false);
  }, [hud]);

  useEffect(
    () => () => {
      skipRef.current = true;
    },
    [],
  );

  useEffect(() => {
    setBank(readBank());
    setMute(muted());
    const saved = readSaved();
    if (!saved) return;
    setRound(saved.script);
    setWin(saved.script.payout);
    if (!saved.credited) {
      writeBank(readBank() + saved.script.payout);
      setBank(readBank());
      rememberRound(JSON.stringify({ ...saved, credited: true }));
    }
  }, []);

  function reduced() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  useEffect(() => {
    const w = window as Window & {
      __kkPresentFrom?: (
        id: string,
        index: number,
        opts?: { turbo?: boolean },
      ) => Promise<void>;
    };
    w.__kkPresentFrom = async (id, index, opts) => {
      const fixture = ALL.find((item) => item.id === id);
      const scene = sceneRef.current;
      if (!fixture || !scene) throw new Error("Kilo scene is not ready");
      busyRef.current = true;
      setBusy(true);
      setReviewing(true);
      setSummary(null);
      setPanel(false);
      skipRef.current = false;
      try {
        await presentScript(scene, fixture.script, {
          turbo: opts?.turbo ?? false,
          reduced: reduced(),
          skipped: () => skipRef.current,
          startFreeIndex: index,
          onHud: (next) => setHud(next),
        });
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    };
    return () => {
      delete w.__kkPresentFrom;
    };
  }, []);

  function credit(script: SplashScript) {
    const id = JSON.stringify({
      payout: script.payout,
      cost: script.cost,
      mode: script.mode,
      stake: script.stake,
      n: script.free.length,
      base: script.base.scatters,
    });
    if (creditRef.current === id) return;
    creditRef.current = id;
    writeBank(readBank() + script.payout);
    setBank(readBank());
    rememberRound(
      JSON.stringify({ v: 2, script, credited: true } satisfies Saved),
    );
  }

  async function run(script: SplashScript, reviewMode: boolean) {
    const scene = sceneRef.current;
    if (!scene || busyRef.current) return;
    busyRef.current = true;
    setReviewing(reviewMode);
    setPreviewNote("");
    setStorageFault("");
    previewingRef.current = false;
    previewGrid.current = null;
    setPanel(false);
    skipRef.current = false;
    setBusy(true);
    setRound(script);
    setWin(0);
    try {
      await presentScript(scene, script, {
        turbo,
        reduced: reduced(),
        skipped: () => skipRef.current,
        onHud: (next) => setHud(next),
      });
    } catch (error) {
      console.error("Kilo presentation failed", error);
      const end = finalHud(script);
      try {
        scene.show(script.free.at(-1)?.grid ?? script.base.grid);
        scene.setMood(script.payout > script.cost ? "cheer" : "slump");
        scene.finishPlate(end.note);
      } catch {
        /* the stage may already have been released */
      }
      setHud(end);
      setNote("Animation interrupted. The saved round result was restored.");
    } finally {
      busyRef.current = false;
      if (!reviewMode) credit(script);
      setWin(script.payout);
      setBusy(false);
      const done = featureSummary(script);
      if (done.feature) {
        setMode("spin");
        setBuyPanel(false);
        setSummary({
          payout: done.payout,
          purchaseCost: done.purchaseCost,
          celebrate: done.celebrate,
        });
      }
    }
  }

  function continueFeature() {
    const returned = summary?.payout ?? win;
    setSummary(null);
    setMode("spin");
    setBuyPanel(false);
    setSettled(true);
    setWin(returned);
    const scene = sceneRef.current;
    scene?.setMood("idle");
    scene?.setLocks([]);
    scene?.finishPlate(`Last result · ${money(returned)}`);
    setHud((current) =>
      current
        ? {
            ...current,
            active: false,
            left: null,
            label: "Base game",
            note: "Last result",
          }
        : current,
    );
  }

  async function play() {
    if (busyRef.current || !ready || summary) return;
    if (!splashStakeOk(stake, mode)) {
      setNote("That charge is outside the stake rules.");
      return;
    }
    const cost = splashCost(stake, mode);
    const paid = settle(cost, 0);
    if (!paid.ok) {
      setNote(paid.reason);
      return;
    }
    setBank(readBank());
    setNote("");
    setSettled(false);
    setSummary(null);
    const script = playSplash(stake, mode, cryptoRng());
    rememberRound(
      JSON.stringify({ v: 2, script, credited: false } satisfies Saved),
    );
    creditRef.current = null;
    await run(script, false);
  }

  function skip() {
    if (!busyRef.current) return;
    skipRef.current = true;
    const scene = sceneRef.current;
    if (previewingRef.current && previewGrid.current) {
      scene?.show(previewGrid.current);
      scene?.finishPlate(PREVIEW_BANNER);
      return;
    }
    if (!round) return;
    const last = round.free.length
      ? round.free[round.free.length - 1]!.grid
      : round.base.grid;
    scene?.show(last);
    scene?.finishPlate(
      round.capped
        ? `Capped at ${money(round.payout)}`
        : round.payout > 0
          ? `Paid ${money(round.payout)}`
          : "No pay",
    );
  }

  async function playPreview(fixture: Fixture, preview: EventPreview) {
    const scene = sceneRef.current;
    if (!scene || busyRef.current) return;
    const spin = fixture.script.free[preview.spinIndex];
    if (!spin) return;
    const writes: string[] = [];
    const stopWatch = watchSettlementWrites((key) => {
      writes.push(key);
    });
    busyRef.current = true;
    previewingRef.current = true;
    previewGrid.current = spin.grid;
    setReviewing(true);
    setPreviewNote(PREVIEW_BANNER);
    setStorageFault("");
    setPanel(false);
    skipRef.current = false;
    setBusy(true);
    setSummary(null);
    setNote(`${fixture.title}. ${preview.label}. ${PREVIEW_BANNER}`);
    try {
      await presentEventPreview(scene, fixture.script, preview, {
        turbo,
        reduced: reduced(),
        skipped: () => skipRef.current,
        fault: () =>
          (window as Window & { __kiloForcePreviewError?: boolean })
            .__kiloForcePreviewError === true,
        onHud: (next) => setHud(next),
      });
    } catch (error) {
      console.error("Kilo event preview failed", error);
      scene.show(spin.grid);
      scene.finishPlate(PREVIEW_BANNER);
      setNote("Event preview interrupted. The recorded board was restored.");
    } finally {
      stopWatch();
      if (writes.length) {
        const text = `Unexpected write during event preview: ${writes.join(", ")}. The bank was not rolled back.`;
        setStorageFault(text);
        setNote(text);
      }
      busyRef.current = false;
      previewingRef.current = false;
      setBusy(false);
    }
  }

  async function playPair() {
    const scene = sceneRef.current;
    const fixture = PAIR
      ? ALL.find((item) => item.id === PAIR.fixtureId)
      : undefined;
    const spin = fixture?.script.free[PAIR?.spinIndex ?? -1];
    if (!scene || !fixture || !PAIR || !spin || busyRef.current) return;
    const writes: string[] = [];
    const stopWatch = watchSettlementWrites((key) => {
      writes.push(key);
    });
    setPanel(false);
    setHelp(false);
    setBuyPanel(false);
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() => resolve()),
      );
    });
    if (busyRef.current) {
      stopWatch();
      return;
    }
    busyRef.current = true;
    previewingRef.current = true;
    previewGrid.current = spin.grid;
    setReviewing(true);
    setPreviewNote("");
    setStorageFault("");
    skipRef.current = false;
    setBusy(true);
    setSummary(null);
    setNote("");
    try {
      await presentSettledCollection(scene, fixture.script, PAIR.spinIndex, {
        turbo: false,
        reduced: reduced(),
        skipped: () => skipRef.current,
        onHud: (next) => setHud(next),
      });
    } catch (error) {
      console.error("Kilo collection review failed", error);
      scene.show(spin.grid);
      setNote("Collection review interrupted. The recorded board was restored.");
    } finally {
      stopWatch();
      if (writes.length) {
        const text = `Unexpected write during collection review: ${writes.join(", ")}. The bank was not rolled back.`;
        setStorageFault(text);
        setNote(text);
      }
      busyRef.current = false;
      previewingRef.current = false;
      setBusy(false);
    }
  }

  const cost = splashCost(stake, mode);
  const cap = splashRoundCap(stake);
  const afford = !busy && cost > bank;
  const control = spinControl({
    ready,
    busy,
    summary: summary != null,
    mode,
    cost,
  });

  function pick(fixture: Fixture) {
    setNote(`${fixture.title}. Seed ${fixture.seed}. ${fixture.note}`);
    void run(fixture.script, true);
  }
  const caption =
    hud && !hud.active && hud.note && !/last result/i.test(hud.note)
      ? hud.note
      : "";
  const modalOpen = help || buyPanel || summary != null;

  function stepStake(dir: number) {
    const index = Math.max(0, STAKES.indexOf(stake));
    const next = STAKES[Math.min(STAKES.length - 1, Math.max(0, index + dir))];
    if (next == null) return;
    setStake(next);
    if (!splashStakeOk(next, mode)) setMode("spin");
  }

  return (
    <div className="kk-app" ref={appRef} data-reduced={reducedMotion ? "1" : "0"}>
      <header className="kk-dev">
        {previewNote ? (
          <p className="kk-preview-banner" role="status" data-testid="preview-banner">
            {previewNote}
          </p>
        ) : null}
        <span className="kk-sandbox">{sourceNote || "LOCAL SANDBOX"}</span>
        <nav aria-label="Game menu">
          <button
            type="button"
            onClick={() => {
              setPanel(false);
              setHelp(false);
              setBuyPanel(false);
            }}
          >
            Play
          </button>
          <button
            type="button"
            onClick={() => {
              setPanel(!panel);
              setHelp(false);
              setBuyPanel(false);
            }}
          >
            Review
          </button>
          <a
            href={SOURCE_ZIP}
            download={SOURCE_NAME}
            data-source="1"
            onClick={() =>
              setSourceNote("Download started. Check your browser downloads.")
            }
          >
            Source
          </a>
        </nav>
      </header>
      <main className="kk-stage" data-testid="game-stage">
        {storageFault ? (
          <p className="kk-storage-fault" role="alert" data-testid="storage-fault">
            {storageFault}
          </p>
        ) : null}
        <div
          className={`kk-shell ${hud?.active ? "is-feature" : ""} ${hud?.active && hud.bonusWin === hud.total ? "is-same-return" : ""}`}
          data-layout="r2"
          data-testid="game-hud"
          inert={modalOpen ? true : undefined}
        >
          <div className="kk-playfield">
          <div className="kk-crest">
            {hud?.active ? (
              <div
                className={`kk-bonus${hud.holding ? " is-holding" : ""}${hud.maxed ? " is-max" : ""}${capNotice ? " is-capped" : ""}`}
              >
                <img
                  className="kk-bonus-mark"
                  src="/kilo-night-v3/logo-kilo-king.png"
                  alt=""
                />
                <div className="kk-bonus-spins">
                  <img
                    className="kk-plate"
                    src="/kilo-night-v3/ui-plate.svg"
                    alt=""
                  />
                  <div className="kk-plate-copy">
                    <span className="kk-eyebrow">FREE SPINS</span>
                    <b data-testid="spins-left">{hud.left ?? 0}</b>
                  </div>
                </div>
                <div className="kk-bonus-track">
                  <div
                    className="kk-sockets"
                    aria-label={
                      hud.maxed
                        ? "All collectors filled. Maximum multiplier."
                        : `${hud.filled} of 4 collectors filled. Collect ×${hud.mult}.`
                    }
                  >
                    {[0, 1, 2, 3].map((i) => {
                      const filled = i < hud.filled;
                      return (
                        <div
                          key={i}
                          data-socket={i}
                          className={`kk-socket${filled ? " filled" : ""}${!hud.maxed && !hud.holding && i === hud.filled ? " next" : ""}`}
                        >
                          {filled ? (
                            <FisherPortrait
                              mini
                              pose={hud.holding ? "cheer" : "idle"}
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  {capNotice ? (
                    <span className="kk-next kk-cap-note">MAX WIN REACHED</span>
                  ) : hud.maxed || hud.nextMult == null ? (
                    <span className="kk-next">MAX LEVEL</span>
                  ) : (
                    <span className="kk-next">
                      <span className="kk-next-long">
                        NEXT +{hud.nextSpins} SPINS · ×{hud.nextMult}
                      </span>
                      <span className="kk-next-short">
                        +{hud.nextSpins} · ×{hud.nextMult}
                      </span>
                    </span>
                  )}
                </div>
                <div className="kk-bonus-pay">
                  <img
                    className="kk-plate"
                    src="/kilo-night-v3/ui-plate.svg"
                    alt=""
                  />
                  <div className="kk-plate-copy">
                    <span className="kk-eyebrow">COLLECT</span>
                    <b className="kk-mult">×{hud.mult}</b>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="kk-bust" key={fisher.tick}>
                  <FisherPortrait pose={fisher.pose} />
                </div>
                <img
                  className="kk-logo"
                  src="/kilo-night-v3/logo-kilo-king.png"
                  alt="Kilo King"
                />
                <div className="kk-crest-status">
                  <p className="kk-event">{caption}</p>
                </div>
              </>
            )}
          </div>
          <div className="kk-canvas-wrap" data-testid="reel-host">
            <ReelStage onReady={onReady} />
          </div>
          </div>
          <aside className="kk-dock" aria-label="Play controls">
            <button
              type="button"
              className={`kk-feature-button ${mode === "buy" || mode === "chopper" ? "selected" : ""}`}
              disabled={busy || summary != null || !!hud?.active}
              aria-pressed={mode === "buy" || mode === "chopper"}
              onClick={() => {
                setHelp(false);
                setPanel(false);
                setBuyPanel(!buyPanel);
              }}
            >
              <span>
                {mode === "chopper"
                  ? "CHOPPER"
                  : mode === "buy"
                    ? "FREE SPINS"
                    : "BUY FEATURE"}
              </span>
            </button>
            <div className="kk-bet">
              <span className="kk-eyebrow" id="base-bet-label">
                BASE BET
              </span>
              <div className="kk-stepper">
                <button
                  type="button"
                  className="kk-round kk-step"
                  aria-label="Decrease bet"
                  disabled={busy || summary != null || stake === STAKES[0]}
                  onClick={() => stepStake(-1)}
                >
                  <img src="/kilo-night-v3/icon-minus.png" alt="" />
                </button>
                <select
                  id="base-bet"
                  aria-labelledby="base-bet-label"
                  disabled={busy || summary != null}
                  value={stake}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setStake(n);
                    if (!splashStakeOk(n, mode)) setMode("spin");
                  }}
                >
                  {STAKES.map((n) => (
                    <option key={n} value={n}>
                      {money(n)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="kk-round kk-step"
                  aria-label="Increase bet"
                  disabled={
                    busy ||
                    summary != null ||
                    stake === STAKES[STAKES.length - 1]
                  }
                  onClick={() => stepStake(1)}
                >
                  <img src="/kilo-night-v3/icon-plus.png" alt="" />
                </button>
              </div>
            </div>
            <button
              type="button"
              className={`kk-ante ${mode === "ante" ? "selected" : ""}`}
              disabled={busy || summary != null}
              aria-pressed={mode === "ante"}
              onClick={() => setMode(mode === "ante" ? "spin" : "ante")}
            >
              <span>ANTE 1.5×</span>
              <b>{money(splashCost(stake, "ante"))}</b>
            </button>
            <div className="kk-dock-tools">
              <button
                type="button"
                className={`kk-turbo ${turbo ? "selected" : ""}`}
                aria-pressed={turbo}
                aria-label="Turbo"
                disabled={busy || summary != null}
                onClick={() => setTurbo(!turbo)}
              >
                <img src="/kilo-night-v3/icon-turbo.png" alt="" />
              </button>
              <button
                type="button"
                className="kk-round kk-sound"
                aria-pressed={!mute}
                aria-label={mute ? "Sound off" : "Sound on"}
                onClick={() => {
                  setMute(!mute);
                  setMuted(!mute);
                }}
              >
                <img src="/kilo-night-v3/icon-sound.png" alt="" />
              </button>
              <button
                type="button"
                className="kk-round kk-rules-btn"
                aria-label="Rules"
                onClick={() => {
                  setHelp(!help);
                  setPanel(false);
                  setBuyPanel(false);
                }}
              >
                <img src="/kilo-night-v3/icon-info.png" alt="" />
              </button>
            </div>
            <div className="kk-spin-area">
              <button
                type="button"
                className={`kk-spin${control.purchase ? " is-purchase" : ""}${busy ? " is-busy" : ""}`}
                data-testid="spin-button"
                disabled={
                  summary != null ||
                  !ready ||
                  (!busy && (afford || !splashStakeOk(stake, mode)))
                }
                onClick={() => {
                  if (summary) return;
                  if (busy) skip();
                  else void play();
                }}
              >
                {control.label}
              </button>
              <span data-testid="charge-note">
                {summary
                  ? "SUMMARY · NO CHARGE"
                  : busy
                    ? reviewing
                      ? "REPLAY · NO CHARGE"
                      : hud?.active
                        ? "FEATURE IN PROGRESS"
                        : "ROUND IN PROGRESS"
                    : `CHARGE ${money(cost)} LGC`}
              </span>
            </div>
          </aside>
          <footer
            className="kk-strip"
            data-testid="control-bar"
            data-collection-phase={collection?.phase ?? "idle"}
          >
            <div className="kk-read kk-balance" data-readout="balance">
              <span className="kk-eyebrow">BALANCE</span>
              <strong data-testid="balance">{money(bank)}</strong>
            </div>
            <div className="kk-read kk-bet-read" data-readout="bet">
              <span className="kk-eyebrow">BET</span>
              <strong data-testid="bet-readout">{money(stake)}</strong>
            </div>
            <div className="kk-read kk-last-win" data-readout="last">
              <span className="kk-eyebrow">
                {!hud?.active && settled ? "LAST WIN" : "WIN"}
              </span>
              <strong data-testid="last-win">{money(win)}</strong>
            </div>
            <div
              className={`kk-read kk-bonus-win${awardLanded ? " is-landed" : ""}`}
              data-readout="bonus"
            >
              <span className="kk-eyebrow">BONUS WIN</span>
              <strong data-testid="bonus-win">
                {money(hud?.bonusWin ?? 0)}
              </strong>
              {hud && hud.triggerWin > 0 ? (
                <span className="kk-trigger">
                  Trigger {money(hud.triggerWin)}
                </span>
              ) : null}
            </div>
            <div className="kk-read kk-this-spin" data-readout="spin">
              <span className="kk-eyebrow">THIS SPIN</span>
              <strong data-testid="spin-win">
                {money((hud?.spinLine ?? 0) + (hud?.spinCollect ?? 0))}
              </strong>
            </div>
            <div className="kk-read kk-total kk-read-secondary" data-readout="total">
              <span className="kk-eyebrow">ROUND</span>
              <strong data-testid="round-total">
                {money(hud?.total ?? win)}
              </strong>
            </div>
            {afford ? (
              <p className="kk-afford" role="status">
                Insufficient local balance for this charge.
              </p>
            ) : null}
          </footer>
        </div>
        {note && !reviewing ? (
          <p role="status" className="kk-notice">
            {note}
          </p>
        ) : null}
        {help ? (
          <Dialog
            label="Game rules"
            className="kk-dialog kk-rules"
            onClose={() => setHelp(false)}
          >
            <div className="kk-dialog-head">
              <strong>How to play</strong>
              <button type="button" aria-label="Close" onClick={() => setHelp(false)}>
                Close
              </button>
            </div>
            <div className="kk-dialog-body">
              <h2>Catch. Collect. Climb.</h2>
              <h2>Symbol guide</h2>
              <p>
                {SCATTER_IS_KING
                  ? "KING emblem. The crown with no cash amount. It is the only scatter."
                  : "Scatter. The wrapped package marked KILO and SCATTER. It shows no cash amount. It is the only scatter."}{" "}
                One reel counts once. Three, four or five scatter reels award
                10, 15 or 20 free spins. Exactly two scatter reels lock for one
                respin. Cash packages always show a cash amount and are not
                scatters. The fisherman is the collector. It is not a scatter.
              </p>
              <p>
                Cash packages can form winning lines. The amounts shown on
                packages are collected only when a fisherman lands during free
                spins. Every fisherman collects every package at the multiplier
                already reached.
              </p>
              <p>
                Three, four or five scatters award 10, 15 or 20 free spins.
                Exactly two scatter reels lock for one respin. The +2 spins
                modifier adds two to the initial award and each retrigger.
                A purchased feature is already guaranteed: it shows the scatters
                and does not pay a scatter award.
              </p>
              <p>
                After each collection, fishermen advance the meter. Crossing 4,
                8 and 12 collectors awards extra spins and unlocks ×2, ×3 and
                ×10 for the next spin. No further retriggers at ×10.
              </p>
              <p>
                Ante costs 1.5× the base bet. Buy costs 100×. Chopper costs 250×
                and starts at ×2, or ×3 with the higher-start modifier.
                Purchases have no trigger scatter or base line award.
              </p>
              <p>
                Tools can rescue a mismatch: the hook shifts one recorded reel
                and brings in the fisherman, not a package. Dynamite adds
                packages. The bazooka refills around fishermen. Modifiers are
                drawn once per feature.
              </p>
              <p>
                Maximum round payout: the lower of 5,000× the base bet and
                5,000,000 LGC. At this bet: {money(cap)} LGC.
              </p>
              <details>
                <summary>Round breakdown</summary>
                <p>
                  Lines: {money(hud?.line ?? 0)} · Package collections:{" "}
                  {money(hud?.collect ?? 0)} · Scatter:{" "}
                  {money(hud?.scatter ?? 0)}. These are cumulative round
                  figures.
                </p>
              </details>
              <p className="kk-muted">
                This preview uses a local test balance. No live wallet is
                connected.
              </p>
            </div>
          </Dialog>
        ) : null}
        {buyPanel ? (
          <Dialog
            label="Feature selection"
            className="kk-dialog kk-purchases"
            onClose={() => setBuyPanel(false)}
          >
            <div className="kk-dialog-head">
              <strong>BUY FEATURE</strong>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setBuyPanel(false)}
              >
                Close
              </button>
            </div>
            <div className="kk-dialog-body">
              <p className="kk-buy-stake">
                Base bet <b>{money(stake)}</b>
              </p>
              <div className="kk-purchase-grid">
                {(["buy", "chopper"] as const).map((m) => {
                  const ok = splashStakeOk(stake, m);
                  const cost = splashCost(stake, m);
                  const blocked = ok
                    ? null
                    : cost > 1_000_000
                      ? "Above the 1,000,000 purchase limit"
                      : "Outside the stake rules";
                  return (
                    <button
                      className={`kk-purchase ${mode === m ? "selected" : ""}`}
                      key={m}
                      type="button"
                      aria-pressed={mode === m}
                      disabled={busy || !ok}
                      onClick={() => {
                        setMode(m);
                        setBuyPanel(false);
                      }}
                    >
                      <span className="kk3-feature-card-content">
                        <span className="kk-purchase-art">
                          <img
                            src={
                              m === "buy"
                                ? "/kilo-contraband-v1/feature-stash.png"
                                : "/kilo-contraband-v1/feature-chopper.png"
                            }
                            alt=""
                          />
                        </span>
                        <span className="kk-purchase-copy">
                          <strong>{m === "buy" ? "Free spins" : "Chopper"}</strong>
                          <span className="kk-purchase-detail">
                            {m === "buy"
                              ? "10 spins. Collect every package."
                              : "10 spins. Starts at ×2."}
                          </span>
                          <span className="kk-purchase-price">
                            <span className="kk-price-label">Cost</span>
                            <b>{money(cost)}</b>
                            <span>{m === "buy" ? "100× bet" : "250× bet"}</span>
                          </span>
                          {blocked ? (
                            <span className="kk-purchase-block">{blocked}</span>
                          ) : (
                            <span className="kk-card-action">
                              {mode === m ? "Selected" : "Select"}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="kk-muted">
                Round cap {money(cap)}. The main button confirms the charge.
              </p>
              <button
                type="button"
                className="kk-text-action kk-back-spins"
                onClick={() => {
                  setMode("spin");
                  setBuyPanel(false);
                }}
              >
                Back to spins
              </button>
            </div>
          </Dialog>
        ) : null}
        {summary ? (
          <Dialog
            label="Feature summary"
            testId="feature-summary"
            className={`kk-dialog kk-summary ${summary.celebrate ? "is-profit" : "is-neutral"}`}
            onClose={continueFeature}
          >
            <div className="kk-dialog-body kk-summary-body">
              <p className="kk-eyebrow">Feature complete</p>
              <p className="kk-summary-line">
                Returned:{" "}
                <strong data-testid="summary-return">
                  {money(summary.payout)}
                </strong>
              </p>
              {summary.purchaseCost != null ? (
                <p data-testid="summary-cost">
                  Feature cost: {money(summary.purchaseCost)}
                </p>
              ) : (
                <p>Triggered from the spin.</p>
              )}
              <button
                type="button"
                data-testid="continue-feature"
                onClick={continueFeature}
              >
                Continue
              </button>
            </div>
          </Dialog>
        ) : null}
        {panel ? (
          <Dialog
            label="Review scenes"
            className="kk-dialog kk-review"
            block={false}
            onClose={() => setPanel(false)}
          >
            <div className="kk-dialog-head">
              <strong>Review scenes</strong>
              <button type="button" aria-label="Close" onClick={() => setPanel(false)}>
                Close
              </button>
            </div>
            <div className="kk-dialog-body">
              <p className="kk-muted">
                Saved engine rounds. Replays do not change the local balance.
                Event previews jump to one recorded moment and do not settle.
              </p>
              <div className="mb-3 flex flex-col gap-2">
                <a
                  href={SOURCE_ZIP}
                  download={SOURCE_NAME}
                  data-source="1"
                  className="kk-source-link"
                  onClick={() =>
                    setSourceNote("Download started. Check your browser downloads.")
                  }
                >
                  Download source
                </a>
                {sourceNote ? <p className="kk-muted">{sourceNote}</p> : null}
                <button
                  type="button"
                  data-testid="review-two-collectors"
                  disabled={busy || !ready || !PAIR}
                  className="min-h-11 w-full rounded-lg bg-white/10 px-2 text-left disabled:opacity-40"
                  onClick={() => void playPair()}
                >
                  Two collectors — 48,000
                </button>
                <button
                  type="button"
                  data-review-round="hook-upgrade"
                  disabled={busy || !ready}
                  className="min-h-11 w-full rounded-lg bg-white/10 px-2 text-left disabled:opacity-40"
                  onClick={() => {
                    const fixture = ALL.find((item) => item.id === "hook-upgrade");
                    if (fixture) pick(fixture);
                  }}
                >
                  Hook upgrade — full round
                </button>
                <button
                  type="button"
                  data-review-round="tool-bazooka"
                  disabled={busy || !ready}
                  className="min-h-11 w-full rounded-lg bg-white/10 px-2 text-left disabled:opacity-40"
                  onClick={() => {
                    const fixture = ALL.find((item) => item.id === "tool-bazooka");
                    if (fixture) pick(fixture);
                  }}
                >
                  Bazooka — full round
                </button>
                <button
                  type="button"
                  data-testid="symbol-compare-open"
                  disabled={!ready}
                  className="min-h-11 w-full rounded-lg bg-white/10 px-2 text-left disabled:opacity-40"
                  onClick={openSymbolCompare}
                >
                  Symbol comparison
                </button>
              </div>
              {symbolReport ? (
                <div className="kk-symbol-compare" data-testid="symbol-compare">
                  <p className="kk-muted">
                    Same renderer as the reels. Idle and the largest 420ms package
                    pulse. Nothing is bet or settled.
                  </p>
                  <div ref={compareSlot} />
                  <pre data-testid="symbol-report">
                    {JSON.stringify(symbolReport).replaceAll("brick", "package")}
                  </pre>
                </div>
              ) : null}
              {GROUPS.map((group) => {
                const fixture = ALL.find((item) => item.id === group.id);
                if (!fixture) return null;
                return (
                  <div key={group.id} className="mb-3">
                    <button
                      type="button"
                      disabled={busy || !ready}
                      className="min-h-11 w-full rounded-lg bg-white/10 px-2 text-left disabled:opacity-40"
                      onClick={() => pick(fixture)}
                    >
                      {group.title}
                    </button>
                    {group.aliases.length ? (
                      <p className="kk-muted">
                        Same recorded round as{" "}
                        {group.aliases.map((alias) => alias.title).join(", ")}.
                        Not separate coverage.
                      </p>
                    ) : null}
                    {group.previews.length ? (
                      <div className="mt-1 flex flex-col gap-1">
                        {group.previews.map((preview) => (
                          <button
                            key={preview.kind}
                            type="button"
                            data-preview={preview.kind}
                            disabled={busy || !ready}
                            className="min-h-11 rounded-lg bg-white/5 px-2 text-left text-sm disabled:opacity-40"
                            onClick={() => void playPreview(fixture, preview)}
                          >
                            {preview.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              <p>{note}</p>
              <button
                type="button"
                className="kk-reset"
                disabled={busy}
                onClick={() => {
                  resetBank();
                  setBank(readBank());
                  setWin(0);
                  setHud(null);
                  setReviewing(false);
                  setSummary(null);
                  setSettled(false);
                }}
              >
                Reset local bank to {money(SANDBOX_START)}
              </button>
            </div>
          </Dialog>
        ) : null}
      </main>
    </div>
  );
}

function Dialog({
  label,
  className,
  testId,
  block = true,
  onClose,
  children,
}: {
  label: string;
  className: string;
  testId?: string;
  block?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const previousRef = useRef<HTMLElement | null>(null);
  closeRef.current = onClose;
  if (!previousRef.current && typeof document !== "undefined") {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body)
      previousRef.current = active;
  }
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const nodes = () =>
      [
        ...root.querySelectorAll<HTMLElement>(
          "button, select, a[href], summary",
        ),
      ].filter((node) => !node.hasAttribute("disabled"));
    nodes()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (!block || event.key !== "Tab") return;
      const list = nodes();
      if (!list.length) return;
      const first = list[0]!;
      const last = list[list.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const previous = previousRef.current;
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [block]);
  return (
    <div className={`kk-modal-root ${block ? "is-blocking" : "is-clear"}`}>
      {block ? (
        <div className="kk-scrim" onClick={() => closeRef.current()} />
      ) : null}
      <div
        ref={ref}
        role="dialog"
        aria-modal={block}
        aria-label={label}
        className={className}
        data-testid={testId}
      >
        {children}
      </div>
    </div>
  );
}
