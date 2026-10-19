import { purchaseQuote } from './control-model';
import type { SplashScript } from '@/lib/kilo/engine';

/** Activation is a UI selection, never a debit or an outcome request. */
export function canActivateMax(stake: number, balance: number, locked = false, restricted = false) {
  return !locked && !restricted && purchaseQuote(stake, 'getaway', balance).allowed;
}

/** Max is a repeatable paid-spin mode, not a free-spin session. */
export function isMaxSpinRound(round: Pick<SplashScript, 'version' | 'feature'>) {
  return round.version === 4 && round.feature === 'getaway';
}
