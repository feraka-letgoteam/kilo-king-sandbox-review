import manifest from '../../../public/kilo-overhaul-v1/symbols/runtime-manifest.json';
import type {AuthoredClip} from './authored-animation';

type Drawing={runtimeBase:string;runtimeGlow:string;runtimeAlphaBounds:number[];alphaBounds:number[]};
type DrawingManifest={symbols:Record<string,Drawing>;clips:Record<string,AuthoredClip>;desktopClips?:Record<string,AuthoredClip>};
const drawings=manifest as unknown as DrawingManifest;
export const OVERHAUL_ROOT='/kilo-overhaul-v1/';
export const OVERHAUL_SYMBOL_IDS:Readonly<Record<string,string>>={
  '10':'sym-10',J:'sym-j',Q:'sym-q',K:'sym-k',A:'sym-a',cuffs:'sym-bobber',keys:'sym-cash-roll',
  lamp:'sym-reel-v8',duffel:'sym-case-v8',bars:'scatter-king',splash:'collector',brick:'package-small',
};
export const overhaulSymbol=(id:string)=>drawings.symbols[id]!;
export const overhaulSymbolUrl=(id:string)=>OVERHAUL_ROOT+overhaulSymbol(id).runtimeBase;
export const overhaulGlowUrl=(id:string)=>OVERHAUL_ROOT+overhaulSymbol(id).runtimeGlow;
/** Source masters are 1024px; runtime bases are 512px. Frame registration must
 * describe the texture actually on the sprite, rather than its offline master. */
export const OVERHAUL_SYMBOL_CLIPS:Readonly<Record<string,AuthoredClip>>=Object.fromEntries(
  Object.entries(typeof window!=='undefined'&&window.innerWidth>=900?(drawings.desktopClips??drawings.clips):drawings.clips??{}).map(([id,clip])=>[id,{...clip,
    url:clip.url.startsWith('/')?clip.url:OVERHAUL_ROOT+clip.url,
    reference:{...clip.reference,width:512,height:512,bounds:clip.reference.bounds.map(n=>n/2) as [number,number,number,number]},
  }]),
);
