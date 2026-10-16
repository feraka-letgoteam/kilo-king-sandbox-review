const MUTE = "kilo-sandbox-mute";

/**
 * Placeholder score, not a licensed session. One F-minor theme at 124 BPM.
 * The theme is drums plus a short filtered stab. No sine lead.
 * Looping beds are 32 bars and bar-aligned. Intro is a one-shot of the first
 * half, then idle. Drop replacement ogg files at the same paths to upgrade.
 * A full loss stays quiet. A tease miss only fades the riser.
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

const SHORT = new Set([
  "land1",
  "land2",
  "land3",
  "land4",
  "land5",
  "scatter1",
  "scatter2",
  "scatter3",
  "ui",
  "tick",
]);

export function muted(): boolean {
  try {
    return localStorage.getItem(MUTE) === "1";
  } catch {
    return false;
  }
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
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
let whirAt = 0;
let landIx = 0;
let scatterN = 0;
let introPlayed = false;
let introToken = 0;
let stingAt = 0;

function reducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new Ctx();
      master = ctx.createGain();
      master.gain.value = muted() ? 0 : 1;
      musicDuck = ctx.createGain();
      sfxBus = ctx.createGain();
      musicDuck.connect(master);
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
  if (c && c.state === "suspended") void c.resume();
}

function bedLevel() {
  return turbo ? 0.2 : 0.48;
}

async function decode(url: string) {
  const c = ac();
  if (!c) throw new Error("no audio");
  const res = await fetch(url);
  if (!res.ok) throw new Error(url);
  return c.decodeAudioData(await res.arrayBuffer());
}

export function preloadAudio() {
  if (!loading) {
    loading = (async () => {
      try {
        const mapRes = await fetch(SFX_MAP_URL);
        sprites = (await mapRes.json()) as Record<string, Sprite>;
        const [base, spin, feature, chopper, intro, rise, sfx] = await Promise.all([
          decode(BED_URL.base),
          decode(BED_URL.spin),
          decode(BED_URL.feature),
          decode(BED_URL.chopper),
          decode(INTRO_URL),
          decode(TENSION_URL),
          decode(SFX_URL),
        ]);
        beds = { base, spin, feature, chopper, intro, tension: rise };
        sfxBuf = sfx;
        loaded = true;
        if (wanted) startBed(wanted);
      } catch (error) {
        console.error("kilo-audio", error);
      }
    })();
  }
  return loading;
}

/** Call from a click (Enter or Spin) so the browser unlocks audio. */
export function primeAudio() {
  resume();
  void preloadAudio().then(() => {
    if (wanted || reducedMotion() || muted()) return;
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
  if (reducedMotion() || muted()) return;
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
  if (reducedMotion() || muted()) return;
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
  if (reducedMotion() && !SHORT.has(name)) return;
  if (muted()) return;
  const c = ac();
  const spr = sprites[name];
  if (!c || !sfxBus || !sfxBuf || !spr) return;
  resume();
  const src = c.createBufferSource();
  src.buffer = sfxBuf;
  src.playbackRate.value = opts?.rate ?? 1;
  const gain = c.createGain();
  src.connect(gain);
  gain.connect(sfxBus);
  const level = opts?.gain ?? 0.85;
  const offset = spr[0] / 1000;
  const dur = spr[1] / 1000;
  const t0 = c.currentTime;
  gain.gain.setValueAtTime(level, t0);
  if (dur > 0.04) {
    gain.gain.setValueAtTime(level, t0 + Math.max(0, dur - 0.012));
    gain.gain.linearRampToValueAtTime(0.0001, t0 + dur);
  }
  src.start(t0, offset, dur);
}

function duck(ms: number) {
  const c = ctx;
  if (!c || !musicDuck || reducedMotion()) return;
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
  if (!reducedMotion()) {
    play("spin", { gain: turbo ? 0.12 : 0.24 });
  }
  if (!featureBed) startBed("spin");
}

export function whirStop() {
  stopTension(0.06);
  startBed(featureBed ?? "base");
}

export function teaseBegin() {
  if (reducedMotion() || muted() || tension) return;
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

export function bonusEnter(mode?: string) {
  const bed: "feature" | "chopper" = mode === "chopper" ? "chopper" : "feature";
  featureBed = bed;
  featureMode = true;
  if (!reducedMotion()) {
    play(mode === "chopper" ? "chopperEnter" : "featureEnter", { gain: 0.8 });
  }
  startBed(bed);
}

export function bonusExit() {
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
