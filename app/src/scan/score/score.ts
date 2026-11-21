import { STATUSES, type Holding, type Status, type Totals } from "../types.js";

/** Attach USD values. Unknown price → usd stays null. */
export function price(holdings: Holding[], prices: Record<string, number>): Holding[] {
  return holdings.map((h) => {
    const p = h.priceId ? prices[h.priceId] : undefined;
    return { ...h, usd: p === undefined ? null : Number(h.amount) * p };
  });
}

/**
 * Invariant: EXPOSED_NOW must carry evidence. A verdict without proof is downgraded to UNKNOWN,
 * so the app can never raise an alarm it can't back up.
 */
export function enforceEvidence(holdings: Holding[]): Holding[] {
  return holdings.map((h) => (h.status === "EXPOSED_NOW" && !h.evidence?.url ? { ...h, status: "UNKNOWN", reason: "source-unavailable" } : h));
}

export function totals(holdings: Holding[]): Totals {
  const usd = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  const count = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  let unpricedCount = 0;
  for (const h of holdings) {
    if (h.details?.zeroBalance) continue;
    count[h.status]++;
    if (h.usd === null) unpricedCount++;
    else usd[h.status] += h.usd;
  }
  return { usd, count, unpricedCount };
}

/** 0–100: share of value that is EXPOSED_NOW (count-weighted when nothing is priced). */
export function score(t: Totals): { score: number; basis: "usd" | "count" } {
  const usdTotal = STATUSES.reduce((a, s) => a + t.usd[s], 0);
  if (usdTotal > 0) return { score: Math.round((100 * t.usd.EXPOSED_NOW) / usdTotal), basis: "usd" };
  const n = STATUSES.reduce((a, s) => a + t.count[s], 0);
  return { score: n === 0 ? 0 : Math.round((100 * t.count.EXPOSED_NOW) / n), basis: "count" };
}
