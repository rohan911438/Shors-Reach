/**
 * End-to-end engine tests on recorded real API responses (no network).
 * Re-record with: npx tsx scripts/record-fixtures.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { detectInput, InputError, scan } from "./index.js";
import { fixtureTransport, type NetResponse } from "./net.js";
import { evmToQor, qorToEvm } from "./qore/scan.js";
import { containsIdentifier, toAnonymisedSummary } from "./score/summary.js";
import { REASONS } from "./score/reasons.js";
import type { ReasonCode, ScanResult } from "./types.js";

const FIX = join(import.meta.dirname, "__fixtures__");
const load = (name: string) => JSON.parse(readFileSync(join(FIX, `${name}.json`), "utf8")) as Record<string, NetResponse>;
const run = (name: string, input: string, opts = {}) => scan(input, { transport: fixtureTransport(load(name)), ...opts });

const GENESIS =
  "04678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5f";
const VITALIK = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
const OURS = "0x707B92f6276799f928CCe4D5873f5A2babF85347";

const results: Record<string, ScanResult> = {};
async function get(name: string, input: string) {
  results[name] ??= await run(name, input);
  return results[name]!;
}

describe("Bitcoin", () => {
  it("genesis public key → Satoshi's P2PK coins are EXPOSED_NOW, proven by the genesis coinbase", async () => {
    const r = await get("genesis-pubkey", GENESIS);
    const p2pk = r.holdings.find((h) => h.format === "p2pk")!;
    expect(p2pk.status).toBe("EXPOSED_NOW");
    expect(p2pk.reason).toBe("btc-p2pk-output");
    expect(Number(p2pk.amount)).toBeGreaterThan(50);
    expect(p2pk.evidence?.txid).toBe("4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b");
    // Sibling: the "never spent" 1A1z… address is exposed through the same key.
    const addr = r.holdings.find((h) => h.locator === "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")!;
    expect(addr.status).toBe("EXPOSED_NOW");
    expect(r.score).toBe(100);
  });

  it("Satoshi's address alone looks hidden (documented limit: P2PK index needed)", async () => {
    const r = await get("satoshi-address", "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa");
    expect(r.holdings).toHaveLength(1);
    expect(r.holdings[0]!.status).toBe("EXPOSED_ON_SPEND");
  });

  it("Taproot output → EXPOSED_NOW with funding tx as evidence", async () => {
    const r = await get("taproot", "bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297");
    expect(r.holdings[0]!.status).toBe("EXPOSED_NOW");
    expect(r.holdings[0]!.reason).toBe("btc-taproot-output-key");
    expect(r.holdings[0]!.evidence?.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it("reused P2SH that has spent → EXPOSED_NOW", async () => {
    const r = await get("multisig-reused", "34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo");
    const own = r.holdings.find((h) => h.locator === "34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo")!;
    expect(own.status).toBe("EXPOSED_NOW");
    expect(own.evidence?.url).toContain("mempool.space");
  });
});

describe("EVM + QoreChain", () => {
  it("vitalik.eth: nonce on Ethereum exposes every chain; QoreChain account unregistered", async () => {
    const r = await get("vitalik", VITALIK);
    const eth = r.holdings.find((h) => h.chain === "ethereum")!;
    expect(eth.status).toBe("EXPOSED_NOW");
    expect(eth.reason).toBe("evm-nonce-nonzero");
    const reasons = new Set(r.holdings.map((h) => h.reason));
    expect(reasons.has("qore-pq-key-not-registered")).toBe(true);
    expect(r.qore?.pqKeyRegistered).toBe(false);
    expect(r.score).toBe(100);
  });

  it("registered QoreChain account → PROTECTED native lane", async () => {
    const r = await get("qore-registered", OURS);
    const q = r.holdings.find((h) => h.chain === "qorechain")!;
    expect(q.status).toBe("PROTECTED");
    expect(r.qore?.pqKeyRegistered).toBe(true);
    expect(r.qore?.possessionProven).toBe(true);
  });

  it("qor1 ⇄ 0x round-trip (same 20 bytes)", () => {
    expect(evmToQor(VITALIK)).toBe("qor1mrdxhunfvjhe6lhdncp72dq46da2jcz9ew85sn");
    expect(qorToEvm("qor1mrdxhunfvjhe6lhdncp72dq46da2jcz9ew85sn")).toBe(VITALIK);
  });
});

describe("invariants", () => {
  const cases: [string, string][] = [
    ["genesis-pubkey", GENESIS],
    ["taproot", "bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297"],
    ["multisig-reused", "34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo"],
    ["vitalik", VITALIK],
    ["qore-registered", OURS],
  ];

  it.each(cases)("%s: every EXPOSED_NOW holding carries evidence", async (name, input) => {
    const r = await get(name, input);
    for (const h of r.holdings.filter((x) => x.status === "EXPOSED_NOW")) expect(h.evidence?.url).toBeTruthy();
  });

  it.each(cases)("%s: anonymised summary leaks no identifiers", async (name, input) => {
    const r = await get(name, input);
    const json = JSON.stringify(toAnonymisedSummary(r, { signedMessages: "unsure" }));
    expect(containsIdentifier(json)).toBe(false);
  });

  it("leak detector catches identifiers", () => {
    expect(containsIdentifier(`{"a":"${VITALIK}"}`)).toBe(true);
    expect(containsIdentifier("bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu")).toBe(true);
    expect(containsIdentifier("4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b")).toBe(true);
    expect(containsIdentifier('{"score":62,"chain":"bitcoin"}')).toBe(false);
  });

  it("a failing source never yields a safe verdict", async () => {
    const r = await scan(VITALIK, { transport: async () => ({ status: 503, text: "down" }) });
    for (const h of r.holdings) expect(["UNKNOWN"]).toContain(h.status);
    expect(r.sources.some((s) => !s.ok)).toBe(true);
  });

  it("every reason code has text", () => {
    const codes: ReasonCode[] = Object.keys(REASONS) as ReasonCode[];
    expect(codes.length).toBeGreaterThanOrEqual(18);
    for (const c of codes) expect(REASONS[c].detail.length).toBeGreaterThan(40);
  });

  it("scan engine never imports React", () => {
    const walk = (d: string): string[] =>
      readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith(".ts") ? [join(d, e.name)] : []));
    for (const f of walk(import.meta.dirname)) expect(readFileSync(f, "utf8")).not.toMatch(/from ["']react/);
  });
});

describe("detectInput", () => {
  it.each([
    [GENESIS, "btc-pubkey"],
    ["bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu", "btc-address"],
    ["zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs", "btc-xpub"],
    [VITALIK, "evm-address"],
    ["qor1mrdxhunfvjhe6lhdncp72dq46da2jcz9ew85sn", "qore-address"],
  ])("%s → %s", (input, kind) => {
    expect(detectInput(input)).toBe(kind);
  });
  it("rejects garbage", () => {
    expect(() => detectInput("hello")).toThrow(InputError);
  });
});
