/**
 * Shor's Reach scan engine — public API.
 *
 *   const result = await scan("bc1p…", { onProgress });
 */
import { isAddress } from "viem";

import { Esplora, DEFAULT_ESPLORA } from "./btc/esplora.js";
import { dedupe, scanBtcAddress, scanBtcPubkey, scanBtcXpub } from "./btc/scan.js";
import { isBtcAddress, isPubkeyHex, xpubKind } from "./btc/script.js";
import { scanEvmAddress } from "./evm/scan.js";
import { Net } from "./net.js";
import { fetchPrices } from "./price/coingecko.js";
import { isQorAddress, QORE_REST_DIRECT, scanQore } from "./qore/scan.js";
import { enforceEvidence, price, score, totals } from "./score/score.js";
import type { Holding, InputKind, QoreAccountFacts, ScanOptions, ScanResult, SourceHealth } from "./types.js";

export * from "./types.js";
export { REASONS } from "./score/reasons.js";
export { toAnonymisedSummary, containsIdentifier } from "./score/summary.js";
export { evmToQor, qorToEvm } from "./qore/scan.js";

export class InputError extends Error {}

export function detectInput(raw: string): InputKind {
  const s = raw.trim();
  if (xpubKind(s)) return "btc-xpub";
  if (isPubkeyHex(s)) return "btc-pubkey";
  if (isBtcAddress(s)) return "btc-address";
  if (isAddress(s, { strict: false })) return "evm-address";
  if (/^qor1/i.test(s) && isQorAddress(s)) return "qore-address";
  throw new InputError("Paste a Bitcoin address, a Bitcoin public key, an xpub/ypub/zpub, a 0x address or a qor1 address.");
}

export interface EngineOptions extends ScanOptions {
  /** QoreChain REST base (the browser must use a same-origin proxy such as /lcd-testnet). */
  qoreRest?: string;
}

export async function scan(raw: string, opts: EngineOptions = {}): Promise<ScanResult> {
  const input = raw.trim();
  const kind = detectInput(input);
  const net = new Net({ transport: opts.transport, signal: opts.signal });
  const progress = opts.onProgress;
  const sources: SourceHealth[] = [];
  let holdings: Holding[] = [];
  let qore: QoreAccountFacts | undefined;

  if (kind.startsWith("btc")) {
    const esplora = new Esplora(net, opts.esploraBase ?? DEFAULT_ESPLORA);
    const ctx = { esplora, onProgress: progress };
    progress?.({ type: "source-start", source: "mempool.space", label: "Bitcoin (7 key formats)" });
    try {
      if (kind === "btc-address") holdings = await scanBtcAddress(ctx, input);
      else if (kind === "btc-pubkey") holdings = await scanBtcPubkey(ctx, input);
      else holdings = (await scanBtcXpub(ctx, input)).holdings;
      sources.push({ source: "mempool.space", ok: true });
      progress?.({ type: "source-done", source: "mempool.space", ok: true });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      sources.push({ source: "mempool.space", ok: false, error });
      progress?.({ type: "source-done", source: "mempool.space", ok: false, error });
    }
  } else {
    const evmAddr = kind === "qore-address" ? (await import("./qore/scan.js")).qorToEvm(input) : input;
    progress?.({ type: "source-start", source: "qorechain-rest", label: "QoreChain testnet" });
    const [evm, q] = await Promise.all([
      scanEvmAddress({ net, questionnaire: opts.questionnaire, onProgress: progress }, evmAddr),
      scanQore(net, evmAddr, opts.qoreRest ?? QORE_REST_DIRECT),
    ]);
    progress?.({ type: "source-done", source: "qorechain-rest", ok: q.sources[0]?.ok ?? false, error: q.sources[0]?.error });
    holdings = [...evm.holdings, ...q.holdings];
    sources.push(...evm.sources, ...q.sources);
    qore = q.facts ?? undefined;
  }

  progress?.({ type: "source-start", source: "coingecko", label: "Prices" });
  const p = await fetchPrices(net, holdings.flatMap((h) => (h.priceId ? [h.priceId] : [])));
  sources.push({ source: "coingecko", ok: p.ok, error: p.error });
  progress?.({ type: "source-done", source: "coingecko", ok: p.ok, error: p.error });

  holdings = enforceEvidence(price(dedupe(holdings), p.prices));
  const t = totals(holdings);
  const s = score(t);
  return {
    input,
    inputKind: kind,
    holdings,
    totals: t,
    score: s.score,
    scoreBasis: s.basis,
    qore,
    sources,
    scannedAt: new Date().toISOString(),
  };
}
