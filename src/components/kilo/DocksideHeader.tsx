import { useId } from 'react';
import type { GameLayout } from './layout';
import { docksideHeaderLayout, docksideHeaderPaint, type DocksideHeaderState } from './dockside-header-art';

export function DocksideHeader({state,layout,reduced}:{state:DocksideHeaderState;layout:GameLayout;reduced:boolean}) {
  const id=useId().replace(/[^a-zA-Z0-9]/g,'');
  const box=docksideHeaderLayout(layout.reelWidth,layout.header,layout.mode==='portrait');
  if(layout.compact)return null;
  return <div className="kk-dockside-header" data-holding={state.holding} data-reduced={reduced}
    role="status" aria-label={`Dockside Catch. ${state.left} spins. Collect multiplier ${state.mult}. ${state.filled} of 4 collectors.`}
    style={{width:box.width,height:box.height,top:box.top}}>
    <svg width={box.width} height={box.height} viewBox={`0 0 ${box.width} ${box.height}`} aria-hidden="true"
      dangerouslySetInnerHTML={{__html:docksideHeaderPaint(state,box,`dock-${id}`)}}/>
  </div>;
}
