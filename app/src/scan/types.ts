/**
 * Shared types for the Shor's Reach scan engine.
 *
 * The engine is framework-free: nothing under src/scan may import React (enforced by a test).
 * A quantum attacker (Shor's algorithm) needs a PUBLIC KEY, not an address, so every verdict is about
 * whether the key that controls a holding has been revealed.
 */

/** Exposure status of a single holding. */
export type Status =
  /** Public key is on-chain; coins are attackable at rest (long-exposure). */
  | "EXPOSED_NOW"
  /** Key hidden behind a hash; revealed only while spending (short-exposure). */
  | "EXPOSED_ON_SPEND"
  /** A post-quantum signature is required to move the funds (QoreChain native lane). */
  | "PROTECTED"
  /** Cannot be determined (off-chain signatures, a data source failed, index gap). Never shown as safe. */
  | "UNKNOWN";

export const STATUSES: readonly Status[] = ["EXPOSED_NOW", "EXPOSED_ON_SPEND", "PROTECTED", "UNKNOWN"];

/** Every reason the engine can give. Each one has a methodology paragraph (score/reasons.ts). */
export type ReasonCode =
  // Bitcoin
  | "btc-p2pk-output"
  | "btc-taproot-output-key"
  | "btc-key-revealed-by-spend"
  | "btc-sibling-key-revealed"
  | "btc-multisig-cosigner-revealed"
  | "btc-hash-hidden"
  // EVM
  | "evm-nonce-nonzero"
  | "evm-nonce-other-chain"
  | "evm-never-sent"
  | "evm-offchain-signature-possible"
  | "evm-contract-wallet-owner-exposed"
  | "evm-contract-wallet-owners-hidden"
  | "evm-contract-wallet-unknown"
  // QoreChain
  | "qore-pq-key-not-registered"
  | "qore-native-pq-required"
  | "qore-evm-window-open"
  | "qore-params-not-enforced"
  // Generic
  | "source-unavailable";

export type BtcFormat = "p2pk" | "p2pkh" | "p2sh-p2wpkh" | "p2sh" | "p2wpkh" | "p2wsh" | "p2tr";
export type EvmFormat = "eoa" | "eip7702" | "safe" | "contract";
export type QoreFormat = "qore-native" | "qore-evm-window";
export type Format = BtcFormat | EvmFormat | QoreFormat;

export type ChainId =
  | "bitcoin"
  | "ethereum"
  | "base"
  | "arbitrum"
  | "optimism"
  | "polygon"
  | "bnb"
  | "avalanche"
  | "qorechain-evm"
  | "qorechain";

export interface Evidence {
  /** Transaction that proves the verdict (revealing spend, funding of a Taproot/P2PK output…). */
  txid?: string;
  /** Link anyone can open to check the verdict. */
  url: string;
  note?: string;
}

export interface Holding {
  chain: ChainId;
  format: Format;
  /** Address or script hash. Stays in the browser — never sent to any server of ours. */
  locator: string;
  /** Amount in the asset's base unit, as a decimal string (sats, wei, uqor). */
  amountBase: string;
  /** Amount in whole units, as a decimal string (BTC, ETH, QOR). */
  amount: string;
  asset: string;
  /** Price-feed id (CoinGecko) used for valuation. */
  priceId?: string;
  usd: number | null;
  status: Status;
  reason: ReasonCode;
  evidence?: Evidence;
  /** True when the amount comes from aggregate stats rather than an exact UTXO list. */
  approximate?: boolean;
  /** Extra structured facts for the UI (e.g. QoreChain window scope). */
  details?: Record<string, string | number | boolean | string[]>;
}

export type SourceName =
  | "mempool.space"
  | "coingecko"
  | "qorechain-rest"
  | `evm:${string}`;

export interface SourceHealth {
  source: SourceName;
  ok: boolean;
  error?: string;
}

export interface QoreAccountFacts {
  address: string; // qor1…
  evmAddress: string; // 0x…
  pqKeyRegistered: boolean;
  possessionProven: boolean | null;
  window: {
    live: boolean;
    remainingBlocks: string;
    remainingTxs: string;
    remainingValueUqor: string;
    nativeOnly: boolean;
    allowedTargets: string[];
  } | null;
  /** If ECDSA broke tomorrow, the most an attacker could move on QoreChain (uqor). */
  maxLossIfEcdsaBreaksUqor: string;
  balanceUqor: string;
}

export interface Totals {
  usd: Record<Status, number>;
  count: Record<Status, number>;
  /** USD of holdings whose price is unknown is excluded from usd totals and counted here. */
  unpricedCount: number;
}

export interface ScanResult {
  input: string;
  inputKind: InputKind;
  holdings: Holding[];
  totals: Totals;
  /** 0–100: share of value (or holdings, if unpriced) that is EXPOSED_NOW. Higher = worse. */
  score: number;
  scoreBasis: "usd" | "count";
  qore?: QoreAccountFacts;
  sources: SourceHealth[];
  scannedAt: string;
}

export type InputKind =
  | "btc-address"
  | "btc-pubkey"
  | "btc-xpub"
  | "evm-address"
  | "qore-address";

/** Answers to the short questionnaire; they turn some UNKNOWN verdicts into firmer ones. */
export interface Questionnaire {
  /** Has this wallet ever signed a message / permit / "Sign in with…" request? */
  signedMessages?: "yes" | "no" | "unsure";
  /** Are these funds on an exchange or other custodian? */
  custodial?: boolean;
}

export type ProgressEvent =
  | { type: "source-start"; source: SourceName; label: string }
  | { type: "source-done"; source: SourceName; ok: boolean; error?: string }
  | { type: "info"; message: string };

export interface ScanOptions {
  questionnaire?: Questionnaire;
  onProgress?: (e: ProgressEvent) => void;
  /** Override the Esplora base URL (privacy-conscious users can point at their own node). */
  esploraBase?: string;
  /** Network transport; tests inject a fixture transport. */
  transport?: import("./net.js").Transport;
  signal?: AbortSignal;
}
