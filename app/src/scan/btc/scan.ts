/**
 * Key-level Bitcoin exposure scan.
 *
 *  - scanBtcAddress: one address → its own verdict, plus every sibling form of any key a spend revealed.
 *  - scanBtcPubkey:  one public key → all 7 output forms it controls (finds Satoshi-style P2PK coins).
 *  - scanBtcXpub:    an HD wallet → receive + change chains with a gap limit, aggregated.
 *
 * Invariant: EXPOSED_NOW always carries evidence that anyone can open.
 */
import { HDKey } from "@scure/bip32";

import type { Holding, ProgressEvent, ReasonCode, Status } from "../types.js";
import { addressUrl, balanceOf, type AddressInfo, type Esplora, fundedCount, spentCount, txUrl, type Tx } from "./esplora.js";
import { revealedKeys, siblingForms, type SiblingForm } from "./pubkeys.js";
import { bytesToHex, decodeAddress, encode, hash160, scripts, type XpubKind, xpubKind } from "./script.js";

export interface BtcContext {
  esplora: Esplora;
  onProgress?: (e: ProgressEvent) => void;
}

const SATS = 100_000_000n;

export function satsToBtc(sats: bigint | number): string {
  const s = BigInt(sats);
  const neg = s < 0n;
  const a = neg ? -s : s;
  const whole = a / SATS;
  const frac = (a % SATS).toString().padStart(8, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
}

function holding(
  locator: string,
  format: Holding["format"],
  sats: number,
  status: Status,
  reason: ReasonCode,
  evidence?: Holding["evidence"],
  details?: Holding["details"],
): Holding {
  return {
    chain: "bitcoin",
    format,
    locator,
    amountBase: String(sats),
    amount: satsToBtc(sats),
    asset: "BTC",
    priceId: "bitcoin",
    usd: null,
    status,
    reason,
    evidence,
    details,
  };
}

/** The first tx in a list that funds the given script (evidence for P2PK / Taproot). */
function fundingTx(txs: Tx[], scriptHex: string): Tx | undefined {
  // Esplora lists newest first; the oldest funding tx is the clearest evidence.
  return [...txs].reverse().find((t) => t.vout.some((o) => o.scriptpubkey === scriptHex));
}

/** First tx that SPENDS the given script (its input reveals the key). */
function spendingTx(txs: Tx[], scriptHex: string): Tx | undefined {
  return [...txs].reverse().find((t) => t.vin.some((i) => i.prevout?.scriptpubkey === scriptHex));
}

interface FormState {
  form: SiblingForm;
  info: AddressInfo;
}

/**
 * Scan every output form of one public key.
 * @param revealTxid a tx already known to reveal this key (from an address scan), if any.
 */
export async function scanBtcPubkey(ctx: BtcContext, pubkeyHex: string, revealTxid?: string): Promise<Holding[]> {
  const forms = siblingForms(pubkeyHex.toLowerCase());
  const states: FormState[] = await Promise.all(
    forms.map(async (form) => ({ form, info: await ctx.esplora.scripthash(form.scripthash) })),
  );

  // Is the key public on-chain? Find the strongest evidence.
  let evidence: Holding["evidence"] | undefined = revealTxid
    ? { txid: revealTxid, url: txUrl(revealTxid), note: "This transaction revealed the public key." }
    : undefined;
  let revealReason: ReasonCode = "btc-key-revealed-by-spend";

  if (!evidence) {
    // 1) a P2PK output: the key IS the output
    const p2pk = states.find((s) => s.form.format === "p2pk" && fundedCount(s.info) > 0);
    // 2) a Taproot (BIP-86) output: the tweaked key is in the output and yields the private key
    const tr = states.find((s) => s.form.format === "p2tr" && fundedCount(s.info) > 0);
    // 3) any spend from a hash form
    const spent = states.find((s) => s.form.format !== "p2pk" && s.form.format !== "p2tr" && spentCount(s.info) > 0);
    const pick = p2pk ?? spent ?? tr;
    if (pick) {
      const txs = await ctx.esplora.txs("scripthash", pick.form.scripthash, 1);
      const tx = pick === spent ? spendingTx(txs, pick.form.scriptHex) : fundingTx(txs, pick.form.scriptHex);
      revealReason = pick === p2pk ? "btc-p2pk-output" : pick === tr ? "btc-taproot-output-key" : "btc-key-revealed-by-spend";
      const note =
        pick === p2pk
          ? "Pay-to-public-key output: the key is written in the output itself."
          : pick === tr
            ? "Taproot output: its 32-byte output key is public from the moment it is funded."
            : "This spend revealed the public key.";
      evidence = tx
        ? { txid: tx.txid, url: txUrl(tx.txid), note }
        : { url: pick.form.address ? addressUrl(pick.form.address) : txUrl(""), note };
    }
  }

  const out: Holding[] = [];
  for (const { form, info } of states) {
    const bal = balanceOf(info);
    if (bal <= 0) continue;
    const locator = form.address ?? `p2pk:${form.encoding}:${form.scripthash}`;
    const details = { encoding: form.encoding, scripthash: form.scripthash };
    if (form.format === "p2pk" || form.format === "p2tr") {
      // Always public at rest — use own funding tx as evidence when we have nothing better.
      let ev = evidence;
      if (!ev) {
        const txs = await ctx.esplora.txs("scripthash", form.scripthash, 1);
        const tx = fundingTx(txs, form.scriptHex);
        ev = { txid: tx?.txid, url: tx ? txUrl(tx.txid) : addressUrl(form.address ?? ""), note: "Key is in the output." };
      }
      out.push(holding(locator, form.format, bal, "EXPOSED_NOW", form.format === "p2pk" ? "btc-p2pk-output" : "btc-taproot-output-key", ev, details));
    } else if (evidence) {
      out.push(holding(locator, form.format, bal, "EXPOSED_NOW", revealReason === "btc-key-revealed-by-spend" ? "btc-sibling-key-revealed" : revealReason, evidence, details));
    } else {
      out.push(holding(locator, form.format, bal, "EXPOSED_ON_SPEND", "btc-hash-hidden", undefined, details));
    }
  }
  return out;
}

/** Scan one address, then follow every key its spends revealed into all sibling forms. */
export async function scanBtcAddress(ctx: BtcContext, addr: string, opts: { followSiblings?: boolean } = {}): Promise<Holding[]> {
  const followSiblings = opts.followSiblings ?? true;
  const dec = decodeAddress(addr);
  const info = await ctx.esplora.address(dec.address);
  const bal = balanceOf(info);

  // Taproot: output key public from funding.
  if (dec.format === "p2tr") {
    if (bal <= 0 && fundedCount(info) === 0) return [];
    const txs = await ctx.esplora.txs("address", dec.address, 1);
    const tx = fundingTx(txs, dec.scriptHex);
    const ev = {
      txid: tx?.txid,
      url: tx ? txUrl(tx.txid) : addressUrl(dec.address),
      note: "Taproot output: its 32-byte output key is public from the moment it is funded.",
    };
    return bal > 0 ? [holding(dec.address, "p2tr", bal, "EXPOSED_NOW", "btc-taproot-output-key", ev)] : [];
  }

  if (spentCount(info) === 0) {
    return bal > 0 ? [holding(dec.address, dec.format, bal, "EXPOSED_ON_SPEND", "btc-hash-hidden")] : [];
  }

  // Spent at least once → the key (or script) has been revealed.
  const txs = await ctx.esplora.txs("address", dec.address);
  const keys = revealedKeys(dec.format, dec.program, dec.scriptHex, txs);
  const spend = spendingTx(txs, dec.scriptHex);
  const isMultisig = keys.some((k) => k.role === "cosigner");
  const ownEvidence = spend
    ? { txid: spend.txid, url: txUrl(spend.txid), note: "This spend revealed the public key." }
    : { url: addressUrl(dec.address), note: `Spent ${spentCount(info)} time(s); each spend reveals the key.` };

  const out: Holding[] = [];
  if (bal > 0) {
    out.push(
      holding(
        dec.address,
        keys.length === 1 && dec.format === "p2sh" ? "p2sh-p2wpkh" : dec.format,
        bal,
        "EXPOSED_NOW",
        isMultisig ? "btc-multisig-cosigner-revealed" : "btc-key-revealed-by-spend",
        ownEvidence,
        isMultisig ? { cosigners: keys.length } : undefined,
      ),
    );
  }

  if (followSiblings) {
    for (const k of keys.slice(0, 15)) {
      ctx.onProgress?.({ type: "info", message: `Following revealed key ${k.pubkey.slice(0, 10)}… into 7 output forms` });
      try {
        out.push(...(await scanBtcPubkey(ctx, k.pubkey, k.txid)));
      } catch {
        // One slow sibling lookup must not throw away everything else we already proved.
        ctx.onProgress?.({ type: "info", message: `Could not follow key ${k.pubkey.slice(0, 10)}… (data source timed out) — other results kept` });
      }
    }
  }
  return dedupe(out);
}

/** Keep one holding per locator, preferring the most severe, evidence-backed verdict. */
export function dedupe(hs: Holding[]): Holding[] {
  const rank: Record<Status, number> = { EXPOSED_NOW: 3, UNKNOWN: 2, EXPOSED_ON_SPEND: 1, PROTECTED: 0 };
  const best = new Map<string, Holding>();
  for (const h of hs) {
    const key = `${h.chain}:${h.locator}`;
    const prev = best.get(key);
    if (!prev || rank[h.status] > rank[prev.status]) best.set(key, h);
  }
  return [...best.values()];
}

// ---------- HD wallets (xpub / ypub / zpub) ----------

const VERSIONS: Record<XpubKind, number> = { xpub: 0x0488b21e, ypub: 0x049d7cb2, zpub: 0x04b24746 };

export function deriveXpubAddress(xpub: string, change: 0 | 1, index: number): string {
  const kind = xpubKind(xpub);
  if (!kind) throw new Error("Unsupported extended public key.");
  const root = HDKey.fromExtendedKey(xpub.trim(), { public: VERSIONS[kind], private: 0 });
  const pk = root.deriveChild(change).deriveChild(index).publicKey;
  if (!pk) throw new Error("derivation failed");
  const h = hash160(pk);
  if (kind === "xpub") return encode.p2pkh(h);
  if (kind === "zpub") return encode.p2wpkh(h);
  // ypub: P2SH-P2WPKH
  return encode.p2sh(hash160(hexToBytesSafe(scripts.p2wpkh(h))));
}

function deriveFormat(xpub: string): Holding["format"] {
  const k = xpubKind(xpub);
  return k === "zpub" ? "p2wpkh" : k === "ypub" ? "p2sh-p2wpkh" : "p2pkh";
}

function hexToBytesSafe(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/../g)!.map((b) => parseInt(b, 16)));
}

export interface XpubScanOptions {
  gapLimit?: number;
  maxAddresses?: number;
}

/**
 * Scan an HD wallet. The xpub never leaves this function: only derived addresses are queried, and nothing is logged.
 */
export async function scanBtcXpub(ctx: BtcContext, xpub: string, opts: XpubScanOptions = {}): Promise<{ holdings: Holding[]; addressesScanned: number }> {
  const gap = opts.gapLimit ?? 20;
  const max = opts.maxAddresses ?? 200;
  const out: Holding[] = [];
  let scanned = 0;
  for (const change of [0, 1] as const) {
    let unused = 0;
    for (let i = 0; unused < gap && scanned < max; i++) {
      const addr = deriveXpubAddress(xpub, change, i);
      scanned++;
      const info = await ctx.esplora.address(addr);
      if (info.chain_stats.tx_count + info.mempool_stats.tx_count === 0) {
        unused++;
        continue;
      }
      unused = 0;
      try {
        const hs = await scanBtcAddress(ctx, addr);
        out.push(...hs.map((h) => ({ ...h, details: { ...h.details, hdPath: `${change}/${i}` } })));
      } catch {
        // Keep the wallet scan going; this address becomes UNKNOWN (never "safe") with the balance we already know.
        const bal = balanceOf(info);
        if (bal > 0) out.push(holding(addr, deriveFormat(xpub), bal, "UNKNOWN", "source-unavailable", undefined, { hdPath: `${change}/${i}` }));
        ctx.onProgress?.({ type: "info", message: `Lookup for one wallet address timed out — marked Unknown, scan continues` });
      }
    }
    ctx.onProgress?.({ type: "info", message: `${change === 0 ? "Receive" : "Change"} chain done (${scanned} addresses so far)` });
  }
  return { holdings: dedupe(out), addressesScanned: scanned };
}

export { bytesToHex };
