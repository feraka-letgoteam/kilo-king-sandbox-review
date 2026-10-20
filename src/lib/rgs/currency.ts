/**
 * The one amount formatter for server money. Input is integer micro-units.
 * Real-money mode shows the server currency's symbol and placement.
 * Social mode (stake.us, `social: true`): only the SC/GC suffixes are ever drawn. Any other code,
 * real-money or unknown, is shown as a bare number, so "$", "€" etc. can never appear.
 * Unknown codes warn once per code (console.warn); `strict: true` throws instead.
 */
import { MICRO } from "./types.ts";

type Style = { symbol: string; decimals: number; position: "prefix" | "suffix" };

/** Reviewer currencies (USD, EUR, CAD, MXN, JPY, XSC, XGC) plus common extras. */
const STYLES: Record<string, Style> = {
  USD: { symbol: "$", decimals: 2, position: "prefix" },
  EUR: { symbol: "€", decimals: 2, position: "prefix" },
  GBP: { symbol: "£", decimals: 2, position: "prefix" },
  CAD: { symbol: "CA$", decimals: 2, position: "prefix" },
  AUD: { symbol: "A$", decimals: 2, position: "prefix" },
  NZD: { symbol: "NZ$", decimals: 2, position: "prefix" },
  MXN: { symbol: "MX$", decimals: 2, position: "prefix" },
  BRL: { symbol: "R$", decimals: 2, position: "prefix" },
  JPY: { symbol: "¥", decimals: 0, position: "prefix" },
  KRW: { symbol: "₩", decimals: 0, position: "prefix" },
  INR: { symbol: "₹", decimals: 2, position: "prefix" },
  XSC: { symbol: "SC", decimals: 2, position: "suffix" },
  XGC: { symbol: "GC", decimals: 2, position: "suffix" },
};

export type FormatOptions = {
  /** "symbol" (default) shows the currency; "none" shows the bare number. */
  unit?: "symbol" | "none";
  /** Show a leading minus for negatives (net position). Default true. */
  signed?: boolean;
  /** Social mode: never show a real-money symbol, whatever code arrives. */
  social?: boolean;
  /** Throw CurrencyError on an unknown code (and on a real-money code in social mode) instead of warning. */
  strict?: boolean;
};

/** Codes that are safe to label in social mode. */
const SOCIAL_CODES: ReadonlySet<string> = new Set(["XSC", "XGC"]);

export class CurrencyError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "CurrencyError";
    this.code = code;
  }
}

const warned = new Set<string>();
function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}
/** Tests only: forget which codes already warned. */
export function resetCurrencyWarnings(): void {
  warned.clear();
}

export function isKnownCurrency(currency: string): boolean {
  return Object.prototype.hasOwnProperty.call(STYLES, currency.trim().toUpperCase());
}

/** Warns (or throws when strict) about codes we can't label safely. */
function vet(currency: string, opts: FormatOptions): void {
  const code = currency.trim().toUpperCase();
  if (!isKnownCurrency(code)) {
    const msg = `[rgs] unknown currency code "${code}"`;
    if (opts.strict) throw new CurrencyError(code, msg);
    warnOnce(`unknown:${code}`, msg);
  } else if (opts.social && !SOCIAL_CODES.has(code)) {
    const msg = `[rgs] real-money currency "${code}" in social mode; showing amount without a symbol`;
    if (opts.strict) throw new CurrencyError(code, msg);
    warnOnce(`social:${code}`, msg);
  }
}

function styleFor(currency: string, social = false): Style {
  const code = currency.trim().toUpperCase();
  const known = isKnownCurrency(code) ? STYLES[code] : undefined;
  if (social) {
    // Only SC/GC may be labelled; everything else keeps its decimals but loses the symbol.
    if (known && SOCIAL_CODES.has(code)) return known;
    return { symbol: "", decimals: known?.decimals ?? 2, position: "suffix" };
  }
  if (known) return known;
  // Unknown codes: the code after the amount with two decimals.
  return { symbol: code || "", decimals: 2, position: "suffix" };
}

/** Decimal places the currency normally shows. */
export function currencyDecimals(currency: string): number {
  return styleFor(currency).decimals;
}

/**
 * Decimals needed to show this micro amount exactly: the standard count, extended
 * up to 6 when the amount has sub-unit detail (sub-cent wins, guideline [273]).
 */
export function exactDecimals(micro: number, standard: number): number {
  let d = Math.max(0, Math.min(6, standard));
  while (d < 6 && micro % 10 ** (6 - d) !== 0) d += 1;
  return d;
}

function group(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Number text only, grouped with commas, exact to the micro-unit. */
export function formatNumber(micro: number, currency: string): string {
  if (!Number.isSafeInteger(micro)) throw new RangeError("amount must be an integer number of micro-units");
  const abs = Math.abs(micro);
  const std = currencyDecimals(currency);
  const whole = Math.floor(abs / MICRO);
  const frac = abs % MICRO;
  // Zero-decimal currencies still show sub-unit detail rather than hiding a real win.
  const d = exactDecimals(abs, std);
  const fracText = d > 0 ? `.${String(frac).padStart(6, "0").slice(0, d)}` : "";
  return `${group(String(whole))}${fracText}`;
}

export function formatAmount(micro: number, currency: string, opts: FormatOptions = {}): string {
  const { unit = "symbol", signed = true, social = false } = opts;
  vet(currency, opts);
  const body = formatNumber(micro, currency);
  const minus = signed && micro < 0 ? "-" : "";
  if (unit === "none") return `${minus}${body}`;
  const style = styleFor(currency, social);
  if (!style.symbol) return `${minus}${body}`;
  return style.position === "prefix" ? `${minus}${style.symbol}${body}` : `${minus}${body} ${style.symbol}`;
}

/** Characters a Pixi numeral font must contain to draw any formatted amount. */
export function glyphsNeeded(currencies: readonly string[], social = false): string {
  const set = new Set("0123456789,.- ");
  for (const c of currencies) for (const ch of styleFor(c, social).symbol) set.add(ch);
  return [...set].sort().join("");
}
