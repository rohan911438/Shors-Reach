/**
 * EVM exposure scan.
 *
 * Any signed EVM transaction lets anyone recover the sender's public key (ecrecover), so nonce > 0 ⇒ key exposed.
 * The same key controls the address on EVERY EVM chain: one tx on Base exposes the Ethereum balance too.
 */
import { formatUnits, getAddress, isAddress } from "viem";

import type { Net } from "../net.js";
import type { Holding, ProgressEvent, Questionnaire, ReasonCode, SourceHealth, Status } from "../types.js";
import { EVM_CHAINS, type EvmChain } from "./chains.js";

export interface EvmContext {
  net: Net;
  chains?: EvmChain[];
  questionnaire?: Questionnaire;
  onProgress?: (e: ProgressEvent) => void;
}

interface RpcResponse<T> {
  result?: T;
  error?: { code: number; message: string };
}

/** JSON-RPC call. The id is fixed so identical calls share one cache/fixture key. */
async function rpc<T>(net: Net, url: string, method: string, params: unknown[]): Promise<T> {
  const body = { jsonrpc: "2.0", id: 1, method, params };
  const res = await net.json<RpcResponse<T>>({ url, method: "POST", body });
  if (res.error) throw new Error(`${method}: ${res.error.message}`);
  if (res.result === undefined) throw new Error(`${method}: empty result`);
  return res.result;
}

export interface ChainFacts {
  chain: EvmChain;
  ok: boolean;
  error?: string;
  nonce: bigint;
  balance: bigint;
  code: string;
}

export async function chainFacts(net: Net, chain: EvmChain, address: string): Promise<ChainFacts> {
  try {
    const [nonce, balance, code] = await Promise.all([
      rpc<string>(net, chain.rpc, "eth_getTransactionCount", [address, "latest"]),
      rpc<string>(net, chain.rpc, "eth_getBalance", [address, "latest"]),
      rpc<string>(net, chain.rpc, "eth_getCode", [address, "latest"]),
    ]);
    return { chain, ok: true, nonce: BigInt(nonce), balance: BigInt(balance), code: code.toLowerCase() };
  } catch (err) {
    return { chain, ok: false, error: err instanceof Error ? err.message : String(err), nonce: 0n, balance: 0n, code: "0x" };
  }
}

/** Safe.getOwners() selector. */
const GET_OWNERS = "0xa0e67e2b";

/** Decode an ABI-encoded address[] return value. */
export function decodeAddressArray(hex: string): string[] {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (h.length < 128) return [];
  const offset = Number(BigInt(`0x${h.slice(0, 64)}`)) * 2;
  const len = Number(BigInt(`0x${h.slice(offset, offset + 64)}`));
  const out: string[] = [];
  for (let i = 0; i < len && i < 50; i++) {
    const word = h.slice(offset + 64 + i * 64, offset + 128 + i * 64);
    if (word.length < 64) break;
    out.push(getAddress(`0x${word.slice(24)}`));
  }
  return out;
}

export async function safeOwners(net: Net, chain: EvmChain, address: string): Promise<string[] | null> {
  try {
    const ret = await rpc<string>(net, chain.rpc, "eth_call", [{ to: address, data: GET_OWNERS }, "latest"]);
    const owners = decodeAddressArray(ret);
    return owners.length > 0 ? owners : null;
  } catch {
    return null;
  }
}

export interface EvmScanResult {
  holdings: Holding[];
  sources: SourceHealth[];
  /** Overall verdict for the key behind this address. */
  keyStatus: Status;
  keyReason: ReasonCode;
}

function mk(f: ChainFacts, address: string, status: Status, reason: ReasonCode, evidence?: Holding["evidence"], details?: Holding["details"]): Holding {
  return {
    chain: f.chain.id,
    format: f.code === "0x" ? "eoa" : f.code.startsWith("0xef0100") ? "eip7702" : "contract",
    locator: address,
    amountBase: f.balance.toString(),
    amount: formatUnits(f.balance, 18),
    asset: f.chain.symbol,
    priceId: f.chain.priceId,
    usd: null,
    status,
    reason,
    evidence,
    details,
  };
}

export async function scanEvmAddress(ctx: EvmContext, input: string, depth = 0): Promise<EvmScanResult> {
  if (!isAddress(input, { strict: false })) throw new Error("Not an EVM address.");
  const address = getAddress(input);
  const chains = ctx.chains ?? EVM_CHAINS;

  const facts = await Promise.all(
    chains.map(async (c) => {
      ctx.onProgress?.({ type: "source-start", source: `evm:${c.id}`, label: c.name });
      const f = await chainFacts(ctx.net, c, address);
      ctx.onProgress?.({ type: "source-done", source: `evm:${c.id}`, ok: f.ok, error: f.error });
      return f;
    }),
  );
  const sources: SourceHealth[] = facts.map((f) => ({ source: `evm:${f.chain.id}`, ok: f.ok, error: f.error }));
  const okFacts = facts.filter((f) => f.ok);

  // Contract wallets (Safe-style): exposure = their ECDSA owners.
  const contract = okFacts.find((f) => f.code !== "0x" && !f.code.startsWith("0xef0100"));
  if (contract && depth === 0) {
    const owners = await safeOwners(ctx.net, contract.chain, address);
    const holdings: Holding[] = [];
    if (!owners) {
      for (const f of okFacts) if (f.balance > 0n) holdings.push({ ...mk(f, address, "UNKNOWN", "evm-contract-wallet-unknown"), format: "contract" });
      return { holdings, sources, keyStatus: "UNKNOWN", keyReason: "evm-contract-wallet-unknown" };
    }
    const ownerResults = await Promise.all(owners.slice(0, 10).map((o) => scanEvmAddress(ctx, o, depth + 1)));
    const exposedOwner = ownerResults.findIndex((r) => r.keyStatus === "EXPOSED_NOW");
    const anyUnknown = ownerResults.some((r) => r.keyStatus === "UNKNOWN");
    const status: Status = exposedOwner >= 0 ? "EXPOSED_NOW" : anyUnknown ? "UNKNOWN" : "EXPOSED_ON_SPEND";
    const reason: ReasonCode = exposedOwner >= 0 ? "evm-contract-wallet-owner-exposed" : anyUnknown ? "evm-offchain-signature-possible" : "evm-contract-wallet-owners-hidden";
    const ev =
      exposedOwner >= 0
        ? ownerResults[exposedOwner]!.holdings.find((h) => h.evidence)?.evidence ?? {
            url: `${contract.chain.explorer}${owners[exposedOwner]}`,
            note: `Owner ${owners[exposedOwner]} has sent transactions.`,
          }
        : undefined;
    for (const f of okFacts) {
      if (f.balance > 0n) holdings.push({ ...mk(f, address, status, reason, ev, { owners: owners.slice(0, 10) }), format: "safe" });
    }
    for (const r of ownerResults) holdings.push(...r.holdings);
    return { holdings, sources: [...sources, ...ownerResults.flatMap((r) => r.sources)], keyStatus: status, keyReason: reason };
  }

  // EOA (or EIP-7702 delegated EOA — still rooted in the ECDSA key).
  const sent = okFacts.filter((f) => f.nonce > 0n).sort((a, b) => (b.nonce > a.nonce ? 1 : -1));
  const holdings: Holding[] = [];

  if (sent.length > 0) {
    const proof = sent[0]!;
    const evidence = {
      url: `${proof.chain.explorer}${address}`,
      note: `${proof.nonce} transaction(s) sent on ${proof.chain.name}. Every signed transaction reveals the public key — on every EVM chain.`,
    };
    for (const f of okFacts) {
      const sameChain = f.nonce > 0n;
      if (f.balance > 0n || sameChain) {
        holdings.push(
          mk(f, address, "EXPOSED_NOW", sameChain ? "evm-nonce-nonzero" : "evm-nonce-other-chain", sameChain ? { url: `${f.chain.explorer}${address}`, note: `${f.nonce} transaction(s) sent on ${f.chain.name}.` } : evidence, {
            nonce: Number(f.nonce),
            ...(f.balance === 0n ? { zeroBalance: true } : {}),
          }),
        );
      }
    }
    for (const f of facts.filter((x) => !x.ok)) holdings.push(mk(f, address, "UNKNOWN", "source-unavailable"));
    return { holdings, sources, keyStatus: "EXPOSED_NOW", keyReason: "evm-nonce-nonzero" };
  }

  // Never sent on any chain we could read.
  const answered = ctx.questionnaire?.signedMessages;
  const status: Status = answered === "no" ? "EXPOSED_ON_SPEND" : "UNKNOWN";
  const reason: ReasonCode = answered === "no" ? "evm-never-sent" : "evm-offchain-signature-possible";
  for (const f of okFacts) if (f.balance > 0n) holdings.push(mk(f, address, status, reason));
  for (const f of facts.filter((x) => !x.ok)) holdings.push(mk(f, address, "UNKNOWN", "source-unavailable"));
  return { holdings, sources, keyStatus: status, keyReason: reason };
}
