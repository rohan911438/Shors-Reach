import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { fixtureTransport, type NetResponse } from "../scan/net.js";
import { handleScanApi, resetScanApiRateLimit, type ScanApiDeps } from "./scanApi.js";

const FIX = join(import.meta.dirname, "..", "scan", "__fixtures__");
const load = (name: string) => JSON.parse(readFileSync(join(FIX, `${name}.json`), "utf8")) as Record<string, NetResponse>;
const GENESIS =
  "04678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5f";

const deps = (fixture: string, over: Partial<ScanApiDeps> = {}): ScanApiDeps => ({
  origin: "https://app.test",
  engine: { transport: fixtureTransport(load(fixture)) },
  ...over,
});
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://app.test/api/v1/scan", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });

beforeEach(() => resetScanApiRateLimit());

describe("Scan API v1", () => {
  it("scans a public key and returns verdict, score, holdings with evidence, and a report link", async () => {
    const res = await handleScanApi(post({ input: GENESIS }), deps("genesis-pubkey"));
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const b = await res.json();
    expect(b).toMatchObject({ apiVersion: "1", inputKind: "btc-pubkey", verdict: "exposed" });
    expect(b.score).toBeGreaterThan(0);
    const exposed = b.holdings.filter((h: { status: string }) => h.status === "EXPOSED_NOW");
    expect(exposed.length).toBeGreaterThan(0);
    for (const h of exposed) expect(h.evidenceUrl).toMatch(/^https:\/\//);
    expect(b.holdings.find((h: { format: string }) => h.format === "p2pk").reasonTitle).toBe("Pay-to-public-key output");
    expect(b.reportUrl).toBe(`https://app.test/#/scan/${GENESIS}`);
  });

  it("EVM: one key, many chains", async () => {
    const b = await (await handleScanApi(post({ input: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" }), deps("vitalik"))).json();
    expect(b.verdict).toBe("exposed");
    expect(new Set(b.holdings.map((h: { chain: string }) => h.chain)).size).toBeGreaterThan(3);
  });

  it("preflight and method handling", async () => {
    const pre = await handleScanApi(new Request("https://app.test/api/v1/scan", { method: "OPTIONS" }), deps("genesis-pubkey"));
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-headers")).toMatch(/x-api-key/);
    expect((await handleScanApi(new Request("https://app.test/api/v1/scan?input=x"), deps("genesis-pubkey"))).status).toBe(405);
  });

  it.each([
    ["junk JSON", "nope", "bad-json"],
    ["missing input", {}, "missing-input"],
    ["bad input", { input: "hello world" }, "bad-input"],
    ["seed phrase", { input: "abandon ability able about above absent absorb abstract absurd abuse access accident" }, "seed-phrase"],
  ])("400 on %s", async (_n, body, code) => {
    const res = await handleScanApi(post(body), deps("genesis-pubkey"));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe(code);
  });

  it("rate limits per IP; a partner key gets its own bucket; an unknown key is refused", async () => {
    const d = deps("genesis-pubkey", { rateLimit: 1, apiKeys: ["k1"], keyRateLimit: 5 });
    expect((await handleScanApi(post({ input: GENESIS }), d, "1.1.1.1")).status).toBe(200);
    const limited = await handleScanApi(post({ input: GENESIS }), d, "1.1.1.1");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("3600");
    expect((await handleScanApi(post({ input: GENESIS }, { "x-api-key": "k1" }), d, "1.1.1.1")).status).toBe(200);
    expect((await handleScanApi(post({ input: GENESIS }, { "x-api-key": "nope" }), d, "2.2.2.2")).status).toBe(401);
  });

  it("logs timing only, never the input", async () => {
    const logs: string[] = [];
    await handleScanApi(post({ input: GENESIS }), deps("genesis-pubkey", { log: (m) => logs.push(m) }));
    expect(logs.join("\n")).not.toContain(GENESIS.slice(0, 20));
    expect(logs[0]).toMatch(/^scan-api ok kind=btc-pubkey ms=\d+/);
  });

  it("an all-sources-down scan is 'incomplete', never 'protected'", async () => {
    const down = async () => ({ status: 503, text: "down" });
    const res = await handleScanApi(post({ input: "bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297" }), { origin: "https://app.test", engine: { transport: down } });
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b.verdict).toBe("incomplete");
    expect(b.sources.find((s: { source: string }) => s.source === "mempool.space").ok).toBe(false);
  });
});
