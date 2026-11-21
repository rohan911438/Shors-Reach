/**
 * Live end-to-end test of the QoreX-style Quantum Pass path on qorechain-diana, with a FRESH account
 * (index 1 of the testnet mnemonic):
 *   fund from account 0 (hybrid) → register ML-DSA-87 key (classical, ONE attempt, never retried)
 *   → proof tx: 1 uqor to self + pass memo (hybrid, exactly what QoreX's signAndBroadcast produces)
 *   → the real POST /api/attest handler → passOf(holder) on-chain.
 *
 *   npx tsx --env-file=../contracts/.env scripts/attest-e2e.ts
 */
import { StargateClient } from "@cosmjs/stargate";
import {
  buildRegisterPqcKeyMsg,
  deriveUnifiedAccount,
  EthNativeSigner,
  fetchPqcStatus,
  getNetwork,
  signProofOfPossession,
  type UnifiedAccount,
} from "@qorechain/sdk";
import { createPublicClient, defineChain, http } from "viem";

import { POST } from "../api/attest.js";
import { buildMemo } from "../src/pass/proof.js";
import { QUANTUM_PASS_ABI, QUANTUM_PASS_ADDRESS } from "../src/qore/quantumPass.js";

const net = getNetwork("testnet");
const REST = net.endpoints.rest;
const FEE = { amount: [{ denom: "uqor", amount: "100000" }], gas: "800000" };
const mnemonic = process.env.QORE_MNEMONIC!.trim();
process.env.QORE_ATTESTER_MNEMONIC = mnemonic;

async function seq(address: string) {
  const body = (await (await fetch(`${REST}/cosmos/auth/v1beta1/accounts/${address}`)).json()) as { account?: Record<string, unknown> };
  const a = (body.account?.base_account ?? body.account ?? {}) as Record<string, string>;
  return { accountNumber: BigInt(a.account_number ?? "0"), sequence: BigInt(a.sequence ?? "0") };
}
async function balance(address: string) {
  const b = (await (await fetch(`${REST}/cosmos/bank/v1beta1/balances/${address}/by_denom?denom=uqor`)).json()) as { balance?: { amount: string } };
  return BigInt(b.balance?.amount ?? "0");
}
async function send(acc: UnifiedAccount, mode: "hybrid" | "classical", messages: { typeUrl: string; value: unknown }[], memo = "") {
  const { accountNumber, sequence } = await seq(acc.cosmos);
  const signer = new EthNativeSigner(acc, { signMode: mode, rest: REST });
  const client = await StargateClient.connect(net.endpoints.rpc);
  try {
    const res = await signer.signAndBroadcast(client, { chainId: net.chainId, accountNumber, sequence, fee: FEE, messages: messages as never, memo });
    if (res.code !== 0) throw new Error(`tx failed code ${res.code}: ${res.rawLog ?? ""}`);
    return res.transactionHash;
  } finally {
    client.disconnect();
  }
}
const msgSend = (from: string, to: string, amount: string) => ({
  typeUrl: "/cosmos.bank.v1beta1.MsgSend",
  value: { fromAddress: from, toAddress: to, amount: [{ denom: "uqor", amount }] },
});
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const funder = await deriveUnifiedAccount(mnemonic, 0);
const user = await deriveUnifiedAccount(mnemonic, 1);
console.log(`user (fresh) ${user.cosmos} / ${user.evm}`);

if ((await balance(user.cosmos)) < 1_000_000n) {
  console.log(`fund 2 QOR (hybrid): ${await send(funder, "hybrid", [msgSend(funder.cosmos, user.cosmos, "2000000")])}`);
  await wait(7000);
}

const pqc = await fetchPqcStatus({ rest: REST, address: user.cosmos });
if (!pqc.registered) {
  const pop = signProofOfPossession({ chainId: net.chainId, account: user.cosmos, keypair: user.pqc });
  // ONE attempt only: a second, different key would be refused after the fee is taken.
  console.log(`register ML-DSA-87 key (classical, once): ${await send(user, "classical", [buildRegisterPqcKeyMsg(user.cosmos, { pqcKeypair: user.pqc, proofOfPossession: pop })])}`);
  await wait(7000);
} else console.log("PQ key already registered");

const fields = { scanHash: `0x${"5a".repeat(32)}` as const, scoreBucket: 4, chainsMask: 0b110, exposedUsdBucket: 6 };
const proofTx = await send(user, "hybrid", [msgSend(user.cosmos, user.cosmos, "1")], buildMemo(fields));
console.log(`proof tx (hybrid, memo): ${proofTx}`);
await wait(7000);

const res = await POST(new Request("http://local/api/attest", { method: "POST", body: JSON.stringify({ txHash: proofTx }) }));
console.log(`POST /api/attest → ${res.status}`, await res.text());

const pub = createPublicClient({
  chain: defineChain({ id: 9800, name: "diana", nativeCurrency: { name: "QOR", symbol: "QOR", decimals: 18 }, rpcUrls: { default: { http: ["https://evm-testnet.qore.host"] } } }),
  transport: http(),
});
console.log("passOf(user):", await pub.readContract({ address: QUANTUM_PASS_ADDRESS, abi: QUANTUM_PASS_ABI, functionName: "passOf", args: [user.evm as `0x${string}`] }));
console.log("totalPasses:", await pub.readContract({ address: QUANTUM_PASS_ADDRESS, abi: QUANTUM_PASS_ABI, functionName: "totalPasses" }));

const again = await POST(new Request("http://local/api/attest", { method: "POST", body: JSON.stringify({ txHash: proofTx }) }));
console.log(`re-submit same proof → ${again.status}`, await again.text());
