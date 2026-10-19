import type { GameLayout } from './layout';
export const KILO_BRAND = {
  wide:'/kilo-v79/surfaces/logo-wide.webp',
  stacked:'/kilo-v79/surfaces/logo-stacked.webp',
} as const;
export type BrandBox={x:number;y:number;width:number;height:number;variant:keyof typeof KILO_BRAND};

/** One measured logo box per layout; it never measures or moves the game. */
export function gameBrandBox(layout:GameLayout,feature=false):BrandBox|null {
  if(layout.compact)return null;
  if(layout.artLeft>0){
    // Cabinet art extends 22px outside the reel. Reserve that plus clearance.
    const width=Math.min(228,layout.artLeft-46);
    return {x:(layout.artLeft-width-30)/2,y:layout.header+16,width,height:width*526/640,variant:'stacked'};
  }
  const reelLeft=layout.mode==='landscape'?layout.controlLeft+layout.dockGap:0;
  if(layout.mode==='landscape'){
    // Feature landscape uses the brand's existing reserved grid cell in HUD.
    if(feature)return null;
    return {x:reelLeft+6,y:2,width:Math.min(154,layout.reelWidth*.38),height:38,variant:'wide'};
  }
  const portrait=layout.mode==='portrait';
  const width=feature?(portrait?82:96):Math.min(layout.reelWidth-32,portrait?220:250);
  return {x:reelLeft+(layout.reelWidth-width)/2,y:feature?1:4,width,
    height:feature?(portrait?26:30):(portrait?60:76),variant:'wide'};
}
