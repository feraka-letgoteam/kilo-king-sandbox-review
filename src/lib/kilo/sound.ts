const MUTE = "kilo-sandbox-mute";

export function muted(): boolean {
  try {
    return localStorage.getItem(MUTE) === "1";
  } catch {
    return false;
  }
}

export function setMuted(on: boolean) {
  try {
    localStorage.setItem(MUTE, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

let ctx: AudioContext | null = null;

function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0) {
  if (muted()) return;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  try {
    ctx = ctx || new AudioContext();
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch {
    /* audio blocked until gesture */
  }
}

export function cue(kind: "spin" | "stop" | "tick" | "win" | "scatter" | "collect" | "tool" | "level" | "end") {
  if (kind === "spin") tone(180, 0.12, "triangle", 0.03);
  if (kind === "tick") tone(510, 0.045, "square", 0.016);
  if (kind === "stop") tone(420, 0.05, "square", 0.02);
  if (kind === "scatter") tone(620, 0.12, "sine", 0.04);
  if (kind === "win") {
    tone(523, 0.12, "triangle", 0.04);
    tone(659, 0.14, "triangle", 0.04, 0.08);
  }
  if (kind === "collect") tone(880, 0.08, "sine", 0.035);
  if (kind === "tool") tone(140, 0.16, "sawtooth", 0.03);
  if (kind === "level") tone(740, 0.18, "triangle", 0.04);
  if (kind === "end") tone(392, 0.2, "sine", 0.04);
}

/** Rising tick while unresolved reels are still in play. Same tone for a hit or a miss. */
export function scatterBuild(step: number) {
  const n = Math.max(0, Math.min(8, step));
  tone(480 + n * 36, 0.05, "square", 0.016);
}
