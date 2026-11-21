/**
 * Recover public keys that a spend revealed, and derive every "sibling" output form of a key.
 *
 * One secp256k1 key controls several script types. Revealing it in ANY of them exposes ALL of them —
 * this is the first trap a naive, address-level scanner falls into.
 */
import { schnorr, secp256k1 } from "@noble/curves/secp256k1";

import type { BtcFormat } from "../types.js";
import type { Tx } from "./esplora.js";
import { bytesToHex, encode, esploraScripthash, hash160, hexToBytes, scripts, sha256 } from "./script.js";

/** Parse the data pushes of a script (ignores non-push opcodes). */
export function scriptPushes(scriptHex: string): Uint8Array[] {
  const b = hexToBytes(scriptHex);
  const out: Uint8Array[] = [];
  let i = 0;
  while (i < b.length) {
    const op = b[i++]!;
    let len = -1;
    if (op >= 0x01 && op <= 0x4b) len = op;
    else if (op === 0x4c) len = b[i++] ?? 0;
    else if (op === 0x4d) {
      len = (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8);
      i += 2;
    } else if (op === 0x4e) {
      len = ((b[i] ?? 0) | ((b[i + 1] ?? 0) << 8) | ((b[i + 2] ?? 0) << 16) | ((b[i + 3] ?? 0) << 24)) >>> 0;
      i += 4;
    }
    if (len >= 0) {
      if (i + len > b.length) break; // malformed: stop rather than throw
      out.push(b.slice(i, i + len));
      i += len;
    }
  }
  return out;
}

/** True when bytes are a valid secp256k1 point encoding (33 or 65 bytes). */
export function isValidPubkey(b: Uint8Array): boolean {
  if (!((b.length === 33 && (b[0] === 2 || b[0] === 3)) || (b.length === 65 && b[0] === 4))) return false;
  try {
    secp256k1.ProjectivePoint.fromHex(b).assertValidity();
    return true;
  } catch {
    return false;
  }
}

/** All valid public keys pushed inside a script (multisig, HTLCs, …). */
export function pubkeysInScript(scriptHex: string): Uint8Array[] {
  return scriptPushes(scriptHex).filter(isValidPubkey);
}

export interface RevealedKey {
  pubkey: string; // hex as revealed
  txid: string; // the spend that revealed it
  /** "single" = the address's own key; "cosigner" = one key of a multisig/script. */
  role: "single" | "cosigner";
}

/**
 * From the transactions of an address, extract the public keys revealed by inputs that spend it.
 * Every key is checked against the address's program, so a wrong parse can never produce a false alarm.
 */
export function revealedKeys(
  format: BtcFormat,
  program: Uint8Array,
  scriptHex: string,
  txs: Tx[],
): RevealedKey[] {
  const found = new Map<string, RevealedKey>();
  const programHex = bytesToHex(program);
  const add = (pk: Uint8Array, txid: string, role: RevealedKey["role"]) => {
    const hex = bytesToHex(pk);
    if (!found.has(hex)) found.set(hex, { pubkey: hex, txid, role });
  };

  for (const tx of txs) {
    for (const vin of tx.vin) {
      if (vin.is_coinbase || !vin.prevout || vin.prevout.scriptpubkey !== scriptHex) continue;
      const witness = (vin.witness ?? []).map((w) => hexToBytes(w));
      const sigPushes = vin.scriptsig ? scriptPushes(vin.scriptsig) : [];

      switch (format) {
        case "p2pkh": {
          const pk = sigPushes[sigPushes.length - 1];
          if (pk && isValidPubkey(pk) && bytesToHex(hash160(pk)) === programHex) add(pk, tx.txid, "single");
          break;
        }
        case "p2wpkh": {
          const pk = witness[1];
          if (pk && isValidPubkey(pk) && bytesToHex(hash160(pk)) === programHex) add(pk, tx.txid, "single");
          break;
        }
        case "p2sh": {
          const redeem = sigPushes[sigPushes.length - 1];
          if (!redeem || bytesToHex(hash160(redeem)) !== programHex) break;
          const redeemHex = bytesToHex(redeem);
          if (/^0014[0-9a-f]{40}$/.test(redeemHex)) {
            // P2SH-P2WPKH: key in witness[1], must hash to the inner program
            const pk = witness[1];
            if (pk && isValidPubkey(pk) && bytesToHex(hash160(pk)) === redeemHex.slice(4)) add(pk, tx.txid, "single");
          } else if (/^0020[0-9a-f]{64}$/.test(redeemHex)) {
            // P2SH-P2WSH: witness script is the last witness item
            const ws = witness[witness.length - 1];
            if (ws && bytesToHex(sha256(ws)) === redeemHex.slice(4)) {
              for (const pk of pubkeysInScript(bytesToHex(ws))) add(pk, tx.txid, "cosigner");
            }
          } else {
            for (const pk of pubkeysInScript(redeemHex)) add(pk, tx.txid, "cosigner");
          }
          break;
        }
        case "p2wsh": {
          const ws = witness[witness.length - 1];
          if (ws && bytesToHex(sha256(ws)) === programHex) {
            for (const pk of pubkeysInScript(bytesToHex(ws))) add(pk, tx.txid, "cosigner");
          }
          break;
        }
        default:
          // p2tr / p2pk: the key is already in the output itself; nothing extra to learn here.
          break;
      }
    }
  }
  return [...found.values()];
}

export interface SiblingForm {
  format: BtcFormat;
  /** Human address when the form has one (P2PK has none). */
  address?: string;
  scriptHex: string;
  scripthash: string;
  /** Which key encoding this form commits to. */
  encoding: "compressed" | "uncompressed" | "x-only-bip86";
}

/** Normalise a pubkey to both encodings. */
export function bothEncodings(pubkey: Uint8Array): { compressed: Uint8Array; uncompressed: Uint8Array } {
  const p = secp256k1.ProjectivePoint.fromHex(pubkey);
  return { compressed: p.toRawBytes(true), uncompressed: p.toRawBytes(false) };
}

/** BIP-86 key-path-only Taproot output key for an internal key (x-only). */
export function bip86OutputKey(pubkey: Uint8Array): Uint8Array {
  const { compressed } = bothEncodings(pubkey);
  const x = compressed.slice(1);
  const P = schnorr.utils.lift_x(schnorr.utils.bytesToNumberBE(x));
  const t = schnorr.utils.bytesToNumberBE(schnorr.utils.taggedHash("TapTweak", x));
  const Q = P.add(secp256k1.ProjectivePoint.BASE.multiply(t));
  return Q.toRawBytes(true).slice(1);
}

/**
 * Every standard output form controlled by one key:
 * P2PK (compressed + uncompressed), P2PKH (compressed + uncompressed), P2WPKH, P2SH-P2WPKH, P2TR (BIP-86).
 */
export function siblingForms(pubkeyHex: string): SiblingForm[] {
  const { compressed, uncompressed } = bothEncodings(hexToBytes(pubkeyHex));
  const hc = hash160(compressed);
  const hu = hash160(uncompressed);
  const nested = hexToBytes(scripts.p2wpkh(hc));
  const tr = bip86OutputKey(compressed);
  const forms: Omit<SiblingForm, "scripthash">[] = [
    { format: "p2pk", scriptHex: scripts.p2pk(compressed), encoding: "compressed" },
    { format: "p2pk", scriptHex: scripts.p2pk(uncompressed), encoding: "uncompressed" },
    { format: "p2pkh", address: encode.p2pkh(hc), scriptHex: scripts.p2pkh(hc), encoding: "compressed" },
    { format: "p2pkh", address: encode.p2pkh(hu), scriptHex: scripts.p2pkh(hu), encoding: "uncompressed" },
    { format: "p2wpkh", address: encode.p2wpkh(hc), scriptHex: scripts.p2wpkh(hc), encoding: "compressed" },
    {
      format: "p2sh-p2wpkh",
      address: encode.p2sh(hash160(nested)),
      scriptHex: scripts.p2sh(hash160(nested)),
      encoding: "compressed",
    },
    { format: "p2tr", address: encode.p2tr(tr), scriptHex: scripts.p2tr(tr), encoding: "x-only-bip86" },
  ];
  return forms.map((f) => ({ ...f, scripthash: esploraScripthash(f.scriptHex) }));
}
