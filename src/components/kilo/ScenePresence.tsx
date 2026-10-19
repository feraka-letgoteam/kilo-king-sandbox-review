import { useEffect, useRef, useState, type ReactNode } from 'react';

/** A paint-only exit tail. The engine completes its phase on the original
 * clock; the outgoing illustration cannot capture input or extend a round. */
export function ScenePresence({visible,reduced,children}:{visible:boolean;reduced:boolean;children:ReactNode}) {
  const [retained,setRetained]=useState(visible);
  const last=useRef<ReactNode>(null);
  if(visible)last.current=children;
  useEffect(()=>{
    if(visible){setRetained(true);return;}
    if(reduced){setRetained(false);return;}
    const timer=window.setTimeout(()=>setRetained(false),220);
    return()=>window.clearTimeout(timer);
  },[visible,reduced]);
  if(!visible&&!retained)return null;
  return <div className="kk-scene-presence" data-visible={visible} data-reduced={reduced}
    aria-hidden={!visible||undefined} inert={!visible||undefined}>{visible?children:last.current}</div>;
}
