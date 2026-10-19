import { useLayoutEffect, useRef, useState } from 'react';
import { FEATURE_ART } from './feature-presentation';
import { AuthoredArt } from './AuthoredArt';
import { ImpactPrint } from './ImpactPrint';
type Props = { name: string; feature?: string; payout: number; cost: number | null; maxed: boolean; reducedMotion?: boolean; onContinue: () => void };
const money = (n: number) => Math.round(n).toLocaleString('en-US');
/** A compact result rail inside the existing board, never a replacement scene. */
export function ReelFeatureCompletion({ name, feature, payout, cost, maxed, reducedMotion=false, onContinue }: Props) {
  const ref = useRef<HTMLElement>(null), button = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 320, visibility: 'hidden' as 'hidden' | 'visible' });
  useLayoutEffect(() => {
    const board = document.querySelector<HTMLElement>('[data-testid="reel-host"]');
    if (!board) return;
    const update = () => {
      const b = board.getBoundingClientRect(), width = Math.min(560, b.width - 24);
      setPosition({ left: b.left + (b.width - width) / 2, top: b.bottom - (ref.current?.offsetHeight || 90) - 12, width, visibility: 'visible' });
    };
    update(); const observer = new ResizeObserver(update); observer.observe(board); if (ref.current) observer.observe(ref.current);
    window.addEventListener('resize', update); window.addEventListener('scroll', update, true); button.current?.focus();
    return () => { observer.disconnect(); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, []);
  const emblem = FEATURE_ART[feature as keyof typeof FEATURE_ART] ?? FEATURE_ART.dock;
  return <section ref={ref} className="kk-reel-completion" data-reduced={reducedMotion} data-feature={feature} data-result={payout ? 'win' : 'loss'} style={position} role="dialog" aria-label={`${name} complete`} aria-modal="false" data-testid="feature-summary">
    {payout>=(cost??1)&&<ImpactPrint/>}
    <div><p>{feature==='yacht'?<AuthoredArt className="kk-completion-crest" clipKey="completion" fallback="/kilo-v79/surfaces/completion.webp" duration={640} reduced={reducedMotion} active={payout>=(cost??1)}/>:<img src={emblem} alt=""/>}{maxed ? 'Maximum win' : payout ? `${name} complete` : 'No win'}</p><strong>{money(payout)}</strong>{cost != null && <small>Purchase cost {money(cost)}</small>}</div>
    <button ref={button} onClick={onContinue}>Continue</button>
  </section>;
}
