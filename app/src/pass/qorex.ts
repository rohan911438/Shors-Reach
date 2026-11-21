/**
 * Browser helpers for the QoreX native lane (window.qorex.native).
 * QoreX 0.3.x: native `signAndBroadcast` adds the hybrid secp256k1 + ML-DSA-87 signature itself.
 * EVM signing and signArbitrary are not supported yet, which is why the pass uses a native proof tx.
 */
import { getQorexNative, hasCapability, type QorexNativeProvider } from "@qorechain/qorex-types";
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";

import { buildMemo, BANK_SEND_TYPE, type PassFields } from "./proof.js";

export const QORE_CHAIN_ID = "qorechain-diana";
export const FAUCET_URL = "https://dashboard.qorechain.io/faucet";
export const EXPLORER_TX = (hash: string) => `https://explore.qore.network/tx/${hash.replace(/^0x/, "")}`;

export function qorex(): QorexNativeProvider | null {
  try {
    return getQorexNative() ?? null;
  } catch {
    return null;
  }
}

export async function connectQorex(): Promise<string> {
  const q = qorex();
  if (!q) throw new Error("QoreX is not installed in this browser.");
  await q.enable(QORE_CHAIN_ID);
  const key = await q.getKey(QORE_CHAIN_ID);
  return key.bech32Address;
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/** Send 1 uqor to yourself with the pass commitment in the memo — hybrid-signed by QoreX. */
export async function sendProofTx(address: string, fields: PassFields) {
  const q = qorex();
  if (!q) throw new Error("QoreX is not installed in this browser.");
  if (!hasCapability(q, "signAndBroadcast")) throw new Error("This QoreX build cannot sign QoreChain transactions for sites yet — update QoreX.");
  const value = MsgSend.encode(MsgSend.fromPartial({ fromAddress: address, toAddress: address, amount: [{ denom: "uqor", amount: "1" }] })).finish();
  return q.signAndBroadcast({
    chainId: QORE_CHAIN_ID,
    messages: [{ typeUrl: BANK_SEND_TYPE, value: toBase64(value) }],
    memo: buildMemo(fields),
    gasLimit: 300_000,
  });
}
