import type { Duelist, ReelWild } from './reel-feature-math.ts';

/** Only explicitly marked records use the adjacent-product rule. */
export const VS_COMBINING_RULE = 'adjacent-products-v77' as const;
export type VsCombiningRule = typeof VS_COMBINING_RULE | 'adjacent-products-v75';

/** v75/v76 saved records already used this exact rule before reconstruction. */
export function hasVsCombiningRule(flag?: string): flag is VsCombiningRule {
  return flag === VS_COMBINING_RULE || flag === 'adjacent-products-v75';
}

export type VsGroup = {
  id: string;
  side: Duelist;
  start: number;
  end: number;
  width: number;
  reels: number[];
  multiplier: number;
  /** Original per-reel values remain available for equations and replay. */
  members: ReelWild[];
};

type VsGroupRecord = {
  combining?: string;
  before: readonly ReelWild[];
  after: readonly ReelWild[];
};

function sortedMembers(wilds: readonly ReelWild[]): ReelWild[] {
  const members = wilds.map(member => ({ ...member })).sort((a, b) => a.reel - b.reel);
  for (let index = 0; index < members.length; index++) {
    const member = members[index]!;
    if (!Number.isInteger(member.reel) || member.reel < 0 || member.reel >= 5) {
      throw new RangeError('VS reel must be an integer from 0 through 4');
    }
    if (!Number.isFinite(member.multiplier) || !Number.isInteger(member.multiplier) || member.multiplier < 1) {
      throw new RangeError('VS multiplier must be a positive integer');
    }
    if (index && members[index - 1]!.reel === member.reel) {
      throw new RangeError('A VS reel can have only one owner');
    }
    if (member.duelist !== undefined && member.duelist !== 'king' && member.duelist !== 'vice') {
      throw new RangeError('VS side must be King or Vice');
    }
  }
  return members;
}

function makeGroup(members: ReelWild[]): VsGroup {
  // Old records predate recorded sides and used the King strip. Their visual
  // fallback remains King, but they do not combine without the explicit flag.
  const side = members[0]!.duelist ?? 'king';
  const start = members[0]!.reel;
  const end = members[members.length - 1]!.reel;
  return {
    id: `vs:${side}:${start}-${end}`,
    side, start, end, width: members.length,
    reels: members.map(member => member.reel),
    multiplier: members.reduce((product, member) => product * member.multiplier, 1),
    members,
  };
}

/** Canonical left-to-right contiguous runs. Neither gaps nor opposing sides bridge. */
export function groupVsReels(wilds: readonly ReelWild[]): VsGroup[] {
  const runs: ReelWild[][] = [];
  for (const member of sortedMembers(wilds)) {
    const previous = runs[runs.length - 1];
    const last = previous?.[previous.length - 1];
    if (last && last.reel + 1 === member.reel &&
        (last.duelist ?? 'king') === (member.duelist ?? 'king')) {
      previous!.push(member);
    } else {
      runs.push([member]);
    }
  }
  return runs.map(makeGroup);
}

/** Resolve an immutable saved record without upgrading its historical rules. */
export function vsGroupsFor(record: VsGroupRecord, phase: 'before' | 'after' = 'after'): VsGroup[] {
  const members = record[phase];
  return hasVsCombiningRule(record.combining)
    ? groupVsReels(members)
    : sortedMembers(members).map(member => makeGroup([member]));
}

/**
 * New records use each participating group's product once. Separate groups
 * retain the existing additive rule. Unmarked records retain the per-reel sum.
 */
export function vsLineMultiplier(wilds: readonly ReelWild[], reelCount: number, combining?: string): number {
  if (!hasVsCombiningRule(combining)) {
    return Math.max(1, wilds.filter(member => member.reel < reelCount)
      .reduce((total, member) => total + member.multiplier, 0));
  }
  const participating = groupVsReels(wilds).filter(group => group.reels.some(reel => reel < reelCount));
  return Math.max(1, participating.reduce((total, group) => total + group.multiplier, 0));
}
