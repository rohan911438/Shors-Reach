/**
 * Watchlist change detection. Pure: the browser watchlist and the server alerts job use the same rules.
 *
 *  key-revealed     a holding that was hidden (amber/unknown) is now EXPOSED_NOW — a spend revealed its key
 *  new-exposed      a holding we had not seen before is EXPOSED_NOW (new funds on an exposed key/form)
 *  funds-in-exposed more coins landed on a holding whose key is already public
 *  risk-up          the exposure score rose by ≥ RISK_STEP points
 *  exposed-cleared  an exposed holding is now empty (funds moved away) — good news
 *  pq-registered    the QoreChain account registered its post-quantum key — good news
 *
 * Holdings missing from a scan with failed sources are treated as "unknown", never as "moved away".
 */
import type { ChainId, Format, ScanResult, Status } from "../scan/types.js";

export const RISK_STEP = 5;

export interface SnapHolding {
  key: string;
  chain: ChainId;
  format: Format;
  locator: string;
  status: Status;
  amountBase: string;
  amount: string;
  asset: string;
  usd: number | null;
}

export interface Snapshot {
  at: string;
  score: number;
  exposedUsd: number;
  holdings: SnapHolding[];
  pqKeyRegistered: boolean | null;
  /** A data source failed: absent holdings may just be missing. */
  partial: boolean;
}

export type ChangeKind = "key-revealed" | "new-exposed" | "funds-in-exposed" | "risk-up" | "exposed-cleared" | "pq-registered";

export interface Change {
  kind: ChangeKind;
  tone: "alert" | "good";
  title: string;
  detail: string;
  holdingKey?: string;
  at: string;
}

export const holdingKey = (h: { chain: string; format: string; locator: string }) => `${h.chain}:${h.format}:${h.locator}`;

export function snapshotOf(r: ScanResult): Snapshot {
  return {
    at: r.scannedAt,
    score: r.score,
    exposedUsd: Math.round(r.totals.usd.EXPOSED_NOW),
    holdings: r.holdings.map((h) => ({
      key: holdingKey(h),
      chain: h.chain,
      format: h.format,
      locator: h.locator,
      status: h.status,
      amountBase: h.amountBase,
      amount: h.amount,
      asset: h.asset,
      usd: h.usd,
    })),
    pqKeyRegistered: r.qore ? r.qore.pqKeyRegistered : null,
    partial: r.sources.some((s) => !s.ok && s.source !== "coingecko"),
  };
}

const big = (s: string) => {
  try {
    return BigInt(s);
  } catch {
    return 0n;
  }
};

/** Shortens an address for messages: bc1qar0s…5mdq */
export const short = (s: string) => (s.length > 16 ? `${s.slice(0, 8)}…${s.slice(-4)}` : s);

const FORMAT_NAME: Partial<Record<Format, string>> = {
  p2pk: "P2PK",
  p2pkh: "legacy (1…)",
  "p2sh-p2wpkh": "nested SegWit (3…)",
  p2sh: "P2SH (3…)",
  p2wpkh: "native SegWit (bc1q…)",
  p2wsh: "P2WSH",
  p2tr: "Taproot (bc1p…)",
  eoa: "account",
  eip7702: "EIP-7702 account",
  safe: "Safe",
  contract: "contract",
  "qore-native": "QoreChain account",
  "qore-evm-window": "QoreChain EVM window",
};
const describe = (h: SnapHolding) => `${h.chain} ${FORMAT_NAME[h.format] ?? h.format} ${short(h.locator)}`;
const hasFunds = (h: SnapHolding) => big(h.amountBase) > 0n;

export function diff(prev: Snapshot, next: Snapshot): Change[] {
  const at = next.at;
  const out: Change[] = [];
  const before = new Map(prev.holdings.map((h) => [h.key, h]));
  const after = new Map(next.holdings.map((h) => [h.key, h]));

  for (const h of next.holdings) {
    if (h.status !== "EXPOSED_NOW" || !hasFunds(h)) continue;
    const p = before.get(h.key);
    if (!p) {
      out.push({ kind: "new-exposed", tone: "alert", title: "New exposed holding", detail: `${h.amount} ${h.asset} on ${describe(h)} sits behind a public key.`, holdingKey: h.key, at });
    } else if (p.status !== "EXPOSED_NOW") {
      out.push({ kind: "key-revealed", tone: "alert", title: "A key was revealed", detail: `${describe(h)} is now exposed — a transaction published its public key. ${h.amount} ${h.asset} is affected.`, holdingKey: h.key, at });
    } else if (big(h.amountBase) > big(p.amountBase)) {
      out.push({ kind: "funds-in-exposed", tone: "alert", title: "Funds landed on an exposed key", detail: `${describe(h)} received coins (now ${h.amount} ${h.asset}), but its key is already public.`, holdingKey: h.key, at });
    }
  }

  for (const p of prev.holdings) {
    if (p.status !== "EXPOSED_NOW" || !hasFunds(p)) continue;
    const h = after.get(p.key);
    if (h ? !hasFunds(h) : !next.partial)
      out.push({ kind: "exposed-cleared", tone: "good", title: "Exposed funds moved", detail: `${describe(p)} no longer holds funds behind its public key.`, holdingKey: p.key, at });
  }

  if (!next.partial && next.score - prev.score >= RISK_STEP)
    out.push({ kind: "risk-up", tone: "alert", title: "Exposure score rose", detail: `Your exposure score went from ${prev.score} to ${next.score} (out of 100).`, at });

  if (prev.pqKeyRegistered === false && next.pqKeyRegistered === true)
    out.push({ kind: "pq-registered", tone: "good", title: "Post-quantum key registered", detail: "Your QoreChain account now has a post-quantum (ML-DSA-87) key.", at });

  return out;
}
