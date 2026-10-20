import { useContext, useRef, useState, type CSSProperties, type Ref } from 'react';
import { ArrowLeft, Minus, Plus, X } from 'lucide-react';
import { splashCost, isPurchaseMode, type PurchaseMode } from '@/lib/kilo/engine';
import { STAKES, purchaseQuote } from './control-model';
import { FEATURES, type BonusFeature } from './feature-catalog';
import { PanelDismissContext } from './control-panels';
import { PURCHASE_PRESENTATION } from './feature-presentation';
import { canActivateMax } from './max-spin-mode';
import './feature-takeover.css';
import { t } from '@/lib/kilo/copy';

const amount = (n: number) => Math.round(n).toLocaleString('en-US');
type PurchaseFeature = Extract<BonusFeature, { kind: 'purchase' }> & { mode: Exclude<PurchaseMode, 'chopper'> };
export type FeatureView = 'features' | PurchaseMode;
export type FeatureTakeoverProps = {
  stake: number; bank: number; ante: boolean;
  anteRestriction?: { hidden: boolean; disabled: boolean; reason?: string };
  anteOnly?: boolean; locked: boolean; onAnte: (on: boolean) => void;
  onEditBet: () => void; onStake: (stake: number) => void;
  onBuy: (mode: PurchaseMode) => void; onClose: () => void; reducedMotion?: boolean;
  maxActive?: boolean; onMaxMode?: (active: boolean) => void;
};
/** Catalogue changes never bypass the existing quote + explicit confirmation. */
export function FeatureTakeover(props: FeatureTakeoverProps) {
  const [view, setView] = useState<FeatureView>('features');
  const submitted = useRef(false), contentRef = useRef<HTMLDivElement>(null);
  const dismiss = useContext(PanelDismissContext) ?? props.onClose;
  const navigate = (next: FeatureView) => {
    submitted.current = false; setView(next);
    requestAnimationFrame(() => contentRef.current?.focus({ preventScroll: true }));
  };
  const confirm = () => {
    if (!isPurchaseMode(view) || view === 'chopper' || submitted.current || props.locked || props.anteOnly) return;
    if (!purchaseQuote(props.stake, view, props.bank).allowed) return;
    if (view === 'getaway') {
      if (!canActivateMax(props.stake, props.bank, props.locked, props.anteOnly)) return;
      submitted.current = true; props.onMaxMode?.(true); return;
    }
    submitted.current = true; props.onBuy(view);
  };
  return <FeatureTakeoverView {...props} view={view} onView={navigate} onConfirm={confirm} onClose={dismiss} contentRef={contentRef}/>;
}
export function FeatureTakeoverView({ stake, bank, ante, anteRestriction = { hidden: false, disabled: false }, anteOnly = false,
  locked, onAnte, onStake, onEditBet, onClose, view, onView, onConfirm, contentRef, reducedMotion = false, maxActive = false, onMaxMode,
}: FeatureTakeoverProps & { view: FeatureView; onView: (view: FeatureView) => void; onConfirm: () => void; contentRef?: Ref<HTMLDivElement> }) {
  const index = STAKES.indexOf(stake as typeof STAKES[number]);
  const purchases = FEATURES.filter((f): f is PurchaseFeature => f.kind === 'purchase' && f.mode !== 'chopper');
  const selected = purchases.find(f => f.mode === view);
  const quote = selected ? purchaseQuote(stake, selected.mode, bank) : null;
  const selectedArt = selected ? PURCHASE_PRESENTATION[selected.mode] : null;
  const anteCost = splashCost(stake, 'ante');
  const confirmReason = anteOnly ? 'Unavailable in this jurisdiction' : quote?.reason;
  return <div className="kf-shell" data-reduced={reducedMotion} data-confirming={!!selected}>
    <header className="kf-header">
      {selected && <button className="kf-back" onClick={() => onView('features')} aria-label="Back to features"><ArrowLeft/></button>}
      <h1>{selected ? selected.mode === 'getaway' ? 'Activate Max spins' : 'Confirm feature' : 'Choose your feature'}</h1>
      <button className="kf-close" onClick={onClose} aria-label="Close features"><X/></button>
    </header>
    <div className="kf-content" ref={contentRef} tabIndex={-1} data-view={view}>
      <div className="kf-catalogue" aria-hidden={selected ? true : undefined} inert={selected ? true : undefined}>
        {!anteRestriction.hidden && <div className="kf-ante" role="group" aria-label={t('label.anteBet')}>
          <div className="kf-ante-emblem" aria-hidden="true"><img src={PURCHASE_PRESENTATION.buy.art} alt=""/></div>
          <div className="kf-ante-copy"><strong>Bonus chance</strong><span>{t('takeover.anteSubtitle')}</span></div>
          <div className="kf-ante-cost"><strong>{amount(anteCost)}</strong><span>per spin</span></div>
          <button className="kf-ante-toggle" aria-pressed={ante} disabled={locked || !!selected || anteRestriction.disabled} onClick={() => onAnte(!ante)}>{ante ? 'Deactivate' : 'Activate'}<span className="kf-sr"> · Ante {ante ? 'On' : 'Off'}</span></button>
          {anteRestriction.reason && <p className="kf-reason">{anteRestriction.reason}</p>}
        </div>}
        {!anteOnly && <div className="kf-grid">
          {purchases.map(feature => {
            const q = purchaseQuote(stake, feature.mode, bank), visual = PURCHASE_PRESENTATION[feature.mode];
            return <article className="kf-card" data-feature={feature.mode} key={feature.id} style={{ '--feature-accent': visual.accent } as CSSProperties}>
              <div className="kf-art-wrap"><img className="kf-art" src={visual.art} alt="" decoding="async"/><span className="kf-art-title" aria-hidden="true">{feature.mode === 'getaway' ? 'MAX' : feature.mode === 'yacht' ? 'VS' : feature.mode === 'mystery' ? '?' : 'CATCH'}</span></div>
              <div className="kf-card-copy"><span className="kf-kicker">{visual.kicker}</span><h2>{feature.title}</h2><p className={feature.mode === 'getaway' ? 'kf-summary kf-warning' : 'kf-summary'}>{visual.summary}</p></div>
              <div className="kf-purchase-row">
                <div className="kf-price"><strong>{amount(q.cost)}</strong><span>{feature.multiple.toLocaleString('en-US')}× {t('unit.baseBet')}{feature.mode === 'getaway' ? ' / spin' : ''}</span></div>
                <button className="kf-action" disabled={locked || !!selected || (!q.allowed && !(feature.mode === 'getaway' && maxActive))} data-feature-action={feature.mode} onClick={() => feature.mode === 'getaway' && maxActive ? onMaxMode?.(false) : onView(feature.mode)}>{feature.mode === 'getaway' && maxActive ? 'Deactivate' : q.reason || (feature.mode === 'getaway' ? 'Activate' : t('takeover.buy'))}</button>
              </div>
            </article>;
          })}
        </div>}

      </div>
      {selected && quote && selectedArt && <div className="kf-confirm-shade"><section className="kf-confirm" data-feature={selected.mode} data-testid="purchase-confirmation" style={{ '--feature-accent': selectedArt.accent } as CSSProperties}>
        <div className="kf-confirm-hero"><img className="kf-confirm-art" src={selectedArt.art} alt=""/></div>
        <div className="kf-confirm-copy"><p className="kf-kicker">{selectedArt.kicker}</p><h2>{selected.title}</h2>
          <p className={selected.mode === 'getaway' ? 'kf-warning kf-summary' : 'kf-summary'}>{selectedArt.summary}</p>
          <p className="kf-confirm-detail">{selectedArt.confirmation}</p></div>
        <dl className="kf-confirm-wallet"><div><dt>{t('label.baseBet')}</dt><dd>{amount(stake)}</dd></div><div><dt>Balance</dt><dd>{amount(bank)}</dd></div><div className="kf-confirm-cost"><dt>{selected.mode === 'getaway' ? 'Cost per spin' : t('label.purchaseCost')}</dt><dd>{amount(quote.cost)}</dd></div></dl>
        <div className="kf-confirm-actions"><p className="kf-confirm-note">{selected.mode === 'getaway' ? t('takeover.maxNote') : 'Charged once when you confirm.'}</p>
          <button className="kf-action" data-testid="confirm-purchase" disabled={locked || anteOnly || !quote.allowed} onClick={onConfirm}>{confirmReason || (selected.mode === 'getaway' ? 'Activate Max spins' : t('label.confirmPurchase'))}</button>
          <button className="kf-cancel" onClick={() => onView('features')}>Cancel</button></div>
      </section></div>}
    </div>
    <footer className="kf-footer" inert={selected ? true : undefined} aria-hidden={selected ? true : undefined}>
      <div className="kf-wallet"><span>Balance</span><strong>{amount(bank)}</strong></div>
      <div className="kf-bet" role="group" aria-label={t('bet.featureGroup')}>
        <button aria-label={t('bet.featureDecrease')} disabled={locked || !!selected || index <= 0} onClick={() => onStake(STAKES[index - 1]!)}><Minus/></button>
        <button className="kf-bet-value" aria-label={t('bet.featureChangeAria')(amount(stake))} aria-haspopup="dialog" disabled={locked || !!selected} onClick={onEditBet}><span>{t('label.baseBet')}</span><strong>{amount(stake)}</strong></button>
        <button aria-label={t('bet.featureIncrease')} disabled={locked || !!selected || index < 0 || index >= STAKES.length - 1} onClick={() => onStake(STAKES[index + 1]!)}><Plus/></button>
      </div>
    </footer>
  </div>;
}
