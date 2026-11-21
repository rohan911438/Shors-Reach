/**
 * Anonymised summary sent to the AI advisor. Contains NO addresses, txids, xpubs or exact amounts.
 */
import type { ChainId, Format, Questionnaire, ReasonCode, ScanResult, Status } from "../types.js";

export interface AnonymisedHolding {
  chain: ChainId;
  format: Format;
  status: Status;
  reason: ReasonCode;
  usdRounded: number | null;
}

export interface AnonymisedSummary {
  score: number;
  scoreBasis: "usd" | "count";
  totalsUsdRounded: Record<Status, number>;
  holdings: AnonymisedHolding[];
  questionnaire: { signedMessages: "yes" | "no" | "unsure"; custodial: boolean };
  qorechain: { pqKeyRegistered: boolean; windowLive: boolean } | null;
}

/** Round to 2 significant figures. */
export function round2(n: number): number {
  if (n === 0 || !Number.isFinite(n)) return 0;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(n))) - 1);
  return Math.round(n / mag) * mag;
}

export function toAnonymisedSummary(r: ScanResult, q: Questionnaire = {}): AnonymisedSummary {
  const t = r.totals.usd;
  return {
    score: r.score,
    scoreBasis: r.scoreBasis,
    totalsUsdRounded: {
      EXPOSED_NOW: round2(t.EXPOSED_NOW),
      EXPOSED_ON_SPEND: round2(t.EXPOSED_ON_SPEND),
      PROTECTED: round2(t.PROTECTED),
      UNKNOWN: round2(t.UNKNOWN),
    },
    holdings: r.holdings
      .filter((h) => !h.details?.zeroBalance)
      .slice(0, 50)
      .map((h) => ({ chain: h.chain, format: h.format, status: h.status, reason: h.reason, usdRounded: h.usd === null ? null : round2(h.usd) })),
    questionnaire: { signedMessages: q.signedMessages ?? "unsure", custodial: q.custodial ?? false },
    qorechain: r.qore ? { pqKeyRegistered: r.qore.pqKeyRegistered, windowLive: r.qore.window?.live ?? false } : null,
  };
}

/** Patterns that must never appear in anything sent to a server. */
export const LEAK_PATTERNS: RegExp[] = [
  /\b(bc1|tb1)[a-z0-9]{20,}/i,
  /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/,
  /\b0x[0-9a-fA-F]{40}\b/,
  /\bqor1[0-9a-z]{20,}/,
  /\b[0-9a-f]{64}\b/i,
  /\b[xyzt]pub[1-9A-HJ-NP-Za-km-z]{50,}/,
];

export function containsIdentifier(s: string): boolean {
  return LEAK_PATTERNS.some((p) => p.test(s));
}
