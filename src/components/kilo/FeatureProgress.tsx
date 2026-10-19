import type { FeatureEvent } from "@/lib/kilo/feature-math";
import { vsGroupsFor } from '@/lib/kilo/vs-groups';
const money = (n: number) => Math.round(n).toLocaleString("en-US");
/** Occupies the existing collector-track space; never changes reel geometry. */
export function FeatureProgress({ event: e }: { event: FeatureEvent }) {
  if (e.reel) {
    const r = e.reel;
    const largest = r.type === 'vs' ? vsGroupsFor(r).sort((a,b)=>b.width-a.width||b.multiplier-a.multiplier)[0] : null;
    return <div className="kk-feature-progress" data-kind={e.kind}>
      <span>{r.type === 'vs' ? 'Kilo King VS' : r.type === 'tumble' ? 'Chopper Route' : 'The Getaway'}</span>
      <strong>{r.type === 'vs' ? largest ? `${largest.width}-reel ×${largest.multiplier.toLocaleString('en-US')}` : 'VS ready' : r.type === 'tumble' ? `×${r.globalAfter}` : '1 spin'}</strong>
      <small>{r.type === 'binary' ? 'Max win or nothing' : r.type === 'vs' && r.rules === 'pure-vs' ? `${r.after.length} / 5 reels locked` : `${e.heldAfter.length} cash locked`}</small>
    </div>;
  }
  const label =
    e.kind === "yacht"
      ? `${e.heldAfter.length}/12 holds · ${e.shipments} shipments`
      : e.kind === "route"
        ? `Pickup ${e.route + 1}/5 · route ×${e.multiplier}`
        : `Checkpoint ${e.checkpoint}/3`;
  return (
    <div className="kk-feature-progress" data-kind={e.kind} aria-label={label}>
      <span>
        {e.kind === "yacht"
          ? `Cargo grade ${e.quality + 1}`
          : e.kind === "route"
            ? "Chopper route"
            : "The Getaway"}
      </span>
      <strong>{money(e.pendingAfter)}</strong>
      <small>{label}</small>
    </div>
  );
}
