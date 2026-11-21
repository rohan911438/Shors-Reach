/**
 * Server-side attester for the QoreX path. Verifies a holder's hybrid-signed native proof tx and calls
 * QuantumPass.attest(). Runs with QORE_ATTESTER_MNEMONIC (server secret, testnet only).
 *
 * The attester's own EVM tx needs an EVM window; we open a short, scoped one (hybrid-signed) when needed.
 */
import { verifyNativeProof, type NativeTxJson } from "./proof.js";

export interface AttestDeps {
  rest: string;
  fetchJson: (url: string) => Promise<{ status: number; body: unknown }>;
  /** Already-minted check. */
  hasPass: (holder: `0x${string}`) => Promise<boolean>;
  /** Holder's PQ key registered (pqcKeyStatus). */
  keyRegistered: (holder: `0x${string}`) => Promise<boolean>;
  /** Native proof already consumed on-chain. */
  proofUsed: (txHash: `0x${string}`) => Promise<boolean>;
  /** Submit attest(); returns the EVM tx hash after the receipt succeeds. */
  submit: (args: {
    holder: `0x${string}`;
    scanHash: `0x${string}`;
    scoreBucket: number;
    chainsMask: number;
    exposedUsdBucket: number;
    nativeTxHash: `0x${string}`;
  }) => Promise<{ evmTxHash: `0x${string}`; windowTxHash?: string }>;
}

export type AttestResult =
  | { status: 200; body: { holder: string; nativeTxHash: string; evmTxHash: string; windowTxHash?: string } }
  | { status: 400 | 404 | 409 | 422 | 502; body: { error: string; code: string } };

export async function attestFromNativeTx(txHashRaw: string, deps: AttestDeps): Promise<AttestResult> {
  const txHash = txHashRaw.trim().replace(/^0x/i, "").toUpperCase();
  if (!/^[0-9A-F]{64}$/.test(txHash)) return { status: 400, body: { error: "Send the 64-hex native transaction hash.", code: "bad-hash" } };

  const r = await deps.fetchJson(`${deps.rest}/cosmos/tx/v1beta1/txs/${txHash}`);
  if (r.status === 404 || r.status === 400) return { status: 404, body: { error: "Transaction not found yet — wait a few seconds and retry.", code: "not-found" } };
  if (r.status !== 200) return { status: 502, body: { error: `QoreChain REST answered ${r.status}.`, code: "upstream" } };

  const proof = verifyNativeProof(r.body as NativeTxJson);
  if (!proof.ok) return { status: 422, body: { error: proof.error, code: "bad-proof" } };

  if (await deps.hasPass(proof.holderEvm)) return { status: 409, body: { error: "This account already holds a Quantum Pass.", code: "already-minted" } };
  if (await deps.proofUsed(proof.txHash)) return { status: 409, body: { error: "This proof transaction was already used.", code: "proof-reused" } };
  if (!(await deps.keyRegistered(proof.holderEvm)))
    return { status: 422, body: { error: "No ML-DSA-87 key is registered for this account.", code: "no-pq-key" } };

  const out = await deps.submit({ holder: proof.holderEvm, ...proof.fields, nativeTxHash: proof.txHash });
  return { status: 200, body: { holder: proof.holderEvm, nativeTxHash: txHash, evmTxHash: out.evmTxHash, windowTxHash: out.windowTxHash } };
}
