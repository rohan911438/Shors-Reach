import type { ChainId, Format, Status } from "../scan/types.js";

export const STATUS_LABEL: Record<Status, string> = {
  EXPOSED_NOW: "Exposed now",
  EXPOSED_ON_SPEND: "Exposed on spend",
  PROTECTED: "PQ-protected",
  UNKNOWN: "Unknown",
};

export const STATUS_COLOR: Record<Status, string> = {
  EXPOSED_NOW: "var(--danger)",
  EXPOSED_ON_SPEND: "var(--warn)",
  PROTECTED: "var(--ok)",
  UNKNOWN: "var(--unknown)",
};

export const CHAIN_LABEL: Record<ChainId, string> = {
  bitcoin: "Bitcoin",
  ethereum: "Ethereum",
  base: "Base",
  arbitrum: "Arbitrum",
  optimism: "OP Mainnet",
  polygon: "Polygon",
  bnb: "BNB Chain",
  avalanche: "Avalanche",
  "qorechain-evm": "QoreChain EVM",
  qorechain: "QoreChain testnet",
};

/** Bit positions used in QuantumPass.chainsMask (must stay stable). */
export const CHAIN_BITS: ChainId[] = ["bitcoin", "ethereum", "base", "arbitrum", "optimism", "polygon", "bnb", "avalanche", "qorechain"];

export const FORMAT_LABEL: Record<Format, string> = {
  p2pk: "P2PK (raw key)",
  p2pkh: "Legacy P2PKH",
  "p2sh-p2wpkh": "Nested SegWit",
  p2sh: "P2SH script",
  p2wpkh: "Native SegWit",
  p2wsh: "P2WSH script",
  p2tr: "Taproot",
  eoa: "Account (EOA)",
  eip7702: "EOA + EIP-7702",
  safe: "Smart wallet",
  contract: "Contract",
  "qore-native": "Native account",
  "qore-evm-window": "Native + EVM window",
};

export function usd(n: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (opts.compact && Math.abs(n) >= 10_000) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(n);
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n < 100 ? 2 : 0 }).format(n);
}

export function amount(s: string, maxDecimals = 8): string {
  const [w = "0", f = ""] = s.split(".");
  const whole = Number(w).toLocaleString("en-US");
  const frac = f.slice(0, maxDecimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

export function short(s: string, head = 8, tail = 6): string {
  return s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export function uqorToQor(u: string | bigint): string {
  const v = BigInt(u);
  const whole = v / 1_000_000n;
  const frac = (v % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return `${whole.toLocaleString("en-US")}${frac ? `.${frac.slice(0, 4)}` : ""}`;
}
