/**
 * Typed client for the Esplora REST API (mempool.space by default).
 * Docs: https://mempool.space/docs/api/rest
 */
import { HttpError, type Net } from "../net.js";

export const DEFAULT_ESPLORA = "https://mempool.space/api";

export interface TxoStats {
  funded_txo_count: number;
  funded_txo_sum: number;
  spent_txo_count: number;
  spent_txo_sum: number;
  tx_count: number;
}

export interface AddressInfo {
  address?: string;
  scripthash?: string;
  chain_stats: TxoStats;
  mempool_stats: TxoStats;
}

export interface Prevout {
  scriptpubkey: string;
  scriptpubkey_type: string;
  scriptpubkey_address?: string;
  value: number;
}

export interface Vin {
  txid: string;
  vout: number;
  prevout: Prevout | null;
  scriptsig: string;
  scriptsig_asm?: string;
  witness?: string[];
  is_coinbase: boolean;
  inner_redeemscript_asm?: string;
  inner_witnessscript_asm?: string;
}

export interface Vout {
  scriptpubkey: string;
  scriptpubkey_type: string;
  scriptpubkey_address?: string;
  value: number;
}

export interface Tx {
  txid: string;
  vin: Vin[];
  vout: Vout[];
  status: { confirmed: boolean; block_height?: number; block_time?: number };
}

export interface Utxo {
  txid: string;
  vout: number;
  value: number;
  status: { confirmed: boolean; block_height?: number };
}

/** Confirmed + mempool balance in sats. */
export function balanceOf(info: AddressInfo): number {
  const c = info.chain_stats;
  const m = info.mempool_stats;
  return c.funded_txo_sum - c.spent_txo_sum + (m.funded_txo_sum - m.spent_txo_sum);
}

export function spentCount(info: AddressInfo): number {
  return info.chain_stats.spent_txo_count + info.mempool_stats.spent_txo_count;
}

export function fundedCount(info: AddressInfo): number {
  return info.chain_stats.funded_txo_count + info.mempool_stats.funded_txo_count;
}

/** Same Esplora API, different operator — used when the primary rate-limits or times out. */
export const FALLBACK_ESPLORA = ["https://blockstream.info/api"];

/** Rate limits, server errors and timeouts are worth retrying elsewhere; a 4xx answer is a real answer. */
function shouldFailover(err: unknown): boolean {
  if (err instanceof HttpError) return err.status === 429 || err.status >= 500;
  return true; // network error / timeout
}

export class Esplora {
  private readonly bases: string[];
  private active = 0;

  constructor(
    private readonly net: Net,
    base: string = DEFAULT_ESPLORA,
    fallbacks: string[] = [],
  ) {
    this.bases = [base, ...fallbacks.filter((f) => f !== base)];
  }

  /** The provider currently answering (sticky after a failover). */
  get base(): string {
    return this.bases[this.active]!;
  }

  private async get<T>(path: string): Promise<T> {
    let lastErr: unknown;
    for (let i = this.active; i < this.bases.length; i++) {
      try {
        const v = await this.net.json<T>({ url: `${this.bases[i]}${path}` });
        this.active = i;
        return v;
      } catch (err) {
        lastErr = err;
        if (!shouldFailover(err)) throw err;
      }
    }
    throw lastErr;
  }

  address(addr: string): Promise<AddressInfo> {
    return this.get<AddressInfo>(`/address/${addr}`);
  }

  scripthash(hash: string): Promise<AddressInfo> {
    return this.get<AddressInfo>(`/scripthash/${hash}`);
  }

  /** UTXO list, or null when the server refuses (mempool.space caps at 500 UTXOs). */
  async utxos(addr: string): Promise<Utxo[] | null> {
    try {
      return await this.get<Utxo[]>(`/address/${addr}/utxo`);
    } catch (err) {
      if (err instanceof HttpError && err.status === 400) return null;
      throw err;
    }
  }

  /**
   * Transactions of an address or scripthash, newest first, up to `maxPages` pages of confirmed txs.
   * First page = up to 50 mempool txs + first 25 confirmed; further pages via /txs/chain/{last_txid}.
   */
  async txs(kind: "address" | "scripthash", id: string, maxPages = 4): Promise<Tx[]> {
    const path = `/${kind}/${id}/txs`;
    const first = await this.get<Tx[]>(path);
    const all = [...first];
    let confirmed = first.filter((t) => t.status.confirmed);
    for (let page = 1; page < maxPages && confirmed.length >= 25; page++) {
      const last = confirmed[confirmed.length - 1]!.txid;
      const next = await this.get<Tx[]>(`${path}/chain/${last}`);
      if (next.length === 0) break;
      all.push(...next);
      confirmed = next;
    }
    return all;
  }
}

export const txUrl = (txid: string) => `https://mempool.space/tx/${txid}`;
export const addressUrl = (addr: string) => `https://mempool.space/address/${addr}`;
