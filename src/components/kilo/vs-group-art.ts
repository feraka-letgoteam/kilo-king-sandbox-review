import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { VsGroup } from '@/lib/kilo/vs-groups';
import { vsMultiplierPunch } from './vs-merge-motion';
import { createWinNumeral, WIN_TYPE } from './win-type';
import { WILD_REST, type WildArtPose } from './event-performance';
import { articulateArt } from './articulation';

export const VS_MULTIPLIER_FONT = WIN_TYPE.fontFamily;
export const VS_FONT_URL = '/kilo-ui-v11/KiloDisplay.woff';
export const VS_GROUP_ART_URLS = ['king', 'vice'].flatMap(side =>
  Array.from({length: 5}, (_, index) => `/kilo-overhaul-v1/features/vs/runtime/${side}-${index + 1}.webp`));
export const vsGroupArtUrl = (group: Pick<VsGroup, 'side'|'width'>) =>
  `/kilo-overhaul-v1/features/vs/runtime/${group.side}-${group.width}.webp`;

/** A clean open numeral, not a detached UI plaque. Never owns an award. */
export function createVsMultiplierLabel(value: string, size: number, color: number = WIN_TYPE.face) {
  return createWinNumeral(value, size, color);
}

export type VsGroupArt = Container & {vsGroup: VsGroup};
type Geometry = {gx: number; gy: number; cell: number; gap: number};

/** Each width has its own continuous composition. Its pixels are never tiled. */
export function createVsGroupArt(group: VsGroup, g: Geometry,
  texture: Texture | undefined, fallback?: Texture) {
  const root = new Container() as VsGroupArt;
  root.label = 'vs-group-art';
  root.vsGroup = {...group, reels: [...group.reels], members: group.members.map(w => ({...w}))};
  const width = group.width * g.cell + (group.width - 1) * g.gap, height = g.cell * 3;
  root.position.set(g.gx + group.start * (g.cell + g.gap), g.gy);
  // Opaque backing also covers the inter-reel gaps. Underlying symbol strips
  // are separately concealed; this is not being used as a substitute for that.
  root.addChild(new Graphics().rect(0, 0, width, height).fill(0x020b10));
  if (texture || fallback) {
    const art = new Sprite((texture ?? fallback)!);
    art.label = `vs-${group.side}-${group.width}-composition`;
    art.anchor.set(.5, 1);
    art.position.set(width / 2, height - 2); art.width = width - 4; art.height = height - 4;
    const clip = new Graphics().rect(2, 2, width - 4, height - 4).fill(0xffffff);
    clip.label = 'vs-composition-mask';
    root.addChild(art, clip); art.mask = clip;
  }
  const edge = group.side === 'king' ? 0xd8b66f : 0x89e6d9;
  root.addChild(new Graphics().rect(1, 1, width - 2, height - 2)
    .stroke({color: edge, width: 2}));
  const size = g.cell * (group.width === 1 ? .48 : .52);
  const number = createVsMultiplierLabel(`×${group.multiplier}`, size);
  number.label = 'vs-group-multiplier';
  const available = width - Math.max(12, g.cell * .16);
  if (number.width > available) number.style.fontSize = size * available / number.width;
  number.position.set(width / 2, height * .855);
  root.addChild(number);
  // Retain this addressable node for old replay tools, without visible WILD copy.
  const caption = createVsMultiplierLabel('', 1, edge);
  caption.label = 'vs-group-wild-label'; root.addChild(caption);
  return root;
}

/** A bounded response of the illustration, not a moving/scaling reel. */
export function performVsGroupArt(root: Container, g: Geometry, pose: WildArtPose = WILD_REST) {
  const group = (root as VsGroupArt).vsGroup;
  if (!group) return;
  const art = root.children.find(node => node.label === `vs-${group.side}-${group.width}-composition`) as Sprite | undefined;
  if (!art) return;
  const width = group.width * g.cell + (group.width - 1) * g.gap, height = g.cell * 3;
  // Most response now belongs to the shoulders / neck, rather than zooming
  // the entire painted marina behind the character. The frame stays fixed.
  art.width = (width - 4) * (1 + (pose.x - 1) * .34);
  art.height = (height - 4) * (1 + (pose.y - 1) * .34);
  art.position.set(width / 2, height - 2 + g.cell * pose.lift * .38);
  art.rotation = pose.turn * .35;
  articulateArt(art, 'splash', pose.progress ?? 1, 'wild', 1.55);
}

/** The connection's existing trace/reveal clocks drive one finite punch. */
export function vsConnectionMultiplierScale(trace: number, reveal: number, reduced = false) {
  if (reduced) return 1;
  const unit = (n: number) => Math.max(0, Math.min(1, n));
  const progress = trace < 1 ? unit((trace - .62) / .38) * .38 : .38 + unit(reveal) * .62;
  return vsMultiplierPunch(progress);
}
