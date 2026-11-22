/**
 * POST /api/attest  { "txHash": "<native tx hash>" }
 *
 * Attester for QoreX users: verifies their hybrid-signed native proof tx (see src/pass/proof.ts) and mints the
 * Quantum Pass via QuantumPass.attest(). Server secret: QORE_ATTESTER_MNEMONIC (testnet account that deployed the
 * contract). Before its own EVM tx, it opens a short EVM window — hybrid-signed, scoped to 2 txs and value 0.
 */
import { StargateClient } from "@cosmjs/stargate";
import { evmWindowStatus } from "@qorechain/evm";
import { deriveUnifiedAccount, EthNativeSigner, getNetwork, openEvmWindowMsg } from "@qorechain/sdk";
import { createPublicClient, createWalletClient, defineChain, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { createRateLimiter } from "../src/lib/rateLimit.js";
import { attestFromNativeTx } from "../src/pass/relayer.js";
import { QUANTUM_PASS_ABI, QUANTUM_PASS_ADDRESS } from "../src/qore/quantumPass.js";

const net = getNetwork("testnet");
const REST = net.endpoints.rest;
const EVM_RPC = "https://evm-testnet.qore.host";
const PQC_KEY_STATUS = "0x0000000000000000000000000000000000000a02" as const;
const KEY_STATUS_ABI = [
  {
    type: "function",
    name: "pqcKeyStatus",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [
      { name: "registered", type: "bool" },
      { name: "algorithmId", type: "uint8" },
      { name: "pubkey", type: "bytes" },
      { name: "extra", type: "uint256" },
    ],
  },
] as const;
const diana = defineChain({
  id: 9800,
  name: "QoreChain Testnet",
  nativeCurrency: { name: "QOR", symbol: "QOR", decimals: 18 },
  rpcUrls: { default: { http: [EVM_RPC] } },
});
const pub = createPublicClient({ chain: diana, transport: http(EVM_RPC) });

async function accountSequence(address: string) {
  const res = await fetch(`${REST}/cosmos/auth/v1beta1/accounts/${address}`);
  const body = (await res.json()) as { account?: Record<string, unknown> };
  const acc = (body.account?.base_account ?? body.account ?? {}) as Record<string, string>;
  return { accountNumber: BigInt(acc.account_number ?? "0"), sequence: BigInt(acc.sequence ?? "0") };
}

// Each successful attest costs the attester gas: 5 requests per IP per hour.
const limiter = createRateLimiter(5);

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function POST(request: Request): Promise<Response> {
  const mnemonic = process.env.QORE_ATTESTER_MNEMONIC?.trim();
  if (!mnemonic) return json(503, { error: "Attester not configured on this deployment.", code: "no-attester" });
  const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
  if (limiter.limited(ip)) return json(429, { error: "Too many requests — try again later.", code: "rate-limited" });
  let txHash = "";
  try {
    txHash = String(((await request.json()) as { txHash?: unknown }).txHash ?? "");
  } catch {
    return json(400, { error: "Body must be JSON { txHash }.", code: "bad-body" });
  }

  const acc = await deriveUnifiedAccount(mnemonic, 0);
  const pk = String(acc.privateKey);
  const evmAccount = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as Hex);
  const wallet = createWalletClient({ chain: diana, account: evmAccount, transport: http(EVM_RPC) });

  const result = await attestFromNativeTx(txHash, {
    rest: REST,
    fetchJson: async (url) => {
      const r = await fetch(url);
      return { status: r.status, body: r.ok ? await r.json() : null };
    },
    hasPass: async (holder) => (await pub.readContract({ address: QUANTUM_PASS_ADDRESS, abi: QUANTUM_PASS_ABI, functionName: "balanceOf", args: [holder] })) > 0n,
    proofUsed: async (h) => pub.readContract({ address: QUANTUM_PASS_ADDRESS, abi: QUANTUM_PASS_ABI, functionName: "nativeTxUsed", args: [h] }) as Promise<boolean>,
    keyRegistered: async (holder) => (await pub.readContract({ address: PQC_KEY_STATUS, abi: KEY_STATUS_ABI, functionName: "pqcKeyStatus", args: [holder] }))[0],
    submit: async (a) => {
      let windowTxHash: string | undefined;
      const w = await evmWindowStatus({ rest: REST, address: acc.cosmos });
      if (!w.live || w.remainingTxs < 1n) {
        const { accountNumber, sequence } = await accountSequence(acc.cosmos);
        const signer = new EthNativeSigner(acc, { signMode: "hybrid", rest: REST });
        const client = await StargateClient.connect(net.endpoints.rpc);
        try {
          const res = await signer.signAndBroadcast(client, {
            chainId: net.chainId,
            accountNumber,
            sequence,
            fee: { amount: [{ denom: "uqor", amount: "100000" }], gas: "800000" },
            messages: [openEvmWindowMsg({ sender: acc.cosmos, blocks: 300n, maxTxs: 2n, maxValue: 0n })],
          });
          if (res.code !== 0) throw new Error(`window open failed (code ${res.code})`);
          windowTxHash = res.transactionHash;
        } finally {
          client.disconnect();
        }
        await new Promise((r) => setTimeout(r, 6000));
      }
      const hash = await wallet.writeContract({
        address: QUANTUM_PASS_ADDRESS,
        abi: QUANTUM_PASS_ABI,
        functionName: "attest",
        args: [a.holder, a.scanHash, a.scoreBucket, a.chainsMask, a.exposedUsdBucket, a.nativeTxHash],
        gas: 600_000n,
      });
      const rcpt = await pub.waitForTransactionReceipt({ hash, timeout: 60_000 });
      if (rcpt.status !== "success") throw new Error(`attest reverted: ${hash}`);
      return { evmTxHash: hash, windowTxHash };
    },
  }).catch((err: unknown) => ({ status: 502 as const, body: { error: err instanceof Error ? err.message : String(err), code: "submit-failed" } }));

  return json(result.status, result.body);
}
