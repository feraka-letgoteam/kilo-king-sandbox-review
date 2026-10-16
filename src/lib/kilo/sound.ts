const MUTE = "kilo-sandbox-mute";

export function muted(): boolean {
  try {
    return localStorage.getItem(MUTE) === "1";
  } catch {
    return false;
  }
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let whir: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
let bed: { osc: OscillatorNode; gain: GainNode } | null = null;
let pad: { oscs: OscillatorNode[]; gain: GainNode } | null = null;
let featureBed = false;

function reducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function ac(): AudioContext | null {
  if (reducedMotion()) return null;
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = muted() ? 0 : 1;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function out(): GainNode | null {
  ac();
  return master;
}

function noise(): AudioBuffer | null {
  const c = ac();
  if (!c) return null;
  if (noiseBuf) return noiseBuf;
  const buf = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + white) * 0.5;
    data[i] = last;
  }
  noiseBuf = buf;
  return buf;
}

function envGain(at: number, peak: number, attack: number, dur: number) {
  const c = ac();
  const bus = out();
  if (!c || !bus) return null;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  g.connect(bus);
  return g;
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType,
  gain: number,
  delay = 0,
  slideTo?: number,
) {
  const c = ac();
  if (!c || muted()) return;
  const t0 = c.currentTime + delay;
  const g = envGain(t0, gain, Math.min(0.03, dur * 0.25), dur);
  if (!g) return;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo != null) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
  osc.connect(g);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function click(freq: number, gain: number, dur: number) {
  const c = ac();
  const buf = noise();
  if (!c || !buf || muted()) return;
  const t0 = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = freq;
  const g = envGain(t0, gain, 0.004, dur);
  if (!g) return;
  src.connect(filter);
  filter.connect(g);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

function stopNode(node: AudioNode | null) {
  try {
    if (node && "stop" in node) (node as AudioBufferSourceNode).stop();
  } catch {
    /* already stopped */
  }
}

export function whirStart() {
  if (whir || muted()) return;
  const c = ac();
  const buf = noise();
  const bus = out();
  if (!c || !buf || !bus) return;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 280;
  filter.Q.value = 0.7;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.045, c.currentTime + 0.08);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(bus);
  src.start();
  whir = { src, gain };
}

export function whirStop() {
  if (!whir || !ctx) {
    whir = null;
    return;
  }
  const { src, gain } = whir;
  whir = null;
  const t = ctx.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  window.setTimeout(() => stopNode(src), 120);
}

function stopBed() {
  if (!bed) return;
  stopNode(bed.osc);
  bed = null;
}

/** Rising bed under unresolved reels. Same shape for a hit or a miss. */
export function teaseBegin() {
  if (bed || muted()) return;
  const c = ac();
  const bus = out();
  if (!c || !bus) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(196, c.currentTime);
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.03, c.currentTime + 0.12);
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(900, c.currentTime);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(bus);
  osc.start();
  bed = { osc, gain };
}

export function scatterBuild(step: number) {
  const n = Math.max(0, Math.min(10, step));
  tone(520 + n * 42, 0.045, "square", 0.012);
  if (bed && ctx) {
    const f = 196 + n * 28;
    bed.osc.frequency.linearRampToValueAtTime(f, ctx.currentTime + 0.05);
    bed.gain.gain.linearRampToValueAtTime(Math.min(0.05, 0.02 + n * 0.003), ctx.currentTime + 0.05);
  }
}

export function teaseResolve(hit: boolean) {
  const had = !!bed;
  stopBed();
  if (!had) return;
  if (hit) {
    tone(523, 0.12, "triangle", 0.05);
    tone(659, 0.14, "triangle", 0.045, 0.07);
    tone(784, 0.18, "triangle", 0.04, 0.14);
  } else {
    tone(440, 0.09, "sine", 0.02, 0, 280);
    click(900, 0.02, 0.05);
  }
}

/** Reel stop. Scatter lands chime; a teased miss on the last reel is softer. */
export function landStop(scatter: boolean, almost = false) {
  if (scatter) {
    tone(740, 0.09, "triangle", 0.05);
    tone(988, 0.12, "sine", 0.035, 0.04);
    return;
  }
  if (almost) {
    tone(360, 0.07, "sine", 0.018, 0, 240);
    click(700, 0.018, 0.04);
    return;
  }
  click(1400, 0.04, 0.035);
  tone(210, 0.04, "square", 0.02);
}

export function winSting(tier: 0 | 1 | 2) {
  if (tier <= 0) {
    tone(523, 0.1, "triangle", 0.045);
    tone(659, 0.12, "triangle", 0.04, 0.07);
    return;
  }
  if (tier === 1) {
    tone(523, 0.1, "triangle", 0.05);
    tone(659, 0.12, "triangle", 0.045, 0.08);
    tone(784, 0.16, "triangle", 0.04, 0.16);
    click(1800, 0.03, 0.08);
    return;
  }
  tone(392, 0.12, "sawtooth", 0.04);
  tone(523, 0.14, "triangle", 0.05, 0.08);
  tone(659, 0.16, "triangle", 0.05, 0.16);
  tone(784, 0.2, "triangle", 0.045, 0.26);
  tone(1046, 0.24, "sine", 0.035, 0.36);
}

function stopPad() {
  if (!pad) return;
  for (const osc of pad.oscs) stopNode(osc);
  pad = null;
}

export function bonusEnter() {
  featureBed = true;
  tone(196, 0.18, "triangle", 0.04);
  tone(392, 0.22, "triangle", 0.045, 0.06);
  tone(587, 0.26, "sine", 0.035, 0.12);
  if (pad || muted()) return;
  const c = ac();
  const bus = out();
  if (!c || !bus) return;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.022, c.currentTime + 0.25);
  gain.connect(bus);
  const oscs = [196, 294, 392].map((freq, i) => {
    const osc = c.createOscillator();
    osc.type = i === 2 ? "sine" : "triangle";
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start();
    return osc;
  });
  pad = { oscs, gain };
}

export function bonusExit() {
  featureBed = false;
  if (pad && ctx) {
    const t = ctx.currentTime;
    pad.gain.gain.cancelScheduledValues(t);
    pad.gain.gain.setValueAtTime(Math.max(0.0001, pad.gain.gain.value), t);
    pad.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    const dying = pad;
    pad = null;
    window.setTimeout(() => {
      for (const osc of dying.oscs) stopNode(osc);
    }, 240);
  }
}

function silenceLoops() {
  whirStop();
  stopBed();
  stopPad();
}

export function setMuted(on: boolean) {
  try {
    localStorage.setItem(MUTE, on ? "1" : "0");
  } catch {
    /* ignore */
  }
  const c = ctx;
  if (master && c) master.gain.setValueAtTime(on ? 0 : 1, c.currentTime);
  if (on) silenceLoops();
  else if (featureBed) bonusEnter();
}

export function cue(
  kind: "spin" | "stop" | "tick" | "win" | "scatter" | "collect" | "tool" | "level" | "end",
) {
  if (kind === "spin") {
    tone(160, 0.08, "triangle", 0.03);
    whirStart();
  }
  if (kind === "tick") tone(510, 0.04, "square", 0.014);
  if (kind === "stop") landStop(false);
  if (kind === "scatter") {
    tone(620, 0.1, "sine", 0.04);
    tone(830, 0.12, "triangle", 0.03, 0.06);
  }
  if (kind === "win") winSting(0);
  if (kind === "collect") {
    tone(880, 0.07, "sine", 0.04);
    tone(1174, 0.08, "sine", 0.028, 0.05);
  }
  if (kind === "tool") {
    tone(140, 0.16, "sawtooth", 0.035, 0, 70);
    click(400, 0.04, 0.1);
  }
  if (kind === "level") {
    tone(659, 0.1, "triangle", 0.04);
    tone(880, 0.14, "triangle", 0.04, 0.08);
  }
  if (kind === "end") {
    tone(392, 0.16, "sine", 0.04);
    tone(523, 0.18, "triangle", 0.03, 0.08);
    bonusExit();
    whirStop();
  }
}
