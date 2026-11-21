/**
 * P07 spike: call the PQC precompiles on qorechain-diana with a real ML-DSA-87 signature.
 *   npx tsx --env-file=.env scripts/pq-spike.ts
 * Finding: pqcKeyStatus returns FOUR words (bool, uint8, bytes, uint256) — the SDK's 3-output ABI fails to decode.
 */
import { deriveUnifiedAccount, pqcSign } from "@qorechain/sdk";
import { bytesToHex, createPublicClient, decodeAbiParameters, encodeAbiParameters, encodeFunctionData, http, keccak256, parseAbi } from "viem";

const PQC_VERIFY = "0x0000000000000000000000000000000000000a01";
const PQC_KEY_STATUS = "0x0000000000000000000000000000000000000a02";
const abi = parseAbi([
  "function pqcVerify(bytes pubkey, bytes signature, bytes message) view returns (bool)",
  "function pqcKeyStatus(address account) view returns (bool registered, uint8 algorithmId, bytes pubkey, uint256 extra)",
]);

const client = createPublicClient({ transport: http("https://evm-testnet.qore.host") });
const acc = await deriveUnifiedAccount(process.env.QORE_MNEMONIC!.trim(), 0);
console.log("account", acc.evm);

const st = await client.readContract({ address: PQC_KEY_STATUS, abi, functionName: "pqcKeyStatus", args: [acc.evm as `0x${string}`] });
const ourPk = bytesToHex(acc.pqc.publicKey);
console.log("keyStatus:", { registered: st[0], alg: st[1], pkBytes: (st[2].length - 2) / 2, extra: st[3], matchesOurs: st[2].toLowerCase() === ourPk.toLowerCase() });

const digest = keccak256(encodeAbiParameters([{ type: "string" }], ["shors-reach spike"]));
const msg = Uint8Array.from(Buffer.from(digest.slice(2), "hex"));
const sig = bytesToHex(pqcSign(acc.pqc.secretKey, msg));

for (const [label, m] of [
  ["correct message", digest],
  ["wrong message", keccak256("0x01")],
] as const) {
  const data = encodeFunctionData({ abi, functionName: "pqcVerify", args: [ourPk, sig, m] });
  const ret = await client.call({ to: PQC_VERIFY, data }).catch((e) => ({ data: `ERR ${(e as Error).message.split("\n")[0]}` }));
  const out = ret.data && !String(ret.data).startsWith("ERR") ? decodeAbiParameters([{ type: "bool" }], ret.data as `0x${string}`)[0] : ret.data;
  console.log(`pqcVerify(${label}) →`, out);
  if (label === "correct message") {
    const gas = await client.estimateGas({ to: PQC_VERIFY, data }).catch((e) => `n/a (${(e as Error).message.split("\n")[0]})`);
    console.log("  gas (direct call, incl. 7.2 KB calldata):", gas);
  }
}
