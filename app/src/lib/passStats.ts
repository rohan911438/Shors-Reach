import { useReadContracts } from "wagmi";

import { QUANTUM_PASS_ABI, QUANTUM_PASS_ADDRESS } from "../qore/quantumPass.js";

export const QORE_TESTNET_ID = 9800;

const contract = { address: QUANTUM_PASS_ADDRESS, abi: QUANTUM_PASS_ABI, chainId: QORE_TESTNET_ID } as const;

/** Public counters straight from the QuantumPass contract (anyone can verify them on-chain). */
export function usePassStats() {
  const q = useReadContracts({
    contracts: [
      { ...contract, functionName: "totalPasses" },
      { ...contract, functionName: "attestedExposedUsdFloor" },
      { ...contract, functionName: "scoreBuckets" },
      { ...contract, functionName: "chainCounts" },
    ],
    query: { refetchInterval: 20_000 },
  });
  const [total, floor, buckets, chains] = q.data ?? [];
  return {
    isLoading: q.isLoading,
    error: q.error,
    totalPasses: total?.status === "success" ? Number(total.result) : null,
    attestedExposedUsdFloor: floor?.status === "success" ? Number(floor.result) : null,
    scoreBuckets: buckets?.status === "success" ? (buckets.result as readonly bigint[]).map(Number) : null,
    chainCounts: chains?.status === "success" ? (chains.result as readonly bigint[]).map(Number) : null,
  };
}
