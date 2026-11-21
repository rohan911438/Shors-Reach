/**
 * Native-proof format for the attested Quantum Pass path.
 *
 * QoreX (today) signs only native QoreChain transactions, always with the hybrid secp256k1 + ML-DSA-87 layer.
 * The holder sends 1 uqor to themselves with a memo committing to the pass fields. The chain accepts that tx only
 * with a valid ML-DSA-87 signature from the holder's REGISTERED key, so the committed tx is a post-quantum proof.
 * The relayer verifies it here and calls QuantumPass.attest(); the contract re-checks the key registry on-chain.
 */
import { qorToEvm } from "../scan/qore/scan.js";

export const MEMO_PREFIX = "ShorsReach/QuantumPass/v1";
export const PQC_EXTENSION_TYPE = "/qorechain.pqc.v1.PQCHybridSignature";
export const BANK_SEND_TYPE = "/cosmos.bank.v1beta1.MsgSend";
export const ML_DSA_87_ALGORITHM_ID = 1;

export interface PassFields {
  scanHash: `0x${string}`;
  scoreBucket: number; // 0..10
  chainsMask: number; // uint16
  exposedUsdBucket: number; // 0..15
}

export function buildMemo(f: PassFields): string {
  return `${MEMO_PREFIX} s=${f.scoreBucket} c=${f.chainsMask} u=${f.exposedUsdBucket} h=${f.scanHash.toLowerCase()}`;
}

export function parseMemo(memo: string): PassFields | null {
  const m = /^ShorsReach\/QuantumPass\/v1 s=(\d{1,2}) c=(\d{1,5}) u=(\d{1,2}) h=(0x[0-9a-f]{64})$/.exec(memo);
  if (!m) return null;
  const f = { scoreBucket: Number(m[1]), chainsMask: Number(m[2]), exposedUsdBucket: Number(m[3]), scanHash: m[4] as `0x${string}` };
  if (f.scoreBucket > 10 || f.chainsMask > 0xffff || f.exposedUsdBucket > 15) return null;
  return f;
}

/** Score 0..100 → bucket 0..10. */
export const scoreBucket = (score: number) => Math.max(0, Math.min(10, Math.floor(score / 10)));

/** Exposed USD → bucket k where value ∈ [10^(k-1), 10^k); 0 = none. */
export function usdBucket(usd: number): number {
  if (!(usd >= 1)) return 0;
  return Math.min(15, Math.floor(Math.log10(usd)) + 1);
}

/** Lower bound of a USD bucket, for display. */
export const usdBucketFloor = (k: number) => (k === 0 ? 0 : 10 ** (k - 1));

export interface NativeTxJson {
  tx?: {
    body?: {
      messages?: { "@type"?: string; from_address?: string; to_address?: string; amount?: { denom: string; amount: string }[] }[];
      memo?: string;
      extension_options?: { "@type"?: string; algorithm_id?: number; pqc_signature?: string }[];
    };
  };
  tx_response?: { code?: number; txhash?: string; height?: string };
}

export type ProofResult =
  | { ok: true; holderQor: string; holderEvm: `0x${string}`; fields: PassFields; txHash: `0x${string}`; height: number }
  | { ok: false; error: string };

/** Verify a committed native tx (REST /cosmos/tx/v1beta1/txs/{hash} JSON) is a valid pass proof. */
export function verifyNativeProof(j: NativeTxJson): ProofResult {
  const res = j.tx_response;
  const body = j.tx?.body;
  if (!res || !body) return { ok: false, error: "Transaction not found." };
  if (res.code !== 0) return { ok: false, error: `Transaction failed on-chain (code ${res.code}).` };
  const ext = (body.extension_options ?? []).find((e) => e["@type"] === PQC_EXTENSION_TYPE);
  if (!ext || !ext.pqc_signature) return { ok: false, error: "Transaction carries no hybrid ML-DSA signature." };
  if (ext.algorithm_id !== ML_DSA_87_ALGORITHM_ID) return { ok: false, error: "Unexpected post-quantum algorithm." };
  const msgs = body.messages ?? [];
  if (msgs.length !== 1 || msgs[0]!["@type"] !== BANK_SEND_TYPE) return { ok: false, error: "Proof must be a single self-transfer." };
  const m = msgs[0]!;
  if (!m.from_address || m.from_address !== m.to_address) return { ok: false, error: "Proof must be a transfer to yourself." };
  const fields = parseMemo(body.memo ?? "");
  if (!fields) return { ok: false, error: "Memo is not a Quantum Pass commitment." };
  if (!res.txhash || !/^[0-9A-Fa-f]{64}$/.test(res.txhash)) return { ok: false, error: "Bad tx hash." };
  return {
    ok: true,
    holderQor: m.from_address,
    holderEvm: qorToEvm(m.from_address) as `0x${string}`,
    fields,
    txHash: `0x${res.txhash.toLowerCase()}`,
    height: Number(res.height ?? 0),
  };
}
