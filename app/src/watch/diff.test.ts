import { describe, expect, it } from "vitest";

import { diff, type SnapHolding, type Snapshot } from "./diff.js";

const H = (over: Partial<SnapHolding> = {}): SnapHolding => ({
  key: "bitcoin:p2wpkh:bc1qaaa",
  chain: "bitcoin",
  format: "p2wpkh",
  locator: "bc1qaaa",
  status: "EXPOSED_ON_SPEND",
  amountBase: "100000",
  amount: "0.001",
  asset: "BTC",
  usd: 60,
  ...over,
});
const S = (holdings: SnapHolding[], over: Partial<Snapshot> = {}): Snapshot => ({
  at: "2026-11-22T00:00:00Z",
  score: 0,
  exposedUsd: 0,
  holdings,
  pqKeyRegistered: null,
  partial: false,
  ...over,
});
const kinds = (a: Snapshot, b: Snapshot) => diff(a, b).map((c) => c.kind);

describe("watchlist diff", () => {
  it("no change → no alerts (price moves alone are ignored)", () => {
    expect(kinds(S([H()]), S([H({ usd: 90 })]))).toEqual([]);
  });

  it("a spend revealing the key → key-revealed", () => {
    expect(kinds(S([H()]), S([H({ status: "EXPOSED_NOW" })], { score: 0 }))).toEqual(["key-revealed"]);
  });

  it("new funds on an already-exposed holding → funds-in-exposed", () => {
    const e = H({ status: "EXPOSED_NOW" });
    expect(kinds(S([e]), S([{ ...e, amountBase: "250000", amount: "0.0025" }]))).toEqual(["funds-in-exposed"]);
  });

  it("a new exposed holding → new-exposed; a new hidden one is not an alert", () => {
    const fresh = H({ key: "bitcoin:p2tr:bc1pzzz", format: "p2tr", locator: "bc1pzzz", status: "EXPOSED_NOW" });
    expect(kinds(S([H()]), S([H(), fresh]))).toEqual(["new-exposed"]);
    expect(kinds(S([]), S([H()]))).toEqual([]);
  });

  it("empty exposed holdings are ignored", () => {
    expect(kinds(S([H()]), S([H({ status: "EXPOSED_NOW", amountBase: "0", amount: "0" })]))).toEqual([]);
  });

  it("funds moved off an exposed holding → exposed-cleared (good)", () => {
    const e = H({ status: "EXPOSED_NOW" });
    const c = diff(S([e]), S([{ ...e, amountBase: "0", amount: "0" }]));
    expect(c.map((x) => [x.kind, x.tone])).toEqual([["exposed-cleared", "good"]]);
  });

  it("a holding missing from a PARTIAL scan is not reported as moved", () => {
    const e = H({ status: "EXPOSED_NOW" });
    expect(kinds(S([e]), S([], { partial: true }))).toEqual([]);
    expect(kinds(S([e]), S([], { partial: false }))).toEqual(["exposed-cleared"]);
  });

  it("risk-up fires at +5 points, not on partial scans", () => {
    expect(kinds(S([], { score: 10 }), S([], { score: 14 }))).toEqual([]);
    expect(kinds(S([], { score: 10 }), S([], { score: 15 }))).toEqual(["risk-up"]);
    expect(kinds(S([], { score: 10 }), S([], { score: 40, partial: true }))).toEqual([]);
  });

  it("QoreChain PQ key registered → pq-registered", () => {
    expect(kinds(S([], { pqKeyRegistered: false }), S([], { pqKeyRegistered: true }))).toEqual(["pq-registered"]);
  });

  it("messages never carry a full address", () => {
    const loc = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";
    const c = diff(S([H({ locator: loc })]), S([H({ locator: loc, status: "EXPOSED_NOW" })]));
    expect(c[0]!.detail).not.toContain(loc);
    expect(c[0]!.detail).toContain("bc1qar0s…5mdq");
  });
});
