import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { boatPerformance, type BoatBeat } from './max-boat-performance';
import { MAX_STAGE_WATER } from './max-stage-surface';

const partFrames=new WeakMap<Texture,Texture[]>();
function registeredFrames(parts:Texture) {
  let frames=partFrames.get(parts);
  if(!frames){
    frames=[[512,730,580,210],[40,550,420,450],...[0,1,2].map(i=>[i*512,128,512,405])]
      .map(([x,y,w,h])=>new Texture({source:parts.source,frame:new Rectangle(x!,y!,w!,h!)}));
    partFrames.set(parts,frames);
  }
  return frames;
}

/** Registered parts, in the original 1600×960 artwork's coordinate space. */
export function createMaxBoatRig(hull:Texture,parts:Texture) {
  const root=new Container(),body=new Container();root.label='getaway-physical-vessel';
  const contact=new Graphics();contact.label='getaway-water-contact';root.addChild(contact);
  const frames=registeredFrames(parts);
  const wake=new Sprite(frames[0]!);wake.label='getaway-propwash';
  // The broad foam meets the stern; the taper trails LEFT. Its waterline sits
  // below the hull so thrust remains visible inside the existing reel mask.
  wake.anchor.set(0,.5);wake.position.set(440,770);wake.width=520;wake.height=150;root.addChild(body);
  body.pivot.set(800,600);body.position.set(800,600);
  const motors=new Sprite(frames[1]!);motors.label='getaway-outboards';
  motors.anchor.set(.5,.35);motors.position.set(190,400);motors.width=300;motors.height=420;body.addChild(motors);
  const driver=new Container();driver.label='getaway-driver';driver.position.set(866,427);body.addChild(driver);
  const poses=[0,1,2].map(i=>{
    const s=new Sprite(frames[i+2]!);s.anchor.set(.5,1);s.width=450;s.height=350;driver.addChild(s);return s;
  });
  const shell=new Sprite(hull);shell.label='getaway-hull';shell.width=1600;shell.height=960;body.addChild(shell);
  const immersion=new Graphics();immersion.label='getaway-hull-immersion';
  // The water occludes the keel only. Foam is above that plane, so it cannot
  // disappear under the old rectangular immersion cover.
  root.addChild(immersion,wake);
  return {root,pose(beat:BoatBeat,t:number){
    const p=boatPerformance(beat,t);body.rotation=p.pitch;body.position.y=600+p.heave;
    motors.rotation=p.motor;driver.rotation=p.driverLean;
    const active=p.brake>.12?1:p.thrust>.16?2:0;
    // Whole rider group counter-leans around its fixed waist; never translate
    // the rider away from the cockpit. Existing three drawings remain intact.
    poses.forEach((s,i)=>s.visible=i===active);
    wake.width=520*p.wakeLength;wake.height=150*p.wakeHeight;
    wake.scale.x=-Math.abs(wake.scale.x);
    wake.position.set(440-p.wakeTrail,770+p.heave*.35);
    wake.rotation=0;
    wake.alpha=p.wake;wake.visible=p.wake>0;
    // Tight waterline contact and a short braking ripple, attached to the
    // vessel's water plane rather than the pitching body. No ambient particles.
    contact.clear().ellipse(830,809,555,17).fill({color:0x03141e,alpha:.24});
    const ring=beat==='settle'?t:0;
    if(p.wake>0) contact.ellipse(830,809,540+ring*95,14+ring*18)
      .stroke({color:0xa3ccc9,width:2,alpha:p.wake*.26*(1-ring)});
    // Water stays level while the hull pitches. Hide only its submerged keel;
    // the slight waterline response is separate from hull/rider rotation.
    const line=808;
    immersion.clear().rect(0,line,1600,960-line).fill(MAX_STAGE_WATER)
      .moveTo(415,line).lineTo(1390,line)
      .stroke({color:0x8dbbbd,width:1.8,alpha:.12+.18*p.wake});
  }};
}
