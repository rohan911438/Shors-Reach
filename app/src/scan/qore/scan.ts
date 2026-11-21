/**
 * QoreChain account scan (testnet qorechain-diana).
 *
 * - Native lane: every tx must carry an ML-DSA-87 signature → PROTECTED once a PQ key is registered.
 * - EVM lane: secp256k1-only txs are admitted only inside an open window → worst case = window scope.
 * - Unregistered account: the FIRST key registration is the one classical-only tx, so whoever breaks
 *   the ECDSA key first can register their own PQ key → as weak as Ethereum.
 */
import { bech32 } from "@scure/base";
import { getAddress, isAddress } from "viem";

import type { Net } from "../net.js";
import type { Holding, QoreAccountFacts, SourceHealth } from "../types.js";

/** In the browser the REST API needs a same-origin proxy (no CORS headers upstream). */
export const QORE_REST_DIRECT = "https://api-testnet.qore.host";
export const QORE_EXPLORER = "https://explore.qore.network";

export function evmToQor(evm: string): string {
  const hex = getAddress(evm).slice(2);
  const bytes = Uint8Array.from(hex.match(/../g)!.map((b) => parseInt(b, 16)));
  return bech32.encode("qor", bech32.toWords(bytes));
}

export function qorToEvm(qor: string): string {
  const { prefix, words } = bech32.decode(qor.trim().toLowerCase() as `${string}1${string}`);
  if (prefix !== "qor") throw new Error("Not a qor1 address.");
  const bytes = bech32.fromWords(words);
  if (bytes.length !== 20) throw new Error("Unexpected qor1 address length.");
  return getAddress(`0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`);
}

export function isQorAddress(s: string): boolean {
  try {
    qorToEvm(s);
    return true;
  } catch {
    return false;
  }
}

interface PqcParams {
  params: { hybrid_signature_mode_name?: string; allow_classical_fallback?: boolean };
}
interface PqcAccount {
  found: boolean;
  account: null | { possession_proven?: boolean; algorithm_name?: string; key_type?: string; created_at_height?: string };
}
interface EvmWindow {
  found: boolean;
  live: boolean;
  remaining_blocks: string;
  remaining_txs: string;
  remaining_value: string;
  native_only: boolean;
  allowed_targets: string[];
}
interface Balances {
  balances: { denom: string; amount: string }[];
}

export interface QoreScanResult {
  facts: QoreAccountFacts | null;
  holdings: Holding[];
  sources: SourceHealth[];
}

const uqorToQor = (u: bigint) => {
  const whole = u / 1_000_000n;
  const frac = (u % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return `${whole}${frac ? `.${frac}` : ""}`;
};

export async function scanQore(net: Net, input: string, rest = QORE_REST_DIRECT): Promise<QoreScanResult> {
  const evm = isAddress(input, { strict: false }) ? getAddress(input) : qorToEvm(input);
  const qor = evmToQor(evm);
  try {
    const [params, account, window, balances] = await Promise.all([
      net.json<PqcParams>({ url: `${rest}/qorechain/pqc/v1/params` }),
      net.json<PqcAccount>({ url: `${rest}/qorechain/pqc/v1/account/${qor}` }),
      net.json<EvmWindow>({ url: `${rest}/qorechain/pqc/v1/evm_window/${qor}` }),
      net.json<Balances>({ url: `${rest}/cosmos/bank/v1beta1/balances/${qor}` }).catch(() => ({ balances: [] })),
    ]);
    const bal = BigInt(balances.balances.find((b) => b.denom === "uqor")?.amount ?? "0");
    const registered = account.found;
    const live = window.found && window.live;
    const remainingValue = live ? BigInt(window.remaining_value || "0") : 0n;
    const enforced = params.params.hybrid_signature_mode_name === "required" && params.params.allow_classical_fallback === false;
    const maxLoss = !registered ? bal : live ? (remainingValue < bal ? remainingValue : bal) : 0n;

    const facts: QoreAccountFacts = {
      address: qor,
      evmAddress: evm,
      pqKeyRegistered: registered,
      possessionProven: account.account?.possession_proven ?? null,
      window: window.found
        ? {
            live: window.live,
            remainingBlocks: window.remaining_blocks,
            remainingTxs: window.remaining_txs,
            remainingValueUqor: window.remaining_value || "0",
            nativeOnly: window.native_only,
            allowedTargets: window.allowed_targets ?? [],
          }
        : null,
      maxLossIfEcdsaBreaksUqor: maxLoss.toString(),
      balanceUqor: bal.toString(),
    };

    const base = {
      chain: "qorechain" as const,
      locator: qor,
      amountBase: bal.toString(),
      amount: uqorToQor(bal),
      asset: "QOR (testnet)",
      usd: null,
      details: { testnet: true, maxLossIfEcdsaBreaksUqor: maxLoss.toString(), ...(bal === 0n ? { zeroBalance: true } : {}) },
    };
    const accountUrl = `${rest === QORE_REST_DIRECT ? QORE_REST_DIRECT : QORE_REST_DIRECT}/qorechain/pqc/v1/account/${qor}`;
    let holding: Holding;
    if (!enforced) {
      holding = { ...base, format: "qore-native", status: "UNKNOWN", reason: "qore-params-not-enforced" };
    } else if (!registered) {
      holding = {
        ...base,
        format: "qore-native",
        status: "EXPOSED_NOW",
        reason: "qore-pq-key-not-registered",
        evidence: { url: accountUrl, note: "No ML-DSA-87 key registered: the first registration only needs the classical signature." },
      };
    } else if (live) {
      holding = {
        ...base,
        format: "qore-evm-window",
        status: "PROTECTED",
        reason: "qore-evm-window-open",
        evidence: { url: `${QORE_REST_DIRECT}/qorechain/pqc/v1/evm_window/${qor}`, note: "An open EVM window admits secp256k1-only txs within its limits." },
      };
    } else {
      holding = { ...base, format: "qore-native", status: "PROTECTED", reason: "qore-native-pq-required", evidence: { url: accountUrl } };
    }
    return { facts, holdings: [holding], sources: [{ source: "qorechain-rest", ok: true }] };
  } catch (err) {
    return { facts: null, holdings: [], sources: [{ source: "qorechain-rest", ok: false, error: err instanceof Error ? err.message : String(err) }] };
  }
}
