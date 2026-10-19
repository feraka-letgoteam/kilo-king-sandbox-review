import kingManifest from '../../../public/kilo-v55/characters/king/rig.json';
import viceManifest from '../../../public/kilo-v55/characters/vice/rig.json';
import type { RigActor, RigPose } from './rig-performance';
import { CHARACTER_FACE_URLS } from './character-face';

export type RigPart = {
  frame: {x:number;y:number;w:number;h:number}; pivot:number[]; position:number[];
  rotation:number; parent:string|null; zOrder:number; optional?:boolean;
};
export type RigDefinition = {
  id:string; canvas:{width:number;height:number}; baseline:number; atlas:string;
  parts:Record<string,RigPart>; defaultHead:string; alternateHead?:string; defaultProp:boolean;
};
export type RigTransform = {x:number;y:number;rotation:number};
export const CHARACTER_RIGS: Record<RigActor,RigDefinition> = {king:kingManifest,vice:viceManifest};
export const CHARACTER_RIG_URLS = [...Object.values(CHARACTER_RIGS).map(r=>r.atlas),...CHARACTER_FACE_URLS];

/** Joint transforms are independent of painter order, so a far arm can stay
 * behind the chest while its child hand passes in front. */
export function rigTransforms(def:RigDefinition, pose:RigPose) {
  const result:Record<string,RigTransform>={};
  const active=new Set<string>();
  const resolve=(id:string):RigTransform=>{
    if(result[id])return result[id];
    if(active.has(id))throw new Error(`Cyclic character joint: ${id}`);
    active.add(id);
    const part=def.parts[id];if(!part)throw new Error(`Missing character joint: ${id}`);
    // Alternate face drawings occupy the same animated neck joint.
    const p=pose[id]??(id===def.alternateHead?pose[def.defaultHead]:undefined)??{rotation:0,x:0,y:0};
    const parent=part.parent?resolve(part.parent):{x:0,y:0,rotation:0};
    const x=part.position[0]!+p.x,y=part.position[1]!+p.y;
    result[id]={x:parent.x+Math.cos(parent.rotation)*x-Math.sin(parent.rotation)*y,
      y:parent.y+Math.sin(parent.rotation)*x+Math.cos(parent.rotation)*y,
      rotation:parent.rotation+part.rotation+p.rotation};
    active.delete(id);return result[id];
  };
  Object.keys(def.parts).forEach(resolve);return result;
}

export function visibleRigParts(def:RigDefinition, alternateHead=false) {
  const head=alternateHead&&def.alternateHead?def.alternateHead:def.defaultHead;
  return Object.entries(def.parts).filter(([id,p])=>
    id==='head'||id===def.alternateHead?id===head:!p.optional||(id==='prop'&&def.defaultProp))
    .sort((a,b)=>a[1].zOrder-b[1].zOrder);
}

