import { lineHit, PAYLINES } from '@/lib/kilo/engine';
import type { YachtReels } from '@/lib/kilo/reel-feature-math';
import { vsGroupsFor, vsLineMultiplier } from '@/lib/kilo/vs-groups';

/** Presentation metadata only. Payouts always come from the recorded line. */
export const VS_KING_ACTION = '/kilo-v79/vs/king-action.webp';
export const VS_KING_FRAMES = Array.from({ length: 8 }, (_, i) => {
  const col = i % 4, row = Math.floor(i / 4);
  const x = Math.round(col * 1774 / 4), right = Math.round((col + 1) * 1774 / 4);
  return { x, y: row ? 460 : 0, width: right - x, height: row ? 427 : 460,
    baseline: row ? 387 : 446 };
});
export const VS_BEATS = { brace: .24, pull: .36, contact: .49, lock: .82 } as const;
const unit=(t:number)=>Math.max(0,Math.min(1,t));
const smooth=(t:number)=>{const u=unit(t);return u*u*(3-2*u);};
/** Both opponents share one contact clock. Offsets are in cell units. */
export function vsPhysicalAt(t:number,reduced=false) {
  if(reduced)return {ready:0,drive:0,recoil:0,resolve:1,settle:0};
  // Load, hold, release: the 0.26–0.36 plateau gives the audience a visible
  // held pose before either side commits. Existing cue crossings are intact.
  const ready=smooth((t-.15)/.10)*(1-smooth((t-.36)/.055));
  // A single shared contact with a short hold, followed by a weighted recoil.
  // Opponents never oscillate or carry a second idle cycle into the result.
  const drive=smooth((t-.36)/.13)*(1-smooth((t-.535)/.075));
  const recoil=Math.sin(Math.PI*unit((t-.535)/.145))**.8;
  const resolve=smooth((t-.60)/.22);
  const settle=t>=.82?Math.sin(unit((t-.82)/.18)*Math.PI*2)*(1-unit((t-.82)/.18))**2:0;
  return {ready,drive,recoil,resolve,settle};
}
export function kingActionFrame(t: number, won: boolean) {
  if (t < .24) return 0;
  if (t < .32) return 1;
  if (t < .40) return 2;
  if (t < .48) return 3;
  if (t < .56) return 4;
  if (t < .64) return 5;
  if (t < .74 && won) return 6;
  return won ? 7 : 5;
}
export const VS_WIN_TIMING = { connect: 260, amount: 180, hold: 380, transfer: 340 } as const;

/** One board response, one amount, one transfer. Each line remains in the audit record. */
export function vsWinningBoard(reels: YachtReels, stake: number) {
  const connections = vsWinningConnections(reels, stake);
  if (!connections.length) return [];
  const spots = [...new Map(connections.flatMap(c => c.spots).map(p => [`${p.reel}:${p.row}`, p])).values()];
  const groups = [...new Map(connections.flatMap(c => c.groups).map(g => [g.id, g])).values()];
  const credited = connections.reduce((n, c) => n + c.credited, 0);
  return [{ ...connections[0]!, connections, spots, groups, credited,
    beforeCap: reels.lineBeforeCap,
    line: { ...connections[0]!.line, n: Math.max(...connections.map(c => c.line.n)), pay: credited } }];
}

export function vsWinningConnections(reels: YachtReels, stake: number) {
  return reels.lines.map(line => {
    const rows = PAYLINES[line.i]!;
    const hit = lineHit(reels.finalGrid, rows);
    const participating = reels.after.filter(w => w.reel < line.n);
    const groups = vsGroupsFor(reels).filter(group => group.reels.some(reel => reel < line.n));
    const multiple = vsLineMultiplier(reels.after, line.n, reels.combining);
    const base = hit ? stake * hit.mult : line.pay / multiple;
    return { line, participating, groups, multiple, base,
      beforeCap: Math.round(base * multiple), credited: line.pay,
      spots: rows.slice(0, line.n).map((row, reel) => ({ reel, row })) };
  });
}
