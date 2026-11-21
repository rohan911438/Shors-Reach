import { keccak256, toHex } from "viem";

import { CHAIN_BITS } from "../lib/format.js";
import { toAnonymisedSummary, type Questionnaire, type ScanResult } from "../scan/index.js";
import { scoreBucket, usdBucket, type PassFields } from "./proof.js";

/** Stable JSON (sorted keys) so the same summary always hashes the same. */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(v);
}

export function chainsMask(r: ScanResult): number {
  let m = 0;
  for (const h of r.holdings) {
    if (h.status !== "EXPOSED_NOW") continue;
    const bit = CHAIN_BITS.indexOf(h.chain === "qorechain-evm" ? "qorechain" : h.chain);
    if (bit >= 0) m |= 1 << bit;
  }
  return m;
}

/**
 * Pass fields from a scan. scanHash = keccak256(canonical anonymised summary ‖ 32-byte salt): the salt stays in the
 * browser, so the on-chain hash reveals nothing but lets the holder later prove which scan it was.
 */
export function passFieldsFromScan(r: ScanResult, q: Questionnaire, salt: Uint8Array): PassFields {
  const summary = canonicalJson(toAnonymisedSummary(r, q));
  return {
    scanHash: keccak256(toHex(`${summary}|${toHex(salt)}`)),
    scoreBucket: scoreBucket(r.score),
    chainsMask: chainsMask(r),
    exposedUsdBucket: usdBucket(r.totals.usd.EXPOSED_NOW),
  };
}

export function newSalt(): Uint8Array {
  const s = new Uint8Array(32);
  crypto.getRandomValues(s);
  return s;
}
