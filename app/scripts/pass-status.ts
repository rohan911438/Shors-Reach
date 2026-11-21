/** Read Quantum Pass state:  npx tsx scripts/pass-status.ts [0xholder] [0xnativeTxHash] */
import { createPublicClient, defineChain, http } from "viem";

import { QUANTUM_PASS_ABI as abi, QUANTUM_PASS_ADDRESS as address } from "../src/qore/quantumPass.js";

const pub = createPublicClient({
  chain: defineChain({ id: 9800, name: "diana", nativeCurrency: { name: "QOR", symbol: "QOR", decimals: 18 }, rpcUrls: { default: { http: ["https://evm-testnet.qore.host"] } } }),
  transport: http(),
});
const [holder, proof] = process.argv.slice(2) as (`0x${string}` | undefined)[];
console.log("contract", address);
console.log("totalPasses", await pub.readContract({ address, abi, functionName: "totalPasses" }));
console.log("attestedExposedUsdFloor", await pub.readContract({ address, abi, functionName: "attestedExposedUsdFloor" }));
if (holder) console.log("passOf", holder, await pub.readContract({ address, abi, functionName: "passOf", args: [holder] }));
if (proof) console.log("nativeTxUsed", proof, await pub.readContract({ address, abi, functionName: "nativeTxUsed", args: [proof] }));
