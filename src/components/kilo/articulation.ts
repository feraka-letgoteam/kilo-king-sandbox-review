import { MeshSimple, type Sprite } from 'pixi.js';

type Point = { x: number; y: number };
export type ArtAction = 'hit' | 'land' | 'haul' | 'collector' | 'wild';
const unit = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const t = unit(n); return t * t * (3 - 2 * t); };
const region = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
  Math.exp(-(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2));

/** Local material motion, in illustration coordinates. A vertex field gives
 * the lid, shoulder, spool and loose edges their own response. It does not
 * move a cell, its printed value, a reel mask, or the number above a wild.
 * Every action has an exact, unwarped source pose at both endpoints. */
export function artVertexAt(x: number, y: number, symbol: string, progress: number,
  action: ArtAction = 'hit', strength = 1): Point {
  const t = unit(progress);
  if (t === 0 || t === 1) return { x, y };
  const load = smooth(t / .19) * (1 - smooth((t - .19) / .12));
  const drive = smooth((t - .19) / .14) * (1 - smooth((t - .40) / .25));
  const recovery = Math.sin(Math.PI * unit((t - .54) / .46)) * (1 - smooth((t - .54) / .46));
  const weight = strength * (action === 'land' ? .48 : action === 'haul' ? .72 : 1);
  const compression = (.035 * load - .068 * drive + .023 * recovery) * weight;
  const upper = 1 - smooth((y - .67) / .30);
  const royal = ['10', 'J', 'Q', 'K', 'A'].includes(symbol);
  let dx = 0, dy = 0;
  if (royal) {
    // Inked letters flex from their planted lower stroke. Their upper serif
    // carries the delayed recoil; this is not a whole-symbol zoom.
    const bend = (-.039 * load + .055 * drive - .022 * recovery) * weight;
    dx = bend * upper * upper + (x - .5) * compression * .42;
    dy = (.83 - y) * compression * 1.05;
  } else if (symbol === 'brick') {
    // Heavy wrapped cargo squats against its lower face. The binding stays
    // comparatively tight while the outer package takes the compression.
    const binding = 1 - region(x, y, .50, .53, .12, .7) * .42;
    dx = (x - .5) * compression * -.88 * binding;
    dy = (.82 - y) * compression * 1.10;
  } else if (symbol === 'keys') {
    const loose = region(x, y, .67, .30, .32, .35);
    dx = (-.025 * load + .057 * drive - .028 * recovery) * loose * weight;
    dy = (.025 * load - .061 * drive + .024 * recovery) * loose * weight;
    dy += (.72 - y) * compression * .55;
  } else if (symbol === 'duffel') {
    const lid = 1 - smooth((y - .42) / .22);
    dx = (-.025 * load + .050 * drive - .018 * recovery) * lid * weight;
    dy = (.022 * load - .052 * drive + .018 * recovery) * lid * weight;
  } else if (symbol === 'lamp' || symbol === 'cuffs') {
    // The metal housing stays rigid. Only the spool / buoy centre has a
    // restrained torsional response, with no rubber squash of the rim.
    const cx = symbol === 'lamp' ? .52 : .5, cy = .52;
    const r = region(x, y, cx, cy, .35, .35);
    const angle = (-.06 * load + .15 * drive - .055 * recovery) * r * weight;
    const xx = x - cx, yy = y - cy;
    dx = xx * Math.cos(angle) - yy * Math.sin(angle) - xx;
    dy = xx * Math.sin(angle) + yy * Math.cos(angle) - yy;
  } else if (symbol === 'splash' || symbol === 'bars' || action === 'wild') {
    // Shoulder compression and independent neck follow-through. The lower
    // composition, scene edges and feet remain fixed under a winning bust.
    const head = region(x, y, .53, .29, .23, .20);
    const chest = region(x, y, .5, .53, .35, .29);
    dx = (-.017 * load + .028 * drive - .013 * recovery) * (head + chest * .3) * weight;
    dy = (.023 * load - .035 * drive + .012 * recovery) * (head * 1.25 + chest * .45) * weight;
  }
  return { x: x + dx, y: y + dy };
}

type Rig = { mesh: MeshSimple; visible: boolean };
const rigs = new WeakMap<Sprite, Rig>();
const GRID = 8; // 64 vertices stays within Pixi's small-mesh batching limit.
const indices = new Uint32Array(Array.from({ length: (GRID - 1) ** 2 }, (_, i) => {
  const row = Math.floor(i / (GRID - 1)), col = i % (GRID - 1), a = row * GRID + col;
  return [a, a + 1, a + GRID, a + 1, a + GRID + 1, a + GRID];
}).flat());

export function restoreArticulation(sprite: Sprite) {
  const rig = rigs.get(sprite);
  if (!rig) return;
  if (!rig.mesh.destroyed) {
    rig.mesh.parent?.removeChild(rig.mesh);
    rig.mesh.destroy();
  }
  if (!sprite.destroyed) sprite.visible = rig.visible;
  rigs.delete(sprite);
}

/** Reuses the accepted source drawing / authored frame, never another asset.
 * The companion mesh occupies exactly the sprite's coordinate space. */
export function articulateArt(sprite: Sprite, symbol: string, progress: number,
  action: ArtAction = 'hit', strength = 1, bounds?: readonly number[]) {
  if (sprite.destroyed || !sprite.parent) return;
  if (progress <= 0 || progress >= 1) { restoreArticulation(sprite); return; }
  let rig = rigs.get(sprite);
  if (!rig || rig.mesh.destroyed || rig.mesh.parent !== sprite.parent) {
    restoreArticulation(sprite);
    const vertices = new Float32Array(GRID * GRID * 2), uvs = new Float32Array(vertices.length);
    for (let i = 0; i < GRID * GRID; i++) { uvs[i * 2] = i % GRID / (GRID - 1); uvs[i * 2 + 1] = Math.floor(i / GRID) / (GRID - 1); }
    const mesh = new MeshSimple({ texture: sprite.texture, vertices, uvs, indices });
    mesh.label = 'articulated-illustration'; mesh.eventMode = 'none';
    // Own this small geometry even when a resize destroys its parent before
    // the reaction can restore itself. Shared source textures are never freed.
    const geometry = mesh.geometry, destroy = mesh.destroy.bind(mesh);
    mesh.destroy = options => { if (mesh.destroyed) return; destroy(options); geometry.destroy(); };
    sprite.parent.addChildAt(mesh, sprite.parent.children.indexOf(sprite) + 1);
    rig = { mesh, visible: sprite.visible }; rigs.set(sprite, rig);
  }
  const { mesh } = rig, w = sprite.texture.width, h = sprite.texture.height;
  const [l, top, r, bottom] = bounds ?? [w * .10, h * .10, w * .90, h * .90];
  for (let i = 0; i < GRID * GRID; i++) {
    const x = i % GRID / (GRID - 1) * w, y = Math.floor(i / GRID) / (GRID - 1) * h;
    const p = artVertexAt((x - l) / (r - l), (y - top) / (bottom - top), symbol, progress, action, strength);
    mesh.vertices[i * 2] = l + p.x * (r - l) - sprite.anchor.x * w;
    mesh.vertices[i * 2 + 1] = top + p.y * (bottom - top) - sprite.anchor.y * h;
  }
  mesh.texture = sprite.texture;
  mesh.position.set(sprite.x, sprite.y); mesh.scale.set(sprite.scale.x, sprite.scale.y);
  mesh.rotation = sprite.rotation; mesh.alpha = sprite.alpha; mesh.visible = rig.visible;
  // Share a source-local mask when the accepted composition already has one.
  mesh.mask = sprite.mask;
  sprite.visible = false;
  Object.assign(mesh, { articulation: { symbol, action, progress, strength } });
}
