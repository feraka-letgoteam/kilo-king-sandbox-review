/**
 * The one amount formatter for server money. Input is integer micro-units.
 * Real-money mode shows the server currency's symbol and placement.
 * Social mode (stake.us) follows New Bot's copy guide; use unit "none" or the SC/GC suffix there, never "$".
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
};

function styleFor(currency: string): Style {
  const code = currency.trim().toUpperCase();
  const known = STYLES[code];
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
  const { unit = "symbol", signed = true } = opts;
  const body = formatNumber(micro, currency);
  const minus = signed && micro < 0 ? "-" : "";
  if (unit === "none") return `${minus}${body}`;
  const style = styleFor(currency);
  if (!style.symbol) return `${minus}${body}`;
  return style.position === "prefix" ? `${minus}${style.symbol}${body}` : `${minus}${body} ${style.symbol}`;
}

/** Characters a Pixi numeral font must contain to draw any formatted amount. */
export function glyphsNeeded(currencies: readonly string[]): string {
  const set = new Set("0123456789,.- ");
  for (const c of currencies) for (const ch of styleFor(c).symbol) set.add(ch);
  return [...set].sort().join("");
}
