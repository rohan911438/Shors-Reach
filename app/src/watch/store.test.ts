import { beforeEach, describe, expect, it } from "vitest";

import type { ScanResult } from "../scan/types.js";
import { __resetWatchlist, addToWatchlist, checkAll, checkItem, getWatchlist, markRead, MAX_ITEMS, removeFromWatchlist } from "./store.js";

const ADDR = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";

function result(status: "EXPOSED_NOW" | "EXPOSED_ON_SPEND", amountBase = "100000", sourcesOk = true): ScanResult {
  const usd = { EXPOSED_NOW: 0, EXPOSED_ON_SPEND: 0, PROTECTED: 0, UNKNOWN: 0 };
  usd[status] = 60;
  return {
    input: ADDR,
    inputKind: "btc-address",
    holdings: [
      { chain: "bitcoin", format: "p2wpkh", locator: ADDR, amountBase, amount: String(Number(amountBase) / 1e8), asset: "BTC", usd: 60, status, reason: status === "EXPOSED_NOW" ? "btc-key-revealed-by-spend" : "btc-hash-hidden" },
    ],
    totals: { usd, count: { EXPOSED_NOW: 0, EXPOSED_ON_SPEND: 0, PROTECTED: 0, UNKNOWN: 0 }, unpricedCount: 0 },
    score: status === "EXPOSED_NOW" ? 100 : 0,
    scoreBasis: "usd",
    sources: [{ source: "mempool.space", ok: sourcesOk }],
    scannedAt: new Date().toISOString(),
  };
}

beforeEach(() => __resetWatchlist());

describe("watchlist store", () => {
  it("adds, dedupes and caps entries", () => {
    expect(addToWatchlist(ADDR).ok).toBe(true);
    addToWatchlist(`  ${ADDR} `);
    expect(getWatchlist()).toHaveLength(1);
    for (let i = 0; i < MAX_ITEMS + 2; i++) addToWatchlist(`0x${String(i).padStart(40, "0")}`);
    expect(getWatchlist()).toHaveLength(MAX_ITEMS);
    expect(addToWatchlist("0xffff").ok).toBe(false);
  });

  it("first check sets a baseline without alerts; a later revealed key raises one", async () => {
    const { item } = addToWatchlist(ADDR) as { ok: true; item: { id: string } };
    expect(await checkItem(item.id, async () => result("EXPOSED_ON_SPEND"))).toEqual([]);
    const changes = await checkItem(item.id, async () => result("EXPOSED_NOW"));
    expect(changes.map((c) => c.kind)).toEqual(["key-revealed", "risk-up"]);
    expect(getWatchlist()[0]!.unread).toBe(2);
    markRead();
    expect(getWatchlist()[0]!.unread).toBe(0);
  });

  it("seeding with the scan just run gives an immediate baseline", async () => {
    addToWatchlist(ADDR, "Cold storage", result("EXPOSED_NOW"));
    const it0 = getWatchlist()[0]!;
    expect(it0.label).toBe("Cold storage");
    const changes = await checkItem(it0.id, async () => result("EXPOSED_NOW", "300000"));
    expect(changes.map((c) => c.kind)).toEqual(["funds-in-exposed"]);
  });

  it("a partial scan does not replace a complete baseline", async () => {
    addToWatchlist(ADDR, undefined, result("EXPOSED_NOW"));
    const id = getWatchlist()[0]!.id;
    await checkItem(id, async () => ({ ...result("EXPOSED_NOW"), holdings: [], sources: [{ source: "mempool.space", ok: false }] }));
    expect(getWatchlist()[0]!.snapshot!.holdings).toHaveLength(1);
    expect(getWatchlist()[0]!.error).toMatch(/incomplete/);
  });

  it("scan errors are recorded, not thrown", async () => {
    addToWatchlist(ADDR);
    await checkItem(getWatchlist()[0]!.id, async () => {
      throw new Error("mempool.space down");
    });
    expect(getWatchlist()[0]!.error).toBe("mempool.space down");
  });

  it("checkAll only re-scans due items unless forced", async () => {
    addToWatchlist(ADDR, undefined, result("EXPOSED_NOW")); // fresh: not due
    addToWatchlist("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"); // never checked: due
    const seen: string[] = [];
    const scanner = async (i: string) => {
      seen.push(i);
      return result("EXPOSED_NOW");
    };
    await checkAll(scanner, { pauseMs: 0 });
    expect(seen).toEqual(["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"]);
    await checkAll(scanner, { force: true, pauseMs: 0 });
    expect(seen).toHaveLength(3);
  });

  it("remove", () => {
    addToWatchlist(ADDR);
    removeFromWatchlist(getWatchlist()[0]!.id);
    expect(getWatchlist()).toEqual([]);
  });
});
