const MUTE = "kilo-sandbox-mute";
const VOLUMES = "kilo-audio-volumes";

export function audioVolumes(): { music: number; effects: number } {
  try {
    const value = JSON.parse(localStorage.getItem(VOLUMES) || "null");
    return { music: volume(value?.music), effects: volume(value?.effects) };
  } catch { return { music: 70, effects: 70 }; }
}
function volume(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 70;
}
export function audioReady() { return loaded; }
export function setAudioVolumes(music: number, effects: number) {
  const next = { music: volume(music), effects: volume(effects) };
  try { localStorage.setItem(VOLUMES, JSON.stringify(next)); } catch { /* Session still works. */ }
  const c = ac();
  if (c && musicBus && sfxBus) {
    musicBus.gain.setTargetAtTime(next.music / 100, c.currentTime, 0.03);
    sfxBus.gain.setTargetAtTime(next.effects / 100, c.currentTime, 0.03);
  }
}

/**
 * Original v54 F-minor score at 112 BPM: warm keys, bass and restrained drums.
 * Sixteen-bar beds share the same bar grid so crossfades retain their phase.
 * Intro, tension and feature Foley are finite. Reduced motion affects visuals
 * independently of the user's explicit music/effects/mute preferences.
 */
const BED_URL = {
  base: "/kilo-audio/bed-base.ogg",
  spin: "/kilo-audio/bed-spin.ogg",
  feature: "/kilo-audio/bed-feature.ogg",
  chopper: "/kilo-audio/bed-chopper.ogg",
} as const;
const INTRO_URL = "/kilo-audio/bed-intro.ogg";
const TENSION_URL = "/kilo-audio/stem-tension.ogg";
const SFX_URL = "/kilo-audio/sfx.ogg";
const SFX_MAP_URL = "/kilo-audio/sfx.json";

type BedName = keyof typeof BED_URL;
type TrackName = BedName | "intro";
type Sprite = [number, number];

export const FEATURE_CUE_NAMES = [
  "boatThrust", "boatCoast", "boatBrake", "boatPass",
  "vsReady", "vsPull", "vsImpact", "vsLock", "vsConnect", "vsAmount", "vsTransfer", "vsBank",
  "vsLatch", "reelPull", "cargoLock", "chopperApproach", "cargoDrop",
  "multiplierBoost", "cascadeBreak", "cascadeLand", "getawayLaunch",
  "getawayWin", "getawayLoss",
] as const;
export type FeatureCueName = (typeof FEATURE_CUE_NAMES)[number];

const REQUIRED_CUES = [
  "land1", "land2", "land3", "land4", "land5", "scatter1", "scatter2", "scatter3",
  "ui", "tick", "spin", "resolve", "winSmall", "winMid", "winBig", "collect",
  "tool", "level", "featureEnter", "chopperEnter", "featureComplete", ...FEATURE_CUE_NAMES,
];

export function muted(): boolean {
  try {
    return localStorage.getItem(MUTE) === "1";
  } catch {
    return false;
  }
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let musicDuck: GainNode | null = null;
let sfxBus: GainNode | null = null;
let beds: Partial<Record<BedName | "tension" | "intro", AudioBuffer>> = {};
let sfxBuf: AudioBuffer | null = null;
let sprites: Record<string, Sprite> = {};
let loaded = false;
let loading: Promise<void> | null = null;
let music: { name: TrackName; src: AudioBufferSourceNode; gain: GainNode; startedAt: number } | null =
  null;
let tension: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
let featureMode = false;
let featureBed: "feature" | "chopper" | null = null;
let turbo = false;
let wanted: BedName | null = null;
let whirAt = -Infinity;
let landIx = 0;
let scatterN = 0;
let introPlayed = false;
let introToken = 0;
let stingAt = 0;
let vsLocks = 0;

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new Ctx();
      master = ctx.createGain();
      master.gain.value = muted() ? 0 : 1;
      musicDuck = ctx.createGain();
      musicBus = ctx.createGain();
      sfxBus = ctx.createGain();
      const levels = audioVolumes();
      musicBus.gain.value = levels.music / 100;
      sfxBus.gain.value = levels.effects / 100;
      musicDuck.connect(musicBus);
      musicBus.connect(master);
      sfxBus.connect(master);
      master.connect(ctx.destination);
    }
    return ctx;
  } catch {
    return null;
  }
}

function resume() {
  const c = ac();
  if (c && c.state === "suspended") void c.resume().catch(() => { /* Retry on the next gesture. */ });
}

function bedLevel() {
  return turbo ? 0.2 : 0.48;
}

async function decode(url: string) {
  const c = ac();
  if (!c) throw new Error("no audio");
  const res = await fetch(url, url === SFX_URL ? { cache: "no-cache" } : undefined);
  if (!res.ok) throw new Error(url);
  return c.decodeAudioData(await res.arrayBuffer());
}

export function preloadAudio() {
  if (loaded) return Promise.resolve();
  // Unsupported audio environments remain unavailable without repeatedly
  // issuing network requests on every spin or server-side replay.
  if (!ac()) return Promise.resolve();
  if (!loading) {
    const attempt = (async () => {
      try {
        const mapRes = await fetch(SFX_MAP_URL, { cache: "no-cache" });
        if (!mapRes.ok) throw new Error("Sound unavailable");
        const candidateMap: unknown = await mapRes.json();
        const [base, spin, feature, chopper, intro, rise, sfx] = await Promise.all([
          decode(BED_URL.base),
          decode(BED_URL.spin),
          decode(BED_URL.feature),
          decode(BED_URL.chopper),
          decode(INTRO_URL),
          decode(TENSION_URL),
          decode(SFX_URL),
        ]);
        if (!candidateMap || typeof candidateMap !== "object" || Array.isArray(candidateMap)) {
          throw new Error("Invalid sound map");
        }
        const map = candidateMap as Record<string, unknown>;
        for (const name of REQUIRED_CUES) {
          const value = map[name];
          if (!Array.isArray(value) || value.length !== 2 ||
            !value.every((part) => typeof part === "number" && Number.isFinite(part)) ||
            value[0] < 0 || value[1] <= 0 || value[0] + value[1] > sfx.duration * 1000 + 1) {
            throw new Error(`Invalid sound cue: ${name}`);
          }
        }
        sprites = candidateMap as Record<string, Sprite>;
        beds = { base, spin, feature, chopper, intro, tension: rise };
        sfxBuf = sfx;
        loaded = true;
        if (wanted) startBed(wanted);
      } catch (error) {
        loaded = false;
        console.error("kilo-audio", error);
      }
    })();
    loading = attempt;
    // Cache concurrent requests, never a failed attempt. The next gesture can retry.
    void attempt.finally(() => { if (loading === attempt) loading = null; });
  }
  return loading;
}

/** Call from a click (Enter or Spin) so the browser unlocks audio. */
export function primeAudio() {
  resume();
  void preloadAudio().then(() => {
    if (!loaded || wanted || muted()) return;
    playIntro();
  });
}

export function setAudioTurbo(on: boolean) {
  turbo = on;
  if (!music || !ctx) return;
  const t = ctx.currentTime;
  music.gain.gain.cancelScheduledValues(t);
  music.gain.gain.setValueAtTime(Math.max(0.0001, music.gain.gain.value), t);
  music.gain.gain.linearRampToValueAtTime(bedLevel(), t + 0.12);
}

function startBed(name: BedName) {
  wanted = name;
  if (muted()) return;
  const c = ac();
  const buf = beds[name];
  if (!c || !musicDuck || !loaded || !buf) return;
  resume();
  if (music?.name === name) {
    const t = c.currentTime;
    music.gain.gain.cancelScheduledValues(t);
    music.gain.gain.setValueAtTime(Math.max(0.0001, music.gain.gain.value), t);
    music.gain.gain.linearRampToValueAtTime(bedLevel(), t + 0.2);
    return;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const gain = c.createGain();
  const t = c.currentTime;
  const dur = buf.duration;
  let offset = 0;
  if (music) {
    const elapsed = Math.max(0, t - music.startedAt);
    offset = elapsed % dur;
    if (!Number.isFinite(offset) || offset < 0 || dur - offset < 0.02) offset = 0;
  }
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(Math.max(0.0001, bedLevel()), t + 0.32);
  src.connect(gain);
  gain.connect(musicDuck);
  src.start(t, offset);
  const prev = music;
  music = { name, src, gain, startedAt: t - offset };
  if (prev?.name === "intro") introToken += 1;
  if (prev) {
    prev.gain.gain.cancelScheduledValues(t);
    prev.gain.gain.setValueAtTime(Math.max(0.0001, prev.gain.gain.value), t);
    prev.gain.gain.linearRampToValueAtTime(0.0001, t + 0.32);
    const dying = prev.src;
    window.setTimeout(() => {
      try {
        dying.stop();
      } catch {
        /* already stopped */
      }
    }, 420);
  }
}

/** One-shot theme. Hands to idle on the same beat. Not a loop. */
function playIntro() {
  if (introPlayed) {
    startBed("base");
    return;
  }
  if (muted()) return;
  const c = ac();
  const buf = beds.intro;
  if (!c || !musicDuck || !buf) {
    startBed("base");
    return;
  }
  introPlayed = true;
  wanted = "base";
  resume();
  const token = ++introToken;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = false;
  const gain = c.createGain();
  const t = c.currentTime;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(Math.max(0.0001, bedLevel()), t + 0.16);
  src.connect(gain);
  gain.connect(musicDuck);
  src.start(t);
  const prev = music;
  music = { name: "intro", src, gain, startedAt: t };
  if (prev) {
    prev.gain.gain.cancelScheduledValues(t);
    prev.gain.gain.setValueAtTime(Math.max(0.0001, prev.gain.gain.value), t);
    prev.gain.gain.linearRampToValueAtTime(0.0001, t + 0.3);
    const dying = prev.src;
    window.setTimeout(() => {
      try {
        dying.stop();
      } catch {
        /* already stopped */
      }
    }, 400);
  }
  const handMs = Math.max(200, (buf.duration - 0.45) * 1000);
  window.setTimeout(() => {
    if (token !== introToken) return;
    if (music?.name === "intro") startBed("base");
  }, handMs);
  src.onended = () => {
    if (token !== introToken) return;
    if (music?.src === src) startBed("base");
  };
}

function play(name: string, opts?: { gain?: number; rate?: number }) {
  if (muted()) return;
  const c = ac();
  const spr = sprites[name];
  if (!c || !sfxBus || !sfxBuf || !spr) return;
  resume();
  const src = c.createBufferSource();
  src.buffer = sfxBuf;
  const rate = Math.max(0.25, Math.min(4, opts?.rate ?? 1));
  src.playbackRate.value = rate;
  const gain = c.createGain();
  src.connect(gain);
  gain.connect(sfxBus);
  const level = opts?.gain ?? 0.85;
  const offset = spr[0] / 1000;
  const dur = spr[1] / 1000;
  const playbackDuration = dur / rate;
  const t0 = c.currentTime;
  gain.gain.setValueAtTime(level, t0);
  if (playbackDuration > 0.04) {
    gain.gain.setValueAtTime(level, t0 + Math.max(0, playbackDuration - 0.012));
    gain.gain.linearRampToValueAtTime(0.0001, t0 + playbackDuration);
  }
  src.onended = () => { src.disconnect(); gain.disconnect(); };
  src.start(t0, offset, dur);
}

function duck(ms: number) {
  const c = ctx;
  if (!c || !musicDuck) return;
  const t = c.currentTime;
  const now = musicDuck.gain.value || 1;
  musicDuck.gain.cancelScheduledValues(t);
  musicDuck.gain.setValueAtTime(now, t);
  musicDuck.gain.linearRampToValueAtTime(0.45, t + 0.04);
  musicDuck.gain.linearRampToValueAtTime(1, t + Math.max(0.2, ms / 1000));
}

function stopTension(fade = 0.08) {
  if (!tension || !ctx) {
    tension = null;
    return;
  }
  const { src, gain } = tension;
  tension = null;
  const t = ctx.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + fade);
  window.setTimeout(() => {
    try {
      src.stop();
    } catch {
      /* already stopped */
    }
  }, fade * 1000 + 40);
}

export function whirStart() {
  const now = performance.now();
  if (now - whirAt < 400) return;
  whirAt = now;
  landIx = 0;
  scatterN = 0;
  primeAudio();
  play("spin", { gain: turbo ? 0.12 : 0.24 });
  if (!featureBed) startBed("spin");
}

export function whirStop() {
  stopTension(0.06);
  startBed(featureBed ?? "base");
}

export function teaseBegin() {
  if (muted() || tension) return;
  const c = ac();
  const buf = beds.tension;
  if (!c || !sfxBus || !buf) return;
  resume();
  const src = c.createBufferSource();
  src.buffer = buf;
  const gain = c.createGain();
  const t = c.currentTime;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.75, t + 0.1);
  src.connect(gain);
  gain.connect(sfxBus);
  src.start();
  tension = { src, gain };
  src.onended = () => {
    if (tension?.src === src) tension = null;
    src.disconnect();
    gain.disconnect();
  };
  duck(turbo ? 900 : 4200);
}

export function scatterBuild(step: number) {
  const n = Math.max(0, Math.min(10, step));
  play("tick", { gain: 0.28 });
  if (tension && ctx) {
    const level = Math.min(1, 0.55 + n * 0.04);
    tension.gain.gain.linearRampToValueAtTime(level, ctx.currentTime + 0.05);
  }
}

export function teaseResolve(hit: boolean) {
  stopTension(hit ? 0.12 : 0.05);
  if (!hit) return;
  play("resolve", { gain: 0.8 });
  featureMode = true;
  featureBed = featureBed ?? "feature";
  startBed(featureBed);
}

export function landStop(scatter: boolean, _almost = false) {
  if (scatter) {
    scatterN = Math.min(3, scatterN + 1);
    play(`scatter${scatterN}`, { gain: 0.5 });
    return;
  }
  landIx = (landIx % 5) + 1;
  play(`land${landIx}`, { gain: turbo ? 0.42 : 0.5 });
}

export function winSting(tier: 0 | 1 | 2) {
  stingAt = performance.now();
  if (tier <= 0) {
    play("winSmall", { gain: 0.75 });
    return;
  }
  if (tier === 1) {
    duck(1000);
    play("winMid", { gain: 0.85 });
    return;
  }
  duck(1800);
  play("winBig", { gain: 0.9 });
}

/** Pass feature identity separately when the charge mode is base/ante/buy. */
export function bonusEnter(mode?: string, feature?: string) {
  vsLocks = 0;
  const identity = feature ?? mode;
  const isRoute = identity === "route" || identity === "chopper";
  const bed: "feature" | "chopper" = isRoute ? "chopper" : "feature";
  featureBed = bed;
  featureMode = true;
  play(isRoute ? "chopperEnter" : identity === "getaway" ? "getawayLaunch" : "featureEnter", { gain: 0.8 });
  startBed(bed);
}

/** Presentation-only cues. The outcome renderer owns their event timing. */
export function featureCue(name: FeatureCueName) {
  const gains: Record<FeatureCueName, number> = {
    boatThrust: .38, boatCoast: .30, boatBrake: .42, boatPass: .36,
    vsReady: .42, vsPull: .40, vsImpact: .55, vsLock: .58,
    vsConnect: .38, vsAmount: .40, vsTransfer: .32, vsBank: .42,
    vsLatch: .68, reelPull: .48, cargoLock: .56, chopperApproach: .42,
    cargoDrop: .58, multiplierBoost: .64, cascadeBreak: .46, cascadeLand: .48,
    getawayLaunch: .55, getawayWin: .84, getawayLoss: .42,
  };
  // One continuous confrontation mix: pull leaves room for contact, lock
  // resolves upward with recorded growth, and bank is a single quiet landing.
  // Pitch/gain never select an outcome or affect the presentation clock.
  if (name === 'vsLock') vsLocks = Math.min(5, vsLocks + 1);
  if (name === 'vsReady') duck(650);
  if (name === 'vsImpact') duck(380);
  if (name === 'vsAmount') duck(650);
  if (name === "getawayWin") duck(1500);
  const pitched = name === 'vsLock' || name === 'vsLatch' || name === 'vsAmount';
  const rate = pitched ? 2 ** (Math.max(0, vsLocks - 1) * 2 / 12) : 1;
  play(name, { gain: gains[name], rate });
}

export function bonusExit() {
  vsLocks = 0;
  featureMode = false;
  featureBed = null;
  stopTension(0.05);
  startBed("base");
}

export function setMuted(on: boolean) {
  try {
    localStorage.setItem(MUTE, on ? "1" : "0");
  } catch {
    /* ignore */
  }
  const c = ac();
  if (master && c) {
    master.gain.cancelScheduledValues(c.currentTime);
    master.gain.setValueAtTime(on ? 0 : 1, c.currentTime);
  }
  if (!on) {
    resume();
    void preloadAudio();
    if (wanted) startBed(wanted);
    else if (featureBed) startBed(featureBed);
    else primeAudio();
  }
}

export function uiTap() {
  play("ui", { gain: 0.42 });
}

export function cue(
  kind: "spin" | "stop" | "tick" | "win" | "scatter" | "collect" | "tool" | "level" | "end",
) {
  if (kind === "spin") whirStart();
  if (kind === "tick") play("tick", { gain: 0.3 });
  if (kind === "stop") landStop(false);
  if (kind === "scatter") play("tick", { gain: 0.22 });
  if (kind === "win") winSting(0);
  if (kind === "collect") play("collect", { gain: 0.7 });
  if (kind === "tool") play("tool", { gain: 0.7 });
  if (kind === "level") play("level", { gain: 0.75 });
  if (kind === "end") {
    if (featureMode) play("featureComplete", { gain: 0.85 });
    else if (performance.now() - stingAt > 2000) play("winSmall", { gain: 0.6 });
    bonusExit();
    whirStop();
  }
}
