import type { FeatureEvent } from "@/lib/kilo/feature-math";
import { vsGroupsFor } from '@/lib/kilo/vs-groups';
import { t } from '@/lib/kilo/copy';
const money = (n: number) => Math.round(n).toLocaleString("en-US");
/** Occupies the existing collector-track space; never changes reel geometry. */
export function FeatureProgress({ event: e }: { event: FeatureEvent }) {
  if (e.reel) {
    const r = e.reel;
    if(r.type==='vs'){
      const groups=vsGroupsFor(r),locked=new Set(r.after.map(w=>w.reel));
      return <div className="kk-feature-progress kk-vs-ledger" data-kind={e.kind} aria-label={`${e.kind==='yacht25'?'Super Yacht':'Yacht'} Stash. ${r.after.length} of 5 reels locked. ${groups.map(g=>`${g.side==='king'?'King':'Cop'}, reels ${g.start+1} to ${g.end+1}, multiplier ${g.multiplier}`).join('. ')}`}>
        <span>{e.kind==='yacht25'?'SUPER YACHT STASH':'YACHT STASH'}</span>
        <div className="kk-vs-ledger-reels" aria-hidden="true">
          {[0,1,2,3,4].filter(i=>!locked.has(i)).map(i=><i key={`empty-${i}`} style={{gridColumn:i+1}}><span>{i+1}</span></i>)}
          {groups.map(g=><b key={`${g.id}:${g.multiplier}`} data-side={g.side} style={{gridColumn:`${g.start+1} / span ${g.width}`}}>×{g.multiplier.toLocaleString('en-US')}</b>)}
        </div>
        <small>{groups.length?`${r.after.length} / 5 REELS LOCKED`:'MATCHING SIDES MULTIPLY'}</small>
      </div>;
    }
    return <div className="kk-feature-progress" data-kind={e.kind}>
      <span>{r.type === 'tumble' ? 'Chopper Route' : 'The Getaway'}</span>
      <strong>{r.type === 'tumble' ? `×${r.globalAfter}` : '1 spin'}</strong>
      <small>{r.type === 'binary' ? 'Max win or nothing' : t('hud.cashLocked')(String(e.heldAfter.length))}</small>
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
