import { useEffect, useState } from "react";

import { qoreClient } from "../qore/client.js";
import { QUANTUM_PASS_ABI, QUANTUM_PASS_ADDRESS } from "../qore/quantumPass.js";

export const QORE_TESTNET_ID = 9800;

const contract = { address: QUANTUM_PASS_ADDRESS, abi: QUANTUM_PASS_ABI } as const;

export interface PassStats {
  isLoading: boolean;
  error: Error | null;
  totalPasses: number | null;
  attestedExposedUsdFloor: number | null;
  scoreBuckets: number[] | null;
  chainCounts: number[] | null;
}

const EMPTY: PassStats = { isLoading: true, error: null, totalPasses: null, attestedExposedUsdFloor: null, scoreBuckets: null, chainCounts: null };

// One shared poller for every component on the page.
let cache: PassStats = EMPTY;
const subs = new Set<(s: PassStats) => void>();
let timer: ReturnType<typeof setInterval> | undefined;

async function refresh() {
  try {
    const [total, floor, buckets, chains] = await Promise.all([
      qoreClient.readContract({ ...contract, functionName: "totalPasses" }),
      qoreClient.readContract({ ...contract, functionName: "attestedExposedUsdFloor" }),
      qoreClient.readContract({ ...contract, functionName: "scoreBuckets" }),
      qoreClient.readContract({ ...contract, functionName: "chainCounts" }),
    ]);
    cache = {
      isLoading: false,
      error: null,
      totalPasses: Number(total),
      attestedExposedUsdFloor: Number(floor),
      scoreBuckets: (buckets as readonly bigint[]).map(Number),
      chainCounts: (chains as readonly bigint[]).map(Number),
    };
  } catch (err) {
    cache = { ...cache, isLoading: false, error: err instanceof Error ? err : new Error(String(err)) };
  }
  subs.forEach((f) => f(cache));
}

/** Public counters straight from the QuantumPass contract (anyone can verify them on-chain). */
export function usePassStats(): PassStats {
  const [s, setS] = useState(cache);
  useEffect(() => {
    subs.add(setS);
    if (subs.size === 1) {
      void refresh();
      timer = setInterval(() => void refresh(), 20_000);
    }
    return () => {
      subs.delete(setS);
      if (subs.size === 0 && timer) clearInterval(timer);
    };
  }, []);
  return s;
}
