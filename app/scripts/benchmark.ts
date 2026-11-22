/**
 * Accuracy benchmark: Shor's Reach vs the rule a typical "quantum address checker" uses.
 *
 * Baseline rule (how single-address checkers work): look at ONE address and call it exposed
 * only if that address has ever spent (Bitcoin) or has a non-zero nonce on Ethereum mainnet (EVM).
 * Taproot is judged the same way (spent or not).
 *
 * Shor's Reach: the full engine — key-level sibling derivation, P2PK, Taproot output keys,
 * xpub gap scan, cross-chain EVM, QoreChain — with evidence for every red row.
 *
 *   npx tsx scripts/benchmark.ts [--report ../docs/reports/benchmark-accuracy.md]
 *
 * Live data: mempool.space, public EVM RPCs, CoinGecko. Results vary with chain state and prices.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { scan, type ScanResult } from "../src/scan/index.js";

interface Case {
  name: string;
  /** What the user pastes into Shor's Reach. */
  input: string;
  /** The single address a baseline checker would be given for the same holder. */
  baseline: { chain: "btc" | "evm"; address: string };
  why: string;
  /** Both methods are expected to agree; excluded from the value ratio. */
  control?: boolean;
}

const CASES: Case[] = [
  {
    name: "HD wallet (BIP-84 test zpub)",
    input: "zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs",
    baseline: { chain: "btc", address: "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu" },
    why: "A wallet is many addresses; checking one misses the rest.",
  },
  {
    name: "Satoshi's genesis key",
    input:
      "04678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5f",
    baseline: { chain: "btc", address: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa" },
    why: "Famous address never spent, but the key sits in a P2PK output since block 0.",
  },
  {
    name: "Taproot address",
    input: "bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297",
    baseline: { chain: "btc", address: "bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297" },
    why: "P2TR writes the output key on-chain; exposed on receipt, spent or not.",
  },
  {
    name: "Exchange cold wallet (reused P2SH)",
    input: "34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo",
    baseline: { chain: "btc", address: "34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo" },
    why: "Control case: reuse after spending is exposed under both methods.",
    control: true,
  },
  {
    name: "vitalik.eth (EVM)",
    input: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    baseline: { chain: "evm", address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
    why: "Baseline checks Ethereum only; the same key holds value on 7 more chains.",
  },
];

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) }).catch(() => null);
    if (r?.ok) return (await r.json()) as T;
    await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
  }
  throw new Error(`fetch failed: ${url}`);
}

/** Baseline verdict + the balance it would attribute. */
async function baseline(c: Case): Promise<{ exposed: boolean; amount: number; asset: string; detail: string; failed?: boolean }> {
  if (c.baseline.chain === "btc") {
    const a = await getJson<{ chain_stats: { funded_txo_sum: number; spent_txo_sum: number; spent_txo_count: number } }>(
      `https://mempool.space/api/address/${c.baseline.address}`,
    );
    const bal = (a.chain_stats.funded_txo_sum - a.chain_stats.spent_txo_sum) / 1e8;
    const exposed = a.chain_stats.spent_txo_count > 0;
    return { exposed, amount: bal, asset: "BTC", detail: `${a.chain_stats.spent_txo_count} spends on this address` };
  }
  const body = (method: string, params: unknown[]) => ({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const rpc = "https://ethereum-rpc.publicnode.com";
  const n = await getJson<{ result: string }>(rpc, body("eth_getTransactionCount", [c.baseline.address, "latest"]));
  const b = await getJson<{ result: string }>(rpc, body("eth_getBalance", [c.baseline.address, "latest"]));
  const eth = Number(BigInt(b.result)) / 1e18;
  return { exposed: BigInt(n.result) > 0n, amount: eth, asset: "ETH", detail: `Ethereum nonce ${BigInt(n.result)}` };
}

function ourUsdPerUnit(r: ScanResult, asset: string): number | null {
  const h = r.holdings.find((x) => x.asset === asset && x.usd && Number(x.amount) > 0);
  return h ? h.usd! / Number(h.amount) : null;
}

const fmtUsd = (n: number) => (n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${n.toFixed(0)}`);

type Out = {
  c: Case;
  base: Awaited<ReturnType<typeof baseline>> & { usd: number | null };
  ours: { exposedUsd: number; holdings: number; exposedRows: number; withEvidence: number; chains: number; seconds: number; sourcesDown: string[] };
};
const out: Out[] = [];

for (const [i, c] of CASES.entries()) {
  if (i > 0) await new Promise((r) => setTimeout(r, 8000)); // be polite to public APIs
  process.stdout.write(`• ${c.name} … `);
  const t = Date.now();
  const r = await scan(c.input);
  const seconds = (Date.now() - t) / 1000;
  const b = await baseline(c).catch(() => ({ exposed: false, amount: 0, asset: c.baseline.chain === "btc" ? "BTC" : "ETH", detail: "baseline API unavailable", failed: true }));
  const unit = ourUsdPerUnit(r, b.asset);
  const exposedRows = r.holdings.filter((h) => h.status === "EXPOSED_NOW");
  out.push({
    c,
    base: { ...b, usd: unit === null ? null : b.exposed ? b.amount * unit : 0 },
    ours: {
      exposedUsd: r.totals.usd.EXPOSED_NOW,
      holdings: r.holdings.filter((h) => !h.details?.zeroBalance).length,
      exposedRows: exposedRows.length,
      withEvidence: exposedRows.filter((h) => h.evidence).length,
      chains: new Set(r.holdings.filter((h) => Number(h.amount) > 0).map((h) => h.chain)).size,
      seconds,
      sourcesDown: r.sources.filter((s) => !s.ok).map((s) => s.source),
    },
  });
  console.log(`done in ${seconds.toFixed(1)} s`);
}

const header = [
  "| Case | Baseline verdict | Baseline exposed value | Shor's Reach exposed value | Exposed rows (with evidence) | Chains with funds | Scan time |",
  "|---|---|---|---|---|---|---|",
];
const body = out.map(({ c, base, ours }) => {
  const bv = base.failed ? "n/a" : base.exposed ? "Exposed" : "**Safe**";
  return `| ${c.name} | ${bv} (${base.detail}) | ${base.usd === null ? "n/a" : fmtUsd(base.usd)} | **${fmtUsd(ours.exposedUsd)}** | ${ours.exposedRows} (${ours.withEvidence}) | ${ours.chains} | ${ours.seconds.toFixed(1)} s${ours.sourcesDown.length ? ` ⚠ ${ours.sourcesDown.join(", ")} down` : ""} |`;
});
const missed = out.filter((o) => !o.base.failed && !o.base.exposed && o.ours.exposedRows > 0);
const scored = out.filter((o) => !o.c.control);
const baseTotal = scored.reduce((a, o) => a + (o.base.usd ?? 0), 0);
const oursTotal = scored.reduce((a, o) => a + o.ours.exposedUsd, 0);
const evid = out.reduce((a, o) => a + o.ours.withEvidence, 0);
const rowsAll = out.reduce((a, o) => a + o.ours.exposedRows, 0);

const md = [
  "# Accuracy benchmark — key-level scan vs single-address check",
  "",
  `Run ${new Date().toISOString()} · live chain data · \`npx tsx scripts/benchmark.ts\``,
  "",
  "**Baseline** = the rule single-address checkers use: one address, exposed only if it has spent (BTC) or has an Ethereum nonce > 0 (EVM).",
  "**Shor's Reach** = full engine: sibling forms of the key, P2PK, Taproot output keys, xpub gap scan, 8 chains, evidence per row.",
  "",
  ...header,
  ...body,
  "",
  "## Summary",
  "",
  `- Cases where the baseline says **safe** but funds are provably exposed: **${missed.length} / ${out.length}** (${missed.map((m) => m.c.name).join(", ") || "none"}).`,
  `- Exposed value found (non-control cases): baseline **${fmtUsd(baseTotal)}** vs Shor's Reach **${fmtUsd(oursTotal)}** (${baseTotal > 0 ? `${(oursTotal / baseTotal).toFixed(1)}×` : "∞"}).`,
  `- Exposed rows backed by a linked on-chain transaction or output: **${evid} / ${rowsAll}**.`,
  "",
  "## Why each case matters",
  "",
  ...out.map((o) => `- **${o.c.name}** — ${o.c.why}`),
  "",
  "Notes: the baseline is given the address a holder would most likely paste; USD uses the same CoinGecko price for both columns. Values move with chain state and prices.",
  "",
].join("\n");

console.log("\n" + md);
const i = process.argv.indexOf("--report");
if (i > 0) {
  const p = process.argv[i + 1]!;
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, md);
  console.log(`report → ${p}`);
}
