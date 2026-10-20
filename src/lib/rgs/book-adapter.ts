/**
 * Converts an RGS round state (a book from Bot 3's export in /workspace/kilo-math/phase2/)
 * into the script the existing director plays. Stub until the first export lands; the
 * event schema is Bot 3's. Live play and Bet Replay will both go through this one function,
 * so the two can't drift.
 */
import { winFor } from "./client.ts";

export class BookAdapterNotReady extends Error {
  constructor() {
    super("Book adapter waits for /workspace/kilo-math/phase2/ (Bot 3)");
    this.name = "BookAdapterNotReady";
  }
}

export type AdaptedRound<Script> = { script: Script; win: number };

export function roundStateToScript<Script = unknown>(
  _state: unknown,
  _amount: number,
  _costMultiplier: number,
  _payoutMultiplier: number,
): AdaptedRound<Script> {
  throw new BookAdapterNotReady();
}

/**
 * The guard the real adapter must pass: the animated final win equals the server's
 * payoutMultiplier × base amount (both in micro-units). The server amount is what is paid.
 */
export function winMatchesServer(animatedWin: number, amount: number, payoutMultiplier: number): boolean {
  return Math.abs(animatedWin - winFor(amount, payoutMultiplier)) <= 1;
}
