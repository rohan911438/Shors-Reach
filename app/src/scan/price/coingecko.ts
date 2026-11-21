import type { Net } from "../net.js";

export const COINGECKO = "https://api.coingecko.com/api/v3/simple/price";

/** USD prices by CoinGecko id. Missing / failed → absent from the map (never 0). */
export async function fetchPrices(net: Net, ids: string[]): Promise<{ prices: Record<string, number>; ok: boolean; error?: string }> {
  const uniq = [...new Set(ids)].sort();
  if (uniq.length === 0) return { prices: {}, ok: true };
  try {
    const data = await net.json<Record<string, { usd?: number }>>({ url: `${COINGECKO}?ids=${uniq.join(",")}&vs_currencies=usd` });
    const prices: Record<string, number> = {};
    for (const id of uniq) {
      const p = data[id]?.usd;
      if (typeof p === "number" && p > 0) prices[id] = p;
    }
    return { prices, ok: true };
  } catch (err) {
    return { prices: {}, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
