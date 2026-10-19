import { CHARACTER_LIFE_FPS } from './character-life';

/** One 30 fps presentation clock per visible actor group. No React renders,
 * no timeouts, and no background/off-screen animation work. */
export function createCharacterMotionLoop(target: Element, paint: (delta: number) => void, active: () => boolean, pauseBoundary?: Element|null) {
  let raf = 0, disposed = false, inView = true, last = 0, accumulated = 0;
  const available = typeof requestAnimationFrame === 'function' && typeof document !== 'undefined' && typeof document.addEventListener === 'function';
  // Decorative scene layers are permanently inert for accessibility. Only the
  // interactive game shell's modal lock should suspend this animation.
  const canRun = () => available && !disposed && inView && !document.hidden && !pauseBoundary?.hasAttribute('inert') && active();
  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; accumulated = 0; };
  const frame = (now: number) => {
    raf = 0; if (!canRun()) { last = 0; return; }
    accumulated += last ? Math.min(80, now - last) : 0; last = now;
    if (accumulated >= 1000 / CHARACTER_LIFE_FPS - .5) { const dt = accumulated; accumulated = 0; paint(dt); }
    if (canRun()) raf = requestAnimationFrame(frame);
  };
  const refresh = () => { if (!canRun()) stop(); else if (!raf) raf = requestAnimationFrame(frame); };
  const visibility = () => { if (document.hidden) stop(); else refresh(); };
  const preferences = available && typeof MutationObserver !== 'undefined' ? new MutationObserver(() => { paint(0); refresh(); }) : null;
  const observer = available && typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([entry]) => {
    inView = entry?.isIntersecting ?? false; refresh();
  }) : null;
  if (available) {
    document.addEventListener('visibilitychange', visibility); observer?.observe(target);
    // Menu/inert and the page's motion preference may change between spins.
    // Observe only these flags; animated styles cannot feed back into the loop.
    for (let node:Element|null=target;node;node=node.parentElement) preferences?.observe(node,{attributes:true,attributeFilter:['inert','data-reduced']});
  }
  refresh();
  return { refresh, destroy() { disposed = true; stop(); observer?.disconnect(); preferences?.disconnect(); if (available) document.removeEventListener('visibilitychange', visibility); } };
}
