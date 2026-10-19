import { Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { characterPoseAt, type RigAction, type RigActor } from './rig-performance';
import { CHARACTER_RIGS, rigTransforms, visibleRigParts } from './character-rig-model';
import { characterIdleAt, type CharacterLifeFrame } from './character-life';
import { KING_BLINK } from './character-face';
export { CHARACTER_RIG_URLS } from './character-rig-model';
// Finite shared crops: two actors, at most nine parts each. Repaints reuse these.
const partTextures=new Map<string,Texture>();
const faceTextures=new Map<string,Texture>();

export function createCharacterRig(actor:RigActor) {
  const def=CHARACTER_RIGS[actor],root=new Container();root.label=`rig-${actor}`;
  root.eventMode='none';
  let sheet=Assets.get<Texture>(def.atlas);
  let disposed=false;
  const sprites=new Map<string,Sprite>();
  let action:RigAction='rest',progress=0,expressive=false;
  let life:CharacterLifeFrame|null=null;
  function paint() {
    if(disposed||root.destroyed||!sheet)return;
    const pose=life?.pose??characterPoseAt(actor,action,progress),transforms=rigTransforms(def,pose);
    const visible=new Set(visibleRigParts(def,life?.expressive??expressive).map(([id])=>id));
    for(const [id,sprite] of sprites){const t=transforms[id]!;sprite.position.set(t.x,t.y);
      sprite.rotation=t.rotation;sprite.visible=visible.has(id);
      if(actor==='king'&&id==='head')sprite.texture=faceTextures.get(life?.blink??'open')??partTextures.get(`${def.atlas}:head`)!;
    }
  }
  function install(texture:Texture) {
    if(disposed||root.destroyed)return;sheet=texture;
    for(const [id,p] of Object.entries(def.parts).sort((a,b)=>a[1].zOrder-b[1].zOrder)){
      const f=p.frame,key=`${def.atlas}:${id}`;
      let t=partTextures.get(key);if(!t||t.source!==texture.source){t=new Texture({source:texture.source,frame:new Rectangle(f.x,f.y,f.w,f.h)});partTextures.set(key,t);}
      const sprite=new Sprite(t);sprite.label=`joint-${id}`;
      sprite.pivot.set(p.pivot[0]!,p.pivot[1]!);root.addChild(sprite);sprites.set(id,sprite);
    }
    paint();
  }
  if(sheet)install(sheet);else void Assets.load<Texture>(def.atlas).then(install).catch(()=>{});
  if(actor==='king'){
    const installFace=(texture:Texture)=>{
      if(disposed||root.destroyed)return;
      for(const [state,f] of Object.entries(KING_BLINK.states)){
        if(faceTextures.get(state)?.source!==texture.source)faceTextures.set(state,new Texture({source:texture.source,frame:new Rectangle(f.x,f.y,f.w,f.h)}));
      }
      paint();
    };
    const texture=Assets.get<Texture>(KING_BLINK.atlas);
    if(texture)installFace(texture);else void Assets.load<Texture>(KING_BLINK.atlas).then(installFace).catch(()=>{});
  }
  return {root,definition:def,
    pose(next:RigAction,t=0,head=false){life=null;action=next;progress=t;expressive=head;paint();},
    idle(elapsed:number,variant=0,reduced=false){life=reduced?{pose:{},blink:'open',expressive:false}:characterIdleAt(actor,elapsed,variant);paint();},
    perform(frame:CharacterLifeFrame){life=frame;paint();},
    dispose(){if(disposed)return;disposed=true;root.destroy({children:true});},
  };
}
