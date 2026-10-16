/** Local sandbox bank. Never calls a network or a live wallet. */

const KEY = "kilo-sandbox-bank-v1";
const LAST = "kilo-sandbox-last-v1";
export const SANDBOX_START = 500_000;

type Memory = { bank: number | null };
const memory: Memory = { bank: null };

export function readBank(): number {
  if (memory.bank != null) return memory.bank;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw == null) return SANDBOX_START;
    const n = Number(raw);
    if (!Number.isFinite(n)) return SANDBOX_START;
    return Math.max(0, Math.round(n));
  } catch {
    return SANDBOX_START;
  }
}

export function writeBank(n: number) {
  const next = Math.max(0, Math.round(n));
  memory.bank = next;
  try {
    localStorage.setItem(KEY, String(next));
  } catch {
    /* private mode stays in memory */
  }
  window.dispatchEvent(new Event("kilo-bank"));
}

export function resetBank() {
  writeBank(SANDBOX_START);
  try {
    sessionStorage.removeItem(LAST);
  } catch {
    /* ignore */
  }
}

export function settle(cost: number, payout: number): { ok: true } | { ok: false; reason: string } {
  const bank = readBank();
  if (cost > bank) return { ok: false, reason: "Not enough sandbox LGC for that charge." };
  writeBank(bank - cost + payout);
  return { ok: true };
}

export function rememberRound(payload: string) {
  try {
    sessionStorage.setItem(LAST, payload);
  } catch {
    /* ignore */
  }
}

export function recallRound(): string | null {
  try {
    return sessionStorage.getItem(LAST);
  } catch {
    return null;
  }
}
