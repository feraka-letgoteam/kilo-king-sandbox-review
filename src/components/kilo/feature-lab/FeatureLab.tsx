import { useEffect, useState } from "react";
import { advance, amount, initialState, type Mode } from "./model";
import { concepts } from "./examples";
import "./feature-lab.css";

// Archived mechanics study: the retired Chopper concept is not an active option.
const modes = (Object.keys(concepts) as Mode[]).filter(mode => mode !== 'airbridge');
const royals = ["sym-a", "sym-j", "sym-k", "sym-q", "sym-10"];
export default function FeatureLab() {
  const [mode, setMode] = useState<Mode>("dock");
  const [cap, setCap] = useState(500_000);
  const [state, setState] = useState(() => initialState("dock"));
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const spec = concepts[mode];
  const ended = state.ended || index === spec.steps.length;
  function reset(nextMode = mode, nextCap = cap) {
    setPlaying(false);
    setMode(nextMode);
    setCap(nextCap);
    setIndex(0);
    setState(initialState(nextMode, nextCap));
  }
  function next() {
    if (ended) return;
    setState((s) => advance(s, spec.steps[index]));
    setIndex((i) => i + 1);
  }
  function finish() {
    let s = state;
    for (const step of spec.steps.slice(index)) s = advance(s, step);
    setPlaying(false);
    setState(s);
    setIndex(spec.steps.length);
  }
  useEffect(() => {
    if (!playing || ended) return;
    const timer = setTimeout(next, 2400);
    return () => clearTimeout(timer);
  }, [playing, ended, index, mode]);
  const pending =
    mode === "getaway"
      ? state.cases.reduce((a, b) => a + b, 0)
      : state.cargo.reduce((n, p) => n + p.value, 0);
  return (
    <main className="feature-lab" data-reduced={reduced}>
      <header className="fl-heading">
        <div>
          <span className="fl-eyebrow">KILO KING / MECHANICS STUDY 50</span>
          <h1>Archived mechanics studies.</h1>
        </div>
        <a href="./review.html">Back to current game ↗</a>
      </header>
      <p className="fl-disclosure">
        Design prototype. Fixed examples in illustrative credits. No wallet,
        random outcomes, purchase prices or validated RTP.
      </p>
      <nav aria-label="Feature concepts">
        {modes.map((m) => (
          <button key={m} aria-pressed={mode === m} onClick={() => reset(m)}>
            {concepts[m].tag}
          </button>
        ))}
      </nav>
      <section className="fl-layout">
        <div
          className="fl-stage"
          style={{
            backgroundImage: `linear-gradient(#020c1280,#020c12dc),url(/kilo-scenes-v43/${spec.scene}.webp)`,
          }}
        >
          <div className="fl-stage-title">
            <div>
              <span className="fl-eyebrow">{spec.tag}</span>
              <h2>{spec.title}</h2>
            </div>
            <span className="fl-step">
              {index} / {spec.steps.length}
            </span>
          </div>
          <div className="fl-state-strip">
            <span>
              <small>EXAMPLE WIN</small>
              <strong>{amount(state.total)}</strong>
            </span>
            <span>
              <small>
                {mode === "dock"
                  ? "COLLECT MULTIPLIER"
                  : mode === "getaway"
                    ? "CHECKPOINTS"
                    : "PENDING CARGO"}
              </small>
              <strong>
                {mode === "dock"
                  ? `×${state.multiplier}`
                  : mode === "getaway"
                    ? `${state.checkpoints} / 3`
                    : amount(pending)}
              </strong>
            </span>
          </div>
          {mode === "airbridge" && <p className="fl-route-label">{ended ? 'Route complete' : `Next pickup: column ${state.route + 1}`}</p>}
          {mode === "airbridge" && (
            <div
              className="fl-route"
              aria-label={`Next pickup: column ${state.route + 1}`}
            >
              {[0, 1, 2, 3, 4].map((c) => (
                <span
                  className={c === state.route && !ended ? "active" : ""}
                  key={c}
                >
                  {c + 1}
                  {c === state.route && !ended ? " ↓" : ""}
                </span>
              ))}
            </div>
          )}
          <div
            className="fl-board"
            key={`${mode}-${index}`}
            aria-label="Illustrative five by three board"
          >
            {Array.from({ length: 15 }, (_, cell) => {
              const cash = state.cash.find((p) => p.cell === cell);
              const collector = state.collectors.includes(cell);
              const art = collector
                ? "collector-idle.png"
                : cash
                  ? `${cash.value >= 5000 ? "package-king" : cash.value >= 1000 ? "package-trophy" : cash.value >= 500 ? "package-medium" : "package-small"}.webp`
                  : `${royals[(cell * 3 + index) % 5]}.webp`;
              return (
                <div
                  key={cell}
                  className={`fl-cell ${state.highlights.includes(cell) ? "picked" : ""} ${cash ? "cash" : ""} ${mode === "yacht" && cell % 5 === 4 ? "dispatch" : ""}`}
                >
                  <img
                    src={`/kilo-symbols-v47/${art}`}
                    alt={
                      collector
                        ? "Collector"
                        : cash
                          ? `Cargo ${amount(cash.value)}`
                          : "Non-paying filler"
                    }
                  />
                  {cash && <b>{amount(cash.value)}</b>}
                  {cash && state.carry?.id === cash.id && <em>1 SPIN</em>}
                  {!cash &&
                    !collector &&
                    mode === "yacht" &&
                    cell % 5 === 4 && <small>CAPTAIN</small>}
                </div>
              );
            })}
          </div>
          {mode === "dock" && (
            <div className="fl-meter">
              <span>Collectors</span>
              {[0, 1, 2, 3].map((i) => (
                <b className={i < state.portraits % 4 ? "active" : ""} key={i}>
                  {i + 1}
                </b>
              ))}
              <strong>
                Next ×
                {[2, 3, 10, 10][Math.min(3, Math.floor(state.portraits / 4))]}
              </strong>
            </div>
          )}
          {mode === "yacht" && (
            <div className="fl-meter">
              <span>Shipments {state.dispatches}</span>
              <strong>New cargo floor {amount(state.quality * 100)}</strong>
            </div>
          )}
          {mode === "airbridge" && (
            <div className="fl-meter">
              <span>Route multiplier</span>
              <strong>×{state.multiplier}</strong>
            </div>
          )}
          {mode === "getaway" && (
            <div className="fl-cases">
              {state.cases.map((n, i) => (
                <span key={i}>
                  <small>CASE {i + 1}</small>
                  <strong>{amount(n)}</strong>
                </span>
              ))}
            </div>
          )}
          <div className="fl-narration" aria-live="polite">
            <p>{state.note}</p>
            {state.awards.map((a, i) => (
              <div className="fl-equation" key={i}>
                <span>
                  {a.reason}: {a.formula}
                </span>
                <strong>Credited {amount(a.credited)}</strong>
                {a.beforeCap !== a.credited && (
                  <small>
                    Before cap {amount(a.beforeCap)} · cap {amount(state.cap)}
                  </small>
                )}
              </div>
            ))}
          </div>
        </div>
        <aside className="fl-details">
          <span className="fl-eyebrow">THE PLAYER’S RULE</span>
          <h3>{spec.rule}</h3>
          <p>{spec.distinction}</p>
          <div className="fl-playback">
            <button
              onClick={() => {
                if (ended) {
                  reset();
                  setPlaying(true);
                } else setPlaying((p) => !p);
              }}
            >
              {playing && !ended
                ? "Pause"
                : ended
                  ? "Replay example"
                  : "Play example"}
            </button>
            <button onClick={next} disabled={ended}>
              Next event →
            </button>
            <button onClick={finish} disabled={ended}>
              Resolve remaining
            </button>
            <button onClick={() => reset()}>Reset</button>
          </div>
          <label className="fl-check">
            <input
              type="checkbox"
              checked={reduced}
              onChange={(e) => setReduced(e.target.checked)}
            />
            Reduced motion
          </label>
          <label className="fl-check">
            <input
              type="checkbox"
              checked={cap === 10_000}
              onChange={(e) => reset(mode, e.target.checked ? 10_000 : 500_000)}
            />
            Exercise 10,000-credit cap
          </label>
          <h4>Recorded sequence</h4>
          <ol className="fl-timeline">
            {spec.steps.map((s, i) => (
              <li
                key={s.id}
                className={
                  i + 1 === index ? "current" : i < index ? "done" : ""
                }
              >
                {s.title}
              </li>
            ))}
          </ol>
          <p className="fl-footnote">
            These rules run in an isolated reducer. They do not alter the
            current game’s engine, wallet or feature purchases. Playback speed
            changes presentation only.
          </p>
        </aside>
      </section>
    </main>
  );
}
