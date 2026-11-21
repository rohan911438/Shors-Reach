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

export class Esplora {
  constructor(
    private readonly net: Net,
    readonly base: string = DEFAULT_ESPLORA,
  ) {}

  address(addr: string): Promise<AddressInfo> {
    return this.net.json<AddressInfo>({ url: `${this.base}/address/${addr}` });
  }

  scripthash(hash: string): Promise<AddressInfo> {
    return this.net.json<AddressInfo>({ url: `${this.base}/scripthash/${hash}` });
  }

  /** UTXO list, or null when the server refuses (mempool.space caps at 500 UTXOs). */
  async utxos(addr: string): Promise<Utxo[] | null> {
    try {
      return await this.net.json<Utxo[]>({ url: `${this.base}/address/${addr}/utxo` });
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
    const base = `${this.base}/${kind}/${id}/txs`;
    const first = await this.net.json<Tx[]>({ url: base });
    const all = [...first];
    let confirmed = first.filter((t) => t.status.confirmed);
    for (let page = 1; page < maxPages && confirmed.length >= 25; page++) {
      const last = confirmed[confirmed.length - 1]!.txid;
      const next = await this.net.json<Tx[]>({ url: `${base}/chain/${last}` });
      if (next.length === 0) break;
      all.push(...next);
      confirmed = next;
    }
    return all;
  }
}

export const txUrl = (txid: string) => `https://mempool.space/tx/${txid}`;
export const addressUrl = (addr: string) => `https://mempool.space/address/${addr}`;
