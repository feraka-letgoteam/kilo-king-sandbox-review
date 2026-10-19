import { FeatureProgress } from './FeatureProgress';
import { DocksideHeader } from './DocksideHeader';
import { ScenePresence } from './ScenePresence';
import { GameBrand } from './GameBrand';
import { KILO_BRAND } from './brand-layout';
import { ReelFeatureCompletion } from './ReelFeatureCompletion';
import { canActivateMax, isMaxSpinRound } from './max-spin-mode';
import './max-spin-mode.css';
import { FEATURE_NAMES } from '@/lib/kilo/feature-math';
import './feature-effects.css';
import { MATERIAL_STYLE } from "./material";
import "./material.css";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  playSplash,
  isPurchaseMode,
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
import {
  muted,
  preloadAudio,
  primeAudio,
  setMuted,
  uiTap,
  audioReady,
  audioVolumes,
  setAudioVolumes,
} from "@/lib/kilo/sound";
import {
  presentScript,
  presentEventPreview,
  presentSettledCollection,
  findPairCollection,
  featureSummary,
  finalHud,
  faceFor,
  groupRounds,
  PREVIEW_BANNER,
  type FeatureHud,
  type EventPreview,
  type SymbolCompareResult,
} from "./director";
import { ReelStage, type MountedScene } from "./ReelStage";
import { routineCharacterPose, earnedCharacterCelebration } from './character-performance';
import { IntegratedScene, preloadIntegratedBase, preloadIntegratedScene } from "./IntegratedScene";
import { environmentForPresentation, isFeatureEnvironment } from './feature-environments';
import "./integrated-composition.css";
import {
  LoadingScreen,
  CompletionScreenContent,
  preloadSceneScreenArtwork,
} from "./SceneScreens";
import { BonusEntryScene } from "./BonusEntryScene";
import {
  SCENES,
  SCENE_PORTRAIT_MEDIA,
  sceneForRound,
  phaseForPresentation,
  type SceneId,
} from "./scene-system";
import { fitGameLayout } from "./layout";
import { SlotControls } from "../slot-controls/SlotControls";
import { createControlLayout } from "../slot-controls/layout";
import { FeatureTakeover } from "./feature-takeover";
import {
  controlAvailability,
  type ControlJurisdiction,
} from "../slot-controls/tokens";
import { KILO_CONTROL_THEME } from "./control-theme";
import "./modular-controls.css";
import { FeatureMark, StageSurround } from "./StageSurround";
import { acceptsSpinShortcut } from "./keyboard";
import { createAutoSpins } from "./auto-spins";
import { AutoSpinsPanel, QuickSettings } from "./control-overlays";
import fixtures from "@/lib/kilo/fixtures.json";

import {
  BetPanel,
  SettingsPanel,
  PanelHeader,
  PanelDismissContext,
  preloadFeatureArtwork,
} from "./control-panels";
import {
  STAKES,
  readPreferences,
  savePreferences,
  resolveMotion,
  type GamePreferences,
} from "./control-model";
import { InfoPanel } from "./info-panel";
const SOURCE_URL =
  "https://github.com/feraka-letgoteam/kilo-king-sandbox-review/tree/codex/presentation-rebuild";

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

/** Presentation roll. Snaps to zero and when motion is off so readouts still settle on the real figure. */
function useRoll(
  value: number,
  motion: boolean,
  turbo: boolean,
  maxDuration = 860,
) {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  useEffect(() => {
    const from = shownRef.current;
    if (!motion || from === value || value === 0) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    const delta = Math.abs(value - from);
    const ms =
      Math.min(maxDuration, delta >= 20000 ? 860 : 480) * (turbo ? 0.45 : 1);
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const u = Math.min(1, (now - t0) / ms);
      const eased = 1 - (1 - u) ** 2;
      const next = Math.round(from + (value - from) * eased);
      shownRef.current = next;
      setShown(next);
      if (u < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, motion, turbo, maxDuration]);
  return shown;
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
        <img src="/kilo-v79/characters/collector-idle.webp" alt="" />
      ) : (
        <img src="/kilo-v79/characters/collector-idle.webp" alt="" />
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

export function KiloTable({
  review = false,
  jurisdiction = {},
}: {
  review?: boolean;
  jurisdiction?: ControlJurisdiction;
}) {
  const sceneRef = useRef<MountedScene | null>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement | null>(null);
  const [layout, setLayout] = useState(() => fitGameLayout(1100, 800));
  const [stageHeight, setStageHeight] = useState(800);
  const [stageWidth, setStageWidth] = useState(1100);
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setStageHeight(entry.contentRect.height);
      setStageWidth(entry.contentRect.width);
      const next = fitGameLayout(
        entry.contentRect.width,
        entry.contentRect.height,
      );
      setLayout((previous) =>
        previous.width === next.width &&
        previous.height === next.height &&
        previous.mode === next.mode &&
        previous.artLeft === next.artLeft &&
        previous.artRight === next.artRight &&
        previous.header === next.header
          ? previous
          : next,
      );
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);
  const [collection, setCollection] = useState<CollectionDisplay>(null);
  const [awardLanded, setAwardLanded] = useState(false);
  const [capNotice, setCapNotice] = useState(false);
  const [systemMotion, setSystemMotion] = useState(false);
  const [preferences, setPreferences] =
    useState<GamePreferences>(readPreferences);
  const reducedMotion = resolveMotion(preferences.motion, systemMotion);
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;
  const effectiveSpeed = jurisdiction.disabledTurbo
    ? "normal"
    : preferences.speed;
  const turbo = effectiveSpeed !== "normal";
  const [ready, setReady] = useState(false);
  const [booted, setBooted] = useState(review);
  const [bootArt, setBootArt] = useState(0);
  const [bootError, setBootError] = useState("");
  const [bootTry, setBootTry] = useState(0);
  const [bank, setBank] = useState(SANDBOX_START);
  const [autoLeft, setAutoLeft] = useState(0);
  const [autoPanel, setAutoPanel] = useState(false);
  const spinButton = useRef<HTMLButtonElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [autoCount, setAutoCount] = useState<number>(10);
  const autoRunner = useRef<ReturnType<typeof createAutoSpins> | null>(null);
  if (!autoRunner.current) autoRunner.current = createAutoSpins(setAutoLeft);
  useEffect(() => {
    const stopHidden = () => {
      if (document.hidden) autoRunner.current?.stop();
    };
    document.addEventListener("visibilitychange", stopHidden);
    return () => {
      document.removeEventListener("visibilitychange", stopHidden);
      autoRunner.current?.stop();
    };
  }, []);
  const [stake, setStake] = useState(1000);
  const [mode, setMode] = useState<SplashMode>("spin");
  const [busy, setBusy] = useState(false);
  const [mute, setMute] = useState(false);
  const [win, setWin] = useState(0);
  const [sourceNote, setSourceNote] = useState("");
  const [panel, setPanel] = useState(review);
  const [help, setHelp] = useState(false);
  const [buyPanel, setBuyPanel] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [betPanel, setBetPanel] = useState(false);
  const [betReturn, setBetReturn] = useState<"game" | "features">("game");
  const [audioAvailable, setAudioAvailable] = useState(false);
  const [volumes, setVolumes] = useState(audioVolumes);
  function changePreferences(next: GamePreferences) {
    if (busyRef.current) return;
    const allowed = jurisdiction.disabledTurbo
      ? { ...next, speed: "normal" as const }
      : next;
    setPreferences(allowed);
    savePreferences(allowed);
  }
  function closeBet() {
    setBetPanel(false);
    if (betReturn === "features") setBuyPanel(true);
  }
  const [summary, setSummary] = useState<null | {
    payout: number;
    purchaseCost: number | null;
    celebrate: boolean;
  }>(null);
  const [reviewing, setReviewing] = useState(false);
  const busyRef = useRef(false);
  const [note, setNote] = useState("");
  const [previewNote, setPreviewNote] = useState("");
  const [symbolReport, setSymbolReport] = useState<SymbolCompareResult | null>(
    null,
  );
  const compareSlot = useRef<HTMLDivElement>(null);
  const compareCanvas = useRef<HTMLCanvasElement | null>(null);
  const [storageFault, setStorageFault] = useState("");
  const previewingRef = useRef(false);
  const previewGrid = useRef<SplashCell[][] | null>(null);
  const [hud, setHud] = useState<FeatureHud | null>(null);
  const rollMotion = !reducedMotion;
  // The active presentation drives WIN; the settled value remains the saved result.
  const shownWin = useRoll(
    busy && hud ? hud.total : win,
    rollMotion,
    turbo,
    260,
  );
  const shownBonus = useRoll(
    hud?.bonusWin ?? 0,
    rollMotion,
    turbo,
    hud?.note.startsWith("Line win") ? 260 : 860,
  );
  const [fisher, setFisher] = useState<{ pose: FisherPose; tick: number }>({
    pose: "idle",
    tick: 0,
  });
  const [round, setRound] = useState<SplashScript | null>(null);
  const characterRound = useRef<SplashScript | null>(null);
  const characterCelebrated = useRef(false);
  // Separate visual identity also covers read-only review scenes; never bank state.
  const [presentationRound, setPresentationRound] =
    useState<SplashScript | null>(null);
  const visualRound = presentationRound ?? round;
  const maxSpinMode = mode === 'getaway';
  const reelFeature = (visualRound?.version === 4 && (!!hud?.active || !!summary || (isMaxSpinRound(visualRound) && (busy || reviewing)))) || maxSpinMode;
  const environmentPhase = phaseForPresentation({
    booted,
    summary,
    hud,
    round: visualRound,
  });
  const environmentId: SceneId = environmentForPresentation({ round: visualRound, maxSpinMode,
    active: !!hud?.active, summary: !!summary, busy, reviewing });
  const featureBackground = isFeatureEnvironment(environmentId) && environmentId !== 'max-win' ? environmentId : undefined;
  const skipRef = useRef(false);
  const creditRef = useRef<string | null>(null);
  const onReady = useCallback((scene: MountedScene) => {
    sceneRef.current = scene;
    setReady(true);
  }, []);

  useEffect(() => {
    void preloadAudio().then(() => setAudioAvailable(audioReady()));
    // Decode the small feature catalogue during entry, before its first open.
    void preloadFeatureArtwork();
  }, []);

  useLayoutEffect(() => {
    if (review) return;
    const media = window.matchMedia(SCENE_PORTRAIT_MEDIA);
    let request = 0;
    const load = () => {
      const current = ++request;
      setBootError("");
      setBootArt(0);
      // Both visible arrival and destination plates decode before Enter unlocks.
      // Decorations are optional; a failed essential plate exposes Retry.
      void Promise.all([
        preloadIntegratedScene("loading", {
          portrait: media.matches,
        }),
        preloadIntegratedBase(media.matches),
        preloadSceneScreenArtwork(),
      ]).then(
        () => {
          if (current === request) setBootArt(1);
        },
        () => {
          if (current === request)
            setBootError("Couldn't load the harbour artwork.");
        },
      );
    };
    load();
    media.addEventListener("change", load);
    return () => {
      request += 1;
      media.removeEventListener("change", load);
    };
  }, [review, bootTry]);

  useEffect(() => {
    if (!booted) return;
    let cancelled = false;
    // Decode dedicated destinations before entry. The base actor/camera stays
    // mounted while a feature background is shown behind it.
    const timer = window.setTimeout(() => {
      void (async () => {
        for (const id of [
          "scatter-3",
          "scatter-4",
          "max-win",
          "completion",
        ] as const) {
          if (cancelled) break;
          try {
            await preloadIntegratedScene(id, {
              portrait: window.matchMedia(SCENE_PORTRAIT_MEDIA).matches,
            });
          } catch {
            /* Current scene stays visible. */
          }
        }
      })();
    }, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [booted]);

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
    scene.show(script.free.at(-1)?.mechanic?.reel?.finalGrid ?? script.free.at(-1)?.grid ?? script.base.grid);
    scene.setCopy(`Last result · ${money(script.payout)}`);
    scene.setMood("idle");
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
      const pose=routineCharacterPose(mood);
      if(pose!==null)setFisher((prev) => ({ pose, tick: prev.tick + 1 }));
    };
    const onEarnedWin=(event:Event)=>{
      const visible=(event as CustomEvent<{visibleAward:number}>).detail?.visibleAward;
      const script=characterRound.current;
      if(!script||!earnedCharacterCelebration(Math.min(visible,script.payout),script.stake,script.cost,characterCelebrated.current,skipRef.current))return;
      characterCelebrated.current=true;
      setFisher(prev=>({pose:'cheer',tick:prev.tick+1}));
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
    root?.addEventListener("kilo-earned-win", onEarnedWin);
    root?.addEventListener("kilo-collection", onCollection);
    return () => {
      window.clearTimeout(landTimer);
      root?.removeEventListener("kilo-mood", onMood);
      root?.removeEventListener("kilo-earned-win", onEarnedWin);
      root?.removeEventListener("kilo-collection", onCollection);
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setSystemMotion(media.matches);
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
    return reducedRef.current;
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
      setPresentationRound(fixture.script);
      void preloadIntegratedScene(sceneForRound(fixture.script), {
        portrait: layout.mode === "portrait",
      }).catch(() => {});
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
    characterRound.current=script;
    characterCelebrated.current=false;
    setReviewing(reviewMode);
    setPreviewNote("");
    setStorageFault("");
    previewingRef.current = false;
    previewGrid.current = null;
    setPanel(false);
    skipRef.current = false;
    setBusy(true);
    setRound(script);
    setPresentationRound(script);
    const sceneReady = preloadIntegratedScene(isMaxSpinRound(script) ? 'max-win' : sceneForRound(script), {
      portrait: layout.mode === "portrait",
    });
    setWin(0);
    let presentationCompleted = true;
    try {
      await sceneReady;
      await presentScript(scene, script, {
        turbo,
        speed: effectiveSpeed,
        reduced: reduced(),
        skipped: () => skipRef.current,
        onHud: (next) => setHud(next),
      });
    } catch (error) {
      presentationCompleted = false;
      console.error("Kilo presentation failed", error);
      const end = finalHud(script);
      try {
        scene.show(script.free.at(-1)?.mechanic?.reel?.finalGrid ?? script.free.at(-1)?.grid ?? script.base.grid);
        scene.setFeatureState?.(script.free.at(-1)?.mechanic??null,'after');
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
      if (isMaxSpinRound(script)) {
        // The saved result and credit path above are unchanged. Max has no
        // free-spin completion screen: the next explicit Spin buys one attempt.
        setSummary(null);
        setHud(current => current ? { ...current, active: false, left: null, phase: undefined } : current);
        if (!reviewMode) setMode('getaway');
      } else if (done.feature) {
        setMode("spin");
        setBuyPanel(false);
        setSettingsOpen(false);
        setBetPanel(false);
        setHelp(false);
        setSummary({
          payout: done.payout,
          purchaseCost: done.purchaseCost,
          celebrate: done.celebrate,
        });
      }
    }
    return presentationCompleted;
  }

  function continueFeature() {
    const returned = summary?.payout ?? win;
    setSummary(null);
    setMode("spin");
    setBuyPanel(false);
    setWin(returned);
    const scene = sceneRef.current;
    scene?.setMood("idle");
    scene?.setLocks([]);
    scene?.setFeatureState?.(null);
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

  function selectMaxMode(active: boolean) {
    if (busyRef.current || summary || autoRunner.current?.remaining) return;
    if (active && !canActivateMax(stake, readBank(), !ready, jurisdiction.disabledBuyFeature)) return;
    // No outcome is requested and no wallet operation occurs on activation.
    setMode(active ? 'getaway' : 'spin');
    if(active)void preloadIntegratedScene('max-win',{portrait:layout.mode==='portrait'}).catch(()=>{});
    setBuyPanel(false);
    setHud(null);
    sceneRef.current?.setFeatureState?.(null);
    sceneRef.current?.setMood('idle');
    sceneRef.current?.finishPlate(active ? 'Max spins · 25,000× or nothing' : 'Place a bet');
  }

  async function play(playMode: SplashMode = mode) {
    if (busyRef.current || !sceneRef.current || !ready || summary) return;
    if (playMode === "chopper") {
      setNote("This retired feature is unavailable.");
      return;
    }
    if (
      (jurisdiction.disabledBuyFeature &&
        isPurchaseMode(playMode)) ||
      (jurisdiction.disabledAnte && playMode === "ante")
    ) {
      setNote("This action is unavailable in this jurisdiction.");
      return;
    }
    if (!splashStakeOk(stake, playMode)) {
      setNote("That charge is outside the stake rules.");
      return;
    }
    const cost = splashCost(stake, playMode);
    // Generate and validate the immutable outcome before committing the debit.
    const script = playSplash(stake, playMode, cryptoRng());
    const paid = settle(cost, 0);
    if (!paid.ok) {
      setNote(paid.reason);
      return;
    }
    setBank(readBank());
    setNote("");
    setSummary(null);
    rememberRound(
      JSON.stringify({ v: 2, script, credited: false } satisfies Saved),
    );
    creditRef.current = null;
    const completed = await run(script, false);
    return completed ? { feature: featureSummary(script).feature } : undefined;
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
    const last = round.free.at(-1)?.mechanic?.reel?.finalGrid ?? (round.free.length
      ? round.free[round.free.length - 1]!.grid
      : round.base.grid);
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
    setPresentationRound(fixture.script);
    void preloadIntegratedScene(sceneForRound(fixture.script), {
      portrait: layout.mode === "portrait",
    }).catch(() => {});
    setNote(`${fixture.title}. ${preview.label}. ${PREVIEW_BANNER}`);
    try {
      await presentEventPreview(scene, fixture.script, preview, {
        turbo,
        speed: effectiveSpeed,
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
    setPresentationRound(fixture.script);
    void preloadIntegratedScene(sceneForRound(fixture.script), {
      portrait: layout.mode === "portrait",
    }).catch(() => {});
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
      setNote(
        "Collection review interrupted. The recorded board was restored.",
      );
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
  const cap = splashRoundCap(stake, mode);
  const afford = !busy && cost > bank;
  const resetBalanceDisabled =
    busy || !!hud?.active || !!summary || autoLeft > 0;
  function resetPreviewBalance() {
    // Local sandbox only. Never interrupt presentation or a scheduled auto spin.
    if (
      busyRef.current ||
      resetBalanceDisabled ||
      autoRunner.current?.remaining
    )
      return;
    resetBank();
    setBank(readBank());
    setWin(0);
    setHud(null);
    setRound(null);
    setPresentationRound(null);
    setReviewing(false);
    setCapNotice(false);
    setSettingsOpen(false);
  }

  function pick(fixture: Fixture) {
    setNote(`${fixture.title}. Seed ${fixture.seed}. ${fixture.note}`);
    void run(fixture.script, true);
  }

  async function playReelReview(name: string) {
    if (busyRef.current || !sceneRef.current || !ready) return;
    try {
      const response = await fetch(`/kilo-features-v54/replays/${name}.json`);
      if (!response.ok) throw new Error("Replay file unavailable");
      const script = await response.json() as SplashScript;
      if (script.version !== 4 || !script.free.every(spin => spin.mechanic?.reel)) throw new Error("Invalid reel-feature record");
      if (busyRef.current) return;
      setSummary(null);
      setMode('spin');
      setNote("Recorded feature · v61 VS presentation. No balance changes.");
      await run(script, true);
    } catch (error) {
      console.error("Kilo reel review failed", error);
      setNote("The recorded feature could not be opened. No balance was changed.");
    }
  }
  const caption = hud?.active
    ? ""
    : busy
      ? "SPINNING"
      : mode === "ante"
        ? "ANTE ON"
        : maxSpinMode ? "MAX SPINS" : "PLACE A BET";
  const modalOpen =
    help ||
    buyPanel ||
    betPanel ||
    settingsOpen ||
    preferencesOpen ||
    autoPanel ||
    summary != null;
  useEffect(() => {
    const onSpace = (event: KeyboardEvent) => {
      const target = event.target;
      const interactive =
        target instanceof Element &&
        !!target.closest(
          "button, input, textarea, select, a, summary, [contenteditable], [role=button]",
        );
      const blocked =
        !booted || !ready || modalOpen || panel || document.hidden;
      if (event.code === "Space" && !blocked && !interactive)
        event.preventDefault();
      if (!acceptsSpinShortcut(event, blocked, interactive)) return;
      // Reuse the same disabled state, purchase flow and Skip/Stop handler.
      spinButton.current?.click();
    };
    document.addEventListener("keydown", onSpace);
    return () => document.removeEventListener("keydown", onSpace);
  }, [booted, ready, modalOpen, panel]);
  useEffect(() => {
    if (
      help ||
      buyPanel ||
      betPanel ||
      settingsOpen ||
      preferencesOpen ||
      summary ||
      panel ||
      hud?.active
    )
      autoRunner.current?.stop();
  }, [
    help,
    buyPanel,
    betPanel,
    settingsOpen,
    preferencesOpen,
    summary,
    panel,
    hud?.active,
  ]);
  const controlsLocked =
    busy || summary != null || !!hud?.active || autoLeft > 0;
  const dock = createControlLayout({
    variant: layout.compact
      ? "compact"
      : layout.mode === "portrait"
        ? "portrait"
        : layout.mode === "landscape"
          ? "landscape"
          : "desktop",
    width:
      layout.mode === "landscape"
        ? layout.width
        : layout.mode === "portrait"
          ? layout.reelWidth
          : layout.artLeft
            ? stageWidth
            : layout.width,
    height:
      layout.mode === "wide" &&
      layout.width >= 1100 &&
      layout.height + 60 <= stageHeight
        ? 128
        : layout.dock,
    footerWidth: layout.reelWidth,
  });
  const autoPolicy = controlAvailability("auto", jurisdiction);
  const antePolicy = controlAvailability("ante", jurisdiction);
  useEffect(() => {
    if (jurisdiction.disabledAutoplay) {
      autoRunner.current?.stop();
      setAutoPanel(false);
    }
    if (jurisdiction.disabledBuyFeature) setBuyPanel(false);
    if (jurisdiction.disabledAnte && !busy && mode === "ante") setMode("spin");
    if (jurisdiction.disabledBuyFeature && !busy && mode === 'getaway') setMode('spin');
  }, [
    jurisdiction.disabledAutoplay,
    jurisdiction.disabledBuyFeature,
    jurisdiction.disabledAnte,
    busy,
    mode,
  ]);

  return (
    <div
      className="kk-app"
      data-material="marina"
      data-environment={environmentId}
      data-scene-phase={environmentPhase}
      style={MATERIAL_STYLE as CSSProperties}
      ref={appRef}
      data-reduced={reducedMotion ? "1" : "0"}
      data-review={review ? "true" : "false"}
    >
      {!booted && (
        <LoadingScreen
          key={bootTry}
          ready={ready}
          artReady={!!bootArt}
          error={bootError}
          onRetry={() => setBootTry((n) => n + 1)}
          onEnter={() => {
            primeAudio();
            void preloadAudio().then(() => setAudioAvailable(audioReady()));
            setBooted(true);
          }}
          reducedMotion={reducedMotion}
        />
      )}
      <header className="kk-dev" inert={modalOpen || !booted}>
        {previewNote ? (
          <p
            className="kk-preview-banner"
            role="status"
            data-testid="preview-banner"
          >
            {previewNote}
          </p>
        ) : null}
        <span className="kk-sandbox">{sourceNote || "REVIEW BUILD"}</span>
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
            href={SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-source="1"
            onClick={() => setSourceNote("Source branch opened in a new tab.")}
          >
            Source
          </a>
        </nav>
      </header>
      <main className="kk-stage" data-testid="game-stage" ref={stageRef}>
        {storageFault ? (
          <p
            className="kk-storage-fault"
            role="alert"
            data-testid="storage-fault"
          >
            {storageFault}
          </p>
        ) : null}
        <div
          className={`kk-shell ${hud?.active ? "is-feature" : ""} ${hud?.active && hud.bonusWin === hud.total ? "is-same-return" : ""}`}
          data-layout={layout.mode}
          data-reel-feature={reelFeature ? 'true' : undefined}
          data-feature-kind={maxSpinMode ? 'getaway' : reelFeature ? visualRound?.feature : undefined}
          data-framing={layout.artLeft ? "sides" : "header"}
          style={
            {
              "--game-width": `${layout.width}px`,
              "--game-height": `${layout.height + dock.height - layout.dock}px`,
              "--reel-width": `${layout.reelWidth}px`,
              "--reel-height": `${layout.reelHeight}px`,
              "--header-height": `${layout.header}px`,
              "--dock-height": `${dock.height}px`,
              "--strip-height": `${layout.strip}px`,
              "--side-width": `${layout.side}px`,
              "--control-left": `${layout.controlLeft}px`,
              "--art-left": `${layout.artLeft}px`,
              "--art-right": `${layout.artRight}px`,
              "--dock-gap": `${layout.dockGap}px`,
            } as CSSProperties
          }
          data-compact={layout.compact ? "true" : undefined}
          data-testid="game-hud"
          inert={modalOpen || !booted ? true : undefined}
        >
          <IntegratedScene
            key={bootTry}
            scene={featureBackground ? 'base' : environmentId}
            backgroundScene={featureBackground}
            layout={layout}
            stageSize={{ width: stageWidth, height: stageHeight }}
            characterPose={fisher.pose}
            characterTick={fisher.tick}
            phase={environmentPhase}
            reducedMotion={reducedMotion}
            paused={modalOpen || !booted || environmentPhase === "entry"}
            characterPaused={modalOpen || !booted}
            className={reelFeature ? 'kk-feature-quiet-environment' : ''}
          />
          <GameBrand layout={layout} feature={Boolean(hud?.active)} />
          <div className="kk-playfield">
            <div className="kk-crest">
              {maxSpinMode || ((busy || reviewing) && visualRound && isMaxSpinRound(visualRound)) ? (
                <div className="kk-max-mode" role="status">
                  <div><strong>MAX SPINS</strong><span>{money(cost)} / spin · 25,000× or nothing</span></div>
                  <button type="button" disabled={busy || autoLeft > 0} onClick={() => selectMaxMode(false)} aria-label="Exit Max spins">Exit <span aria-hidden="true">×</span></button>
                </div>
              ) : hud?.active && (!hud.mechanic || hud.mechanic.kind==='dock') ? (
                <DocksideHeader layout={layout} reduced={reducedMotion} state={{left:hud.left??0,mult:hud.mult,
                  filled:hud.filled,holding:!!hud.holding,maxed:!!hud.maxed,nextSpins:hud.nextSpins,nextMult:hud.nextMult,capped:capNotice}} />
              ) : hud?.active ? (
                <div
                  className={`kk-bonus${hud.holding ? " is-holding" : ""}${hud.maxed ? " is-max" : ""}${capNotice ? " is-capped" : ""}`}
                >
                  <img
                    className="kk-bonus-mark"
                    src={KILO_BRAND.wide}
                    alt="Kilo King"
                  />
                  <div className="kk-bonus-spins">
                    <img
                      className="kk-plate"
                      src="/kilo-v79/surfaces/banner.webp"
                      alt=""
                    />
                    <div className="kk-plate-copy">
                      <span className="kk-eyebrow">{hud.mechanic?.kind==='getaway' && visualRound?.version !== 4 ? 'Stages' : 'Spins'}</span>
                      <b data-testid="spins-left">{hud.left ?? 0}</b>
                    </div>
                  </div>
                  <div className="kk-bonus-track">
                    {hud.mechanic && hud.mechanic.kind!=='dock' ? <FeatureProgress event={hud.mechanic}/> : <div
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
                    </div>}
                  </div>
                  <div className="kk-bonus-pay">
                    <img
                      className="kk-plate"
                      src="/kilo-v79/surfaces/banner.webp"
                      alt=""
                    />
                    <div className="kk-plate-copy">
                      <span className="kk-eyebrow">Multiplier</span>
                      <b className="kk-mult">×{hud.mult}</b>
                    </div>
                  </div>
                  {capNotice ? (
                    <span className="kk-next kk-cap-note">Max win reached</span>
                  ) : hud.mechanic && hud.mechanic.kind!=='dock' ? <span className="kk-next">{hud.note}</span> : hud.maxed || hud.nextMult == null ? (
                    <span className="kk-next">Max level</span>
                  ) : (
                    <span className="kk-next">
                      Next +{hud.nextSpins} spins · ×{hud.nextMult}
                    </span>
                  )}
                </div>
              ) : (
                <>
                  <div className="kk-crest-status">
                    <p className="kk-event">{caption}</p>
                  </div>
                </>
              )}
            </div>
            <div className="kk-canvas-wrap" data-testid="reel-host">
              <ReelStage onReady={onReady} boatStage={environmentId === 'max-win'} />
              <StageSurround width={layout.reelWidth} height={layout.reelHeight} mode={layout.compact ? "mini" : layout.mode} />
            </div>
          </div>
          <div
            className="kk-modular-controls"
            data-control-system="v36"
            data-collection-phase={collection?.phase ?? "idle"}
            style={{ width: dock.width, height: dock.height }}
          >
            <SlotControls
              layout={dock}
              theme={KILO_CONTROL_THEME}
              icons={{ buy: <FeatureMark /> }}
              jurisdiction={maxSpinMode ? { ...jurisdiction, disabledAutoplay: true } : jurisdiction}
              spinRef={spinButton}
              menuRef={menuButton}
              menuPopupId="kilo-quick-settings"
              bonusAnchorClassName="kk-bonus-win"
              state={{
                balance: money(bank),
                win: money(hud?.active ? shownBonus : shownWin),
                bet: money(stake),
                wager: money(mode === "ante" || maxSpinMode ? cost : stake),
                currency: "LGC",
                ante: mode === "ante",
                speed: effectiveSpeed,
                menuOpen: settingsOpen,
                feature: hud?.active
                  ? { remaining: hud.left ?? 0, multiplier: hud.mult, label: hud.mechanic?.kind==='getaway' ? visualRound?.version === 4 ? 'Spin' : 'Stages' : 'Free spins' }
                  : undefined,
                busy,
                autoRemaining: autoLeft,
                ready,
                locked: controlsLocked,
                spinDisabled:
                  summary != null ||
                  !ready ||
                  (!busy && (afford || !splashStakeOk(stake, mode))),
                spinDisabledReason: !ready
                  ? "Loading"
                  : afford
                    ? "Insufficient balance"
                    : !busy && !splashStakeOk(stake, mode)
                      ? "Bet unavailable"
                      : undefined,
                minimumBet: stake === STAKES[0],
                maximumBet: stake === STAKES.at(-1),
                charge: busy
                  ? {
                      label: reviewing
                        ? "Replay"
                        : hud?.active
                          ? "Free spins"
                          : "Spinning",
                    }
                  : { amount: money(cost) },
                awardLanded,
                reducedMotion,
              }}
              actions={{
                menu: () => {
                  uiTap();
                  autoRunner.current?.stop();
                  setPanel(false);
                  setSettingsOpen((open) => !open);
                },
                turbo: () => {
                  uiTap();
                  changePreferences({
                    ...preferences,
                    speed:
                      effectiveSpeed === "normal"
                        ? "turbo"
                        : effectiveSpeed === "turbo"
                          ? "super"
                          : "normal",
                  });
                },
                bet: () => {
                  uiTap();
                  setPanel(false);
                  setBetReturn("game");
                  setBetPanel(true);
                },
                minus: () => {
                  if (!busyRef.current)
                    setStake(
                      STAKES[
                        Math.max(0, STAKES.findIndex((n) => n === stake) - 1)
                      ]!,
                    );
                },
                plus: () => {
                  if (!busyRef.current)
                    setStake(
                      STAKES[
                        Math.min(
                          STAKES.length - 1,
                          STAKES.findIndex((n) => n === stake) + 1,
                        )
                      ]!,
                    );
                },
                auto: () => {
                  if (jurisdiction.disabledAutoplay) return;
                  uiTap();
                  if (autoLeft) autoRunner.current?.stop();
                  else setAutoPanel(true);
                },
                spin: () => {
                  if (autoLeft) autoRunner.current?.stop();
                  else if (busy) skip();
                  else {
                    primeAudio();
                    void play();
                  }
                },
                buy: () => {
                  if (jurisdiction.disabledBuyFeature) return;
                  uiTap();
                  setPanel(false);
                  setBuyPanel(true);
                },
              }}
            />
          </div>
        </div>
        {note && !reviewing ? (
          <p role="status" className="kk-notice">
            {note}
          </p>
        ) : null}
        {help ? (
          <Dialog
            rootId="kilo-info-takeover"
            label="Game information"
            className="kk-dialog kk-info-panel"
            onClose={() => setHelp(false)}
          >
            <InfoPanel
              stake={stake}
              round={{
                line: hud?.line ?? 0,
                collect: hud?.collect ?? 0,
                scatter: hud?.scatter ?? 0,
              }}
              onClose={() => setHelp(false)}
              onSettings={() => {
                setHelp(false);
                setPreferencesOpen(true);
              }}
            />
          </Dialog>
        ) : null}
        {buyPanel &&
          (!jurisdiction.disabledBuyFeature || !antePolicy.hidden) && (
            <Dialog
              label="Features"
              className="kk-dialog kk-feature-takeover"
              rootId="kilo-features-takeover"
              onClose={() => setBuyPanel(false)}
            >
              <FeatureTakeover
                reducedMotion={reducedMotion}
                stake={stake}
                bank={bank}
                ante={mode === "ante"}
                anteRestriction={antePolicy}
                anteOnly={jurisdiction.disabledBuyFeature}
                locked={controlsLocked || !ready}
                onAnte={(on) => {
                  if (!busyRef.current && !jurisdiction.disabledAnte)
                    setMode(on ? "ante" : "spin");
                }}
                onStake={(next) => {
                  if (!busyRef.current && !controlsLocked) setStake(next);
                }}
                onEditBet={() => {
                  setBuyPanel(false);
                  setBetReturn("features");
                  setBetPanel(true);
                }}
                maxActive={maxSpinMode}
                onMaxMode={selectMaxMode}
                onBuy={(purchaseMode) => {
                  setMode('spin');
                  setBuyPanel(false);
                  if (!jurisdiction.disabledBuyFeature) void play(purchaseMode);
                }}
                onClose={() => setBuyPanel(false)}
              />
            </Dialog>
          )}
        {betPanel && (
          <Dialog
            label="Bet amount"
            className="kk-dialog kk-bet-dialog"
            onClose={closeBet}
          >
            <BetPanel
              stake={stake}
              ante={mode === "ante"}
              maxMode={maxSpinMode}
              onClose={closeBet}
              onApply={(next) => {
                if (!busyRef.current) setStake(next);
                closeBet();
              }}
            />
          </Dialog>
        )}
        {autoPanel && !jurisdiction.disabledAutoplay && (
          <Dialog
            label="Confirm auto spins"
            className="kk-dialog kk-auto-takeover"
            rootId="kilo-auto-takeover"
            onClose={() => setAutoPanel(false)}
          >
            <AutoSpinsPanel
              count={autoCount}
              cost={cost}
              onCount={setAutoCount}
              onClose={() => setAutoPanel(false)}
              disabled={
                controlsLocked ||
                !ready ||
                afford ||
                !splashStakeOk(stake, mode)
              }
              disabledReason={
                !ready
                  ? "Loading game"
                  : afford
                    ? "Insufficient balance"
                    : controlsLocked
                      ? "Available after this round"
                      : !splashStakeOk(stake, mode)
                        ? "Bet unavailable"
                        : undefined
              }
              onStart={() => {
                if (
                  busyRef.current ||
                  jurisdiction.disabledAutoplay ||
                  autoRunner.current?.remaining ||
                  (mode !== "spin" && mode !== "ante")
                )
                  return;
                primeAudio();
                const fixedMode = mode;
                if (autoRunner.current?.start(autoCount, () => play(fixedMode)))
                  setAutoPanel(false);
              }}
            />
          </Dialog>
        )}
        {settingsOpen && (
          <QuickSettings
            anchorRef={menuButton}
            anchorKey={`${dock.variant}:${dock.width}:${dock.height}:${!!hud?.active}`}
            audioAvailable={audioAvailable}
            musicVolume={mute ? 0 : volumes.music}
            effectsVolume={mute ? 0 : volumes.effects}
            onVolume={(music, effects) => {
              primeAudio();
              setVolumes({ music, effects });
              setAudioVolumes(music, effects);
              if (mute) {
                setMute(false);
                setMuted(false);
              }
            }}
            onInfo={() => {
              setSettingsOpen(false);
              setHelp(true);
            }}
            onClose={() => setSettingsOpen(false)}
            onResetBalance={resetPreviewBalance}
            resetBalanceDisabled={resetBalanceDisabled}
          />
        )}
        {preferencesOpen && (
          <Dialog
            label="Game settings"
            className="kk-dialog kk-settings"
            onClose={() => setPreferencesOpen(false)}
          >
            <SettingsPanel
              preferences={{ ...preferences, speed: effectiveSpeed }}
              disabledTurbo={jurisdiction.disabledTurbo}
              compactActions={
                <div className="kk-compact-actions">
                  {!hud?.active &&
                    (!jurisdiction.disabledBuyFeature ||
                      !antePolicy.hidden) && (
                      <button
                        type="button"
                        disabled={controlsLocked || !ready}
                        onClick={() => {
                          setPreferencesOpen(false);
                          setBuyPanel(true);
                        }}
                      >
                        Features
                      </button>
                    )}
                  {dock.drawer.auto && !hud?.active && !autoPolicy.hidden && (
                    <button
                      type="button"
                      disabled={controlsLocked || !ready || autoPolicy.disabled}
                      title={autoPolicy.reason}
                      onClick={() => {
                        if (autoPolicy.disabled) return;
                        setPreferencesOpen(false);
                        setAutoPanel(true);
                      }}
                    >
                      Auto spins
                    </button>
                  )}
                </div>
              }
              onChange={changePreferences}
              locked={busy}
              onRules={() => {
                setPreferencesOpen(false);
                setHelp(true);
              }}
              onClose={() => setPreferencesOpen(false)}
              onBack={() => {
                setPreferencesOpen(false);
                setHelp(true);
              }}
            />
          </Dialog>
        )}
        {summary && visualRound?.version === 4 ? <ReelFeatureCompletion
          name={FEATURE_NAMES[visualRound.feature!]} feature={visualRound.feature} payout={summary.payout} cost={summary.purchaseCost}
          reducedMotion={reducedMotion}
          maxed={visualRound.capped || (visualRound.feature === 'getaway' && summary.payout > 0)} onContinue={continueFeature}
        /> : summary ? (
          <Dialog
            label="Feature summary"
            testId="feature-summary"
            rootId="kilo-completion-takeover"
            className={`kk-dialog kk-summary ${summary.celebrate ? "is-profit" : "is-neutral"}`}
            onClose={continueFeature}
          >
            <CompletionScreenContent
              payout={summary.payout}
              purchaseCost={summary.purchaseCost}
              celebrate={summary.celebrate}
              bonusName={SCENES[sceneForRound(visualRound)].title}
              onContinue={continueFeature}
              reducedMotion={reducedMotion}
            />
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
              <strong>Review scenes · v57</strong>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setPanel(false)}
              >
                Close
              </button>
            </div>
            <div className="kk-dialog-body">
              <p className="kk-muted">
                Saved engine rounds. Replays do not change the local balance.
                Event previews jump to one recorded moment and do not settle.
              </p>
              <div className="mb-3 flex flex-col gap-2">
                {[
                  ["yacht-sticky-vs", "Yacht — pure VS, permanent multiplier reels"],
                  ["vs-complete-encounter-v61", "VS — ×3 duel and 25,000 connection (spin 9)"],
                  ["getaway-max", "Getaway — 25,000× result"],
                  ["getaway-loss", "Getaway — no win"],
                ].map(([name, title]) => (
                  <button key={name} type="button" data-review-v52={name}
                    disabled={busy || !ready}
                    className="min-h-11 w-full rounded-lg bg-white/10 px-2 text-left disabled:opacity-40"
                    onClick={() => void playReelReview(name!)}>{title}</button>
                ))}
                <a
                  href={SOURCE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-source="1"
                  className="kk-source-link"
                  onClick={() =>
                    setSourceNote("Source branch opened in a new tab.")
                  }
                >
                  View source branch
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
                    const fixture = ALL.find(
                      (item) => item.id === "hook-upgrade",
                    );
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
                    const fixture = ALL.find(
                      (item) => item.id === "tool-bazooka",
                    );
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
                    Same renderer as the reels. Idle and the largest 420ms
                    package pulse. Nothing is bet or settled.
                  </p>
                  <div ref={compareSlot} />
                  <pre data-testid="symbol-report">
                    {JSON.stringify(symbolReport).replaceAll(
                      "brick",
                      "package",
                    )}
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
                disabled={resetBalanceDisabled}
                onClick={resetPreviewBalance}
              >
                Reset local bank to {money(SANDBOX_START)}
              </button>
            </div>
          </Dialog>
        ) : null}
        <ScenePresence visible={environmentPhase === "entry" && !!visualRound && visualRound.version !== 4} reduced={reducedMotion || effectiveSpeed !== 'normal' || skipRef.current}>
          {visualRound && <BonusEntryScene
              scene={environmentId}
              round={visualRound}
              reducedMotion={reducedMotion}
              immediate={effectiveSpeed !== "normal" || skipRef.current}
            />}
        </ScenePresence>
        {environmentPhase === "entry" && visualRound && visualRound.version !== 4 && (
            <button
              type="button"
              className="kk-entry-skip"
              onClick={() => spinButton.current?.click()}
            >
              Skip intro
            </button>
        )}
      </main>
    </div>
  );
}

function Dialog({
  label,
  className,
  testId,
  rootId,
  block = true,
  onClose,
  children,
}: {
  label: string;
  className: string;
  testId?: string;
  rootId?: string;
  block?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const previousRef = useRef<HTMLElement | null>(null);
  const closeTimer = useRef<number | null>(null);
  const [closing, setClosing] = useState(false);
  closeRef.current = onClose;
  const requestClose = useCallback(() => {
    if (closeTimer.current !== null) return;
    if (ref.current?.closest('.kk-app[data-reduced="1"]')) {
      closeRef.current();
      return;
    }
    setClosing(true);
    closeTimer.current = window.setTimeout(() => closeRef.current(), 160);
  }, []);
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
          'button, input, select, a[href], summary, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter(
        (node) =>
          !node.matches(":disabled") &&
          !node.closest("[inert]") &&
          node.getClientRects().length > 0,
      );
    (nodes()[0] ?? root).focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }
      if (!block || event.key !== "Tab") return;
      if (closeTimer.current !== null) {
        event.preventDefault();
        return;
      }
      const list = nodes();
      if (!list.length) return;
      if (!root.contains(document.activeElement)) {
        event.preventDefault();
        list[0]?.focus();
        return;
      }
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
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
      const previous = previousRef.current;
      queueMicrotask(() => {
        if (
          document.querySelector(".kk-modal-root.is-blocking, .kk-quick-root")
        )
          return;
        const target =
          previous && document.contains(previous)
            ? previous
            : document.querySelector<HTMLElement>("[data-focus-fallback]");
        target?.focus();
      });
    };
  }, [block, requestClose]);
  return (
    <div
      id={rootId}
      className={`kk-modal-root ${block ? "is-blocking" : "is-clear"}${closing ? " is-closing" : ""}`}
    >
      {block ? <div className="kk-scrim" onClick={requestClose} /> : null}
      <div
        ref={ref}
        role="dialog"
        tabIndex={-1}
        aria-modal={block}
        aria-label={label}
        className={className}
        data-testid={testId}
        inert={closing ? true : undefined}
      >
        <PanelDismissContext.Provider value={requestClose}>
          {children}
        </PanelDismissContext.Provider>
      </div>
    </div>
  );
}

// One final paint layer; geometry and control allocation remain in their canonical modules.
import "./illustrated-surfaces.css";
import "./presentation-finish.css";
