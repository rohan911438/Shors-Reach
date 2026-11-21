/**
 * Deploy QuantumPass to qorechain-diana and mint the first pass with a real ML-DSA-87 signature.
 *
 *   forge build && npx tsx --env-file=.env scripts/deploy-pass.ts [--mint-only <address>]
 *
 * Steps: open a scoped EVM window (HYBRID-signed native tx) → deploy (EVM) → sign digest with the registered
 * ML-DSA-87 key → mint (EVM). Writes ../deployments/diana.json. The key comes from QORE_MNEMONIC (never written to disk).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { StargateClient } from "@cosmjs/stargate";
import { EthNativeSigner, deriveUnifiedAccount, getNetwork, openEvmWindowMsg, pqcSign, type UnifiedAccount } from "@qorechain/sdk";
import { evmWindowCost, evmWindowStatus } from "@qorechain/evm";
import { bytesToHex, createPublicClient, createWalletClient, defineChain, http, keccak256, toHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const net = getNetwork("testnet");
const REST = net.endpoints.rest;
const RPC = net.endpoints.rpc;
const EVM_RPC = "https://evm-testnet.qore.host";
const diana = defineChain({
  id: 9800,
  name: "QoreChain Testnet",
  nativeCurrency: { name: "QOR", symbol: "QOR", decimals: 18 },
  rpcUrls: { default: { http: [EVM_RPC] } },
});
const root = join(import.meta.dirname, "..", "..");
const outFile = join(root, "deployments", "diana.json");

async function accountSequence(address: string) {
  const res = await fetch(`${REST}/cosmos/auth/v1beta1/accounts/${address}`);
  if (!res.ok) throw new Error(`account query failed: HTTP ${res.status}`);
  const body = (await res.json()) as { account?: Record<string, unknown> };
  const acc = (body.account?.base_account ?? body.account ?? {}) as Record<string, string>;
  return { accountNumber: BigInt(acc.account_number ?? "0"), sequence: BigInt(acc.sequence ?? "0") };
}

async function openWindow(acc: UnifiedAccount, maxTxs: bigint, blocks: bigint): Promise<string> {
  const perTx = evmWindowCost({ gas: 3_000_000n, maxFeePerGas: 250_000_000_000n });
  const msg = openEvmWindowMsg({ sender: acc.cosmos, blocks, maxTxs, maxValue: perTx * maxTxs });
  const { accountNumber, sequence } = await accountSequence(acc.cosmos);
  const signer = new EthNativeSigner(acc, { signMode: "hybrid", rest: REST });
  const transport = await StargateClient.connect(RPC);
  try {
    const res = await signer.signAndBroadcast(transport, {
      chainId: net.chainId,
      accountNumber,
      sequence,
      fee: { amount: [{ denom: "uqor", amount: "100000" }], gas: "800000" },
      messages: [msg],
    });
    if (res.code !== 0) throw new Error(`window tx failed: code ${res.code} ${res.rawLog ?? ""}`);
    return res.transactionHash;
  } finally {
    transport.disconnect();
  }
}

const acc = await deriveUnifiedAccount(process.env.QORE_MNEMONIC!.trim(), 0);
const pk = String(acc.privateKey);
const evmAccount = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as Hex);
if (evmAccount.address.toLowerCase() !== acc.evm.toLowerCase()) throw new Error("derived EVM key mismatch");
const pub = createPublicClient({ chain: diana, transport: http(EVM_RPC) });
const wallet = createWalletClient({ chain: diana, account: evmAccount, transport: http(EVM_RPC) });
console.log(`deployer ${acc.evm} (${acc.cosmos})`);

const artifact = JSON.parse(readFileSync(join(import.meta.dirname, "..", "out", "QuantumPass.sol", "QuantumPass.json"), "utf8"));
const abi = artifact.abi;
const mintOnlyIdx = process.argv.indexOf("--mint-only");
let address = mintOnlyIdx > 0 ? (process.argv[mintOnlyIdx + 1] as Hex) : undefined;
const record: Record<string, unknown> = existsSync(outFile) ? JSON.parse(readFileSync(outFile, "utf8")) : {};

// 1) Hybrid-signed window open (scoped: few txs, short).
const w = await evmWindowStatus({ rest: REST, address: acc.cosmos });
const needTxs = address ? 1n : 2n;
if (!w.live || w.remainingTxs < needTxs) {
  const windowTx = await openWindow(acc, 3n, 1200n);
  console.log(`window opened (hybrid): ${windowTx}`);
  record.windowTx = windowTx;
  await new Promise((r) => setTimeout(r, 6000));
} else console.log(`window live: ${w.remainingTxs} txs left`);

// 2) Deploy
if (!address) {
  // The deployer account doubles as the attester (relayer) for QoreX users' native proofs.
  const hash = await wallet.deployContract({ abi, bytecode: artifact.bytecode.object as Hex, args: [acc.evm] });
  const rcpt = await pub.waitForTransactionReceipt({ hash, timeout: 120_000 });
  if (rcpt.status !== "success" || !rcpt.contractAddress) throw new Error(`deploy failed: ${hash}`);
  address = rcpt.contractAddress;
  console.log(`QuantumPass deployed at ${address} (tx ${hash}, block ${rcpt.blockNumber})`);
  Object.assign(record, { network: "qorechain-diana", evmChainId: 9800, QuantumPass: address, attester: acc.evm, deployTx: hash, deployBlock: Number(rcpt.blockNumber), deployer: acc.evm, deployerQor: acc.cosmos });
}

// 3) First mint with a real ML-DSA-87 signature over the contract's digest.
const scanHash = keccak256(toHex(`shors-reach first pass ${Date.now()}`));
const [score, mask, usd] = [10, 0b11, 7] as const;
const digest = (await pub.readContract({ address, abi, functionName: "digest", args: [acc.evm, scanHash, score, mask, usd] })) as Hex;
const sig = bytesToHex(pqcSign(acc.pqc.secretKey, Uint8Array.from(Buffer.from(digest.slice(2), "hex"))));
const mintHash = await wallet.writeContract({ address, abi, functionName: "mint", args: [scanHash, score, mask, usd, sig], gas: 2_000_000n });
const mr = await pub.waitForTransactionReceipt({ hash: mintHash, timeout: 120_000 });
console.log(`mint ${mr.status}: ${mintHash} gasUsed ${mr.gasUsed}`);
const total = await pub.readContract({ address, abi, functionName: "totalPasses" });
console.log(`totalPasses = ${total}`);
Object.assign(record, { firstMintTx: mintHash, firstMintGasUsed: Number(mr.gasUsed), firstMintStatus: mr.status });

mkdirSync(join(root, "deployments"), { recursive: true });
writeFileSync(outFile, JSON.stringify(record, null, 2) + "\n");
console.log(`wrote ${outFile}`);
