import type { Graphics } from 'pixi.js';
import type { godCardPose } from './god-card-motion';

type Pose = ReturnType<typeof godCardPose>;
type Point = { x: number; y: number };
const clamp = (n: number) => Math.max(0, Math.min(1, n));

/** Water is attached to registered hull contacts, not to the card's border.
 * A fixed set of tapered foam ribbons expands under thrust and falls flat
 * under braking. No emitters, random particles, filters or persistent loops. */
export function paintGodWater(foam: Graphics, bow: Graphics, pose: Pose,
  stern: Point, prow: Point, width: number, height: number, flow: number) {
  foam.clear(); bow.clear();
  if (pose.wake < .001 && pose.spray < .001) return;
  const power = pose.spray, reach = width * (.10 + .25 * power);
  const spread = height * (.014 + .088 * power);
  // A connected, scalloped pressure sheet gives the wash a body. The small
  // ribbons below are its breaking edges, not six disconnected spray sprites.
  for(const side of [-1,1]){
    const y=stern.y+side*spread*.12;
    foam.moveTo(stern.x,y)
      .quadraticCurveTo(stern.x-reach*.18,y+side*spread*.75,stern.x-reach*.52,y+side*spread*.62)
      .quadraticCurveTo(stern.x-reach*.73,y+side*spread*.23,stern.x-reach,y+side*spread*.82)
      .lineTo(stern.x-reach*.79,y+side*spread*.22)
      .quadraticCurveTo(stern.x-reach*.27,y+side*spread*.24,stern.x,y)
      .fill({color:side<0?0xb8fff0:0x55c4d4,alpha:.42*pose.wake});
  }
  // Six broad ribbons read as aerated propwash at phone size. Each taper is
  // transparent at birth/death, so its movement has no visible wrap seam.
  for (let lane = 0; lane < 8; lane++) {
    const u = ((flow + lane / 8) % 1 + 1) % 1;
    const envelope = Math.sin(Math.PI * u);
    const side = lane % 2 ? 1 : -1;
    const x = stern.x - reach * u, y = stern.y + side * spread * u;
    const length = width * (.027 + .049 * power) * envelope;
    const thickness = Math.max(1, height * .016 * power * envelope);
    foam.poly([x, y, x - length * .38, y - thickness,
      x - length, y - thickness * .20, x - length * .62, y + thickness * .35,
      x - length * .18, y + thickness * .7])
      .fill({ color: lane % 3 ? 0xe4fff1 : 0x69cdd7, alpha: .86 * pose.wake * envelope });
  }
  // Two narrow continuous jets bind the travelling foam to the outboards.
  for (const side of [-1, 1]) {
    const reachX = stern.x - reach * .74, spreadY = spread * .58 * side;
    foam.poly([stern.x + width * .005, stern.y, stern.x - reach * .22, stern.y + spreadY * .38,
      reachX, stern.y + spreadY, stern.x - reach * .37, stern.y + spreadY * .18])
      .fill({ color: 0xd6fff4, alpha: .44 * pose.wake });
  }
  // The forward cushion grows during braking/stall. Its two sharp contours
  // remain visible when an early stop only exposes the leading card edge.
  const brake = clamp(pose.pitch / .13);
  for (let ring = 0; ring < 2; ring++) {
    const radiusX = width * (.045 + .023 * ring + .018 * brake);
    const radiusY = height * (.024 + .012 * ring + .018 * brake);
    const points: number[] = [];
    for (let i = 0; i <= 12; i++) {
      const theta = -Math.PI * .44 + i / 12 * Math.PI * .88;
      points.push(prow.x + Math.cos(theta) * radiusX, prow.y + Math.sin(theta) * radiusY);
    }
    bow.moveTo(points[0]!, points[1]!);
    for (let i = 2; i < points.length; i += 2) bow.lineTo(points[i]!, points[i + 1]!);
    bow.stroke({ color: ring ? 0x9ddbd5 : 0xe7fff4,
      width: Math.max(1.3, width * (.0028 - ring * .0007)),
      alpha: pose.wake * (ring ? .40 : .82) });
  }
}
