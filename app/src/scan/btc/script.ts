/**
 * Bitcoin script / address helpers (mainnet only).
 */
import { bech32, bech32m, createBase58check } from "@scure/base";
import { ripemd160 } from "@noble/hashes/legacy.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

import type { BtcFormat } from "../types.js";

export const base58check = createBase58check(sha256);

export const hash160 = (b: Uint8Array): Uint8Array => ripemd160(sha256(b));

export { bytesToHex, hexToBytes, sha256 };

/** scriptPubKey builders (hex). */
export const scripts = {
  p2pkh: (h160: Uint8Array) => `76a914${bytesToHex(h160)}88ac`,
  p2sh: (h160: Uint8Array) => `a914${bytesToHex(h160)}87`,
  p2wpkh: (h160: Uint8Array) => `0014${bytesToHex(h160)}`,
  p2wsh: (h256: Uint8Array) => `0020${bytesToHex(h256)}`,
  p2tr: (xonly: Uint8Array) => `5120${bytesToHex(xonly)}`,
  /** P2PK: <push len><pubkey> OP_CHECKSIG */
  p2pk: (pubkey: Uint8Array) => `${pubkey.length.toString(16).padStart(2, "0")}${bytesToHex(pubkey)}ac`,
};

/**
 * Esplora "scripthash" = sha256(scriptPubKey) as hex, NOT byte-reversed
 * (verified on mempool.space with the genesis P2PK output).
 */
export function esploraScripthash(scriptHex: string): string {
  return bytesToHex(sha256(hexToBytes(scriptHex)));
}

/** Address encoders. */
export const encode = {
  p2pkh: (h160: Uint8Array) => base58check.encode(concat([0x00], h160)),
  p2sh: (h160: Uint8Array) => base58check.encode(concat([0x05], h160)),
  p2wpkh: (h160: Uint8Array) => bech32.encode("bc", [0, ...bech32.toWords(h160)]),
  p2wsh: (h256: Uint8Array) => bech32.encode("bc", [0, ...bech32.toWords(h256)]),
  p2tr: (xonly: Uint8Array) => bech32m.encode("bc", [1, ...bech32m.toWords(xonly)]),
};

function concat(prefix: number[], body: Uint8Array): Uint8Array {
  const out = new Uint8Array(prefix.length + body.length);
  out.set(prefix, 0);
  out.set(body, prefix.length);
  return out;
}

export interface DecodedAddress {
  address: string;
  format: Exclude<BtcFormat, "p2pk" | "p2sh-p2wpkh">;
  /** hash160 / sha256 / x-only key carried by the address. */
  program: Uint8Array;
  scriptHex: string;
}

export class AddressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AddressError";
  }
}

/** Decode and validate a mainnet Bitcoin address. Throws AddressError with a human message. */
export function decodeAddress(input: string): DecodedAddress {
  const address = input.trim();
  const lower = address.toLowerCase();

  if (lower.startsWith("tb1") || lower.startsWith("bcrt1")) {
    throw new AddressError("This is a Bitcoin testnet address. Shor's Reach scans mainnet holdings.");
  }

  if (lower.startsWith("bc1")) {
    if (address !== lower && address !== address.toUpperCase()) {
      throw new AddressError("Bech32 addresses must not mix upper and lower case.");
    }
    const isV0 = lower[3] === "q";
    let words: number[];
    try {
      const dec = (isV0 ? bech32 : bech32m).decode(lower as `${string}1${string}`, 90);
      if (dec.prefix !== "bc") throw new Error("wrong prefix");
      words = dec.words;
    } catch {
      throw new AddressError("Invalid Bitcoin address checksum.");
    }
    const version = words[0];
    const program = Uint8Array.from(bech32.fromWords(words.slice(1)));
    if (version === 0 && program.length === 20) {
      return { address: lower, format: "p2wpkh", program, scriptHex: scripts.p2wpkh(program) };
    }
    if (version === 0 && program.length === 32) {
      return { address: lower, format: "p2wsh", program, scriptHex: scripts.p2wsh(program) };
    }
    if (version === 1 && program.length === 32) {
      return { address: lower, format: "p2tr", program, scriptHex: scripts.p2tr(program) };
    }
    throw new AddressError(`Unsupported witness version ${version} / length ${program.length}.`);
  }

  if (/^[123mn]/.test(address)) {
    let raw: Uint8Array;
    try {
      raw = base58check.decode(address);
    } catch {
      throw new AddressError("Invalid Bitcoin address checksum.");
    }
    if (raw.length !== 21) throw new AddressError("Invalid Bitcoin address length.");
    const version = raw[0];
    const program = raw.slice(1);
    if (version === 0x00) return { address, format: "p2pkh", program, scriptHex: scripts.p2pkh(program) };
    if (version === 0x05) return { address, format: "p2sh", program, scriptHex: scripts.p2sh(program) };
    if (version === 0x6f || version === 0xc4) {
      throw new AddressError("This is a Bitcoin testnet address. Shor's Reach scans mainnet holdings.");
    }
    throw new AddressError(`Unknown address version byte 0x${version.toString(16)}.`);
  }

  throw new AddressError("Not a Bitcoin address.");
}

export function isBtcAddress(input: string): boolean {
  try {
    decodeAddress(input);
    return true;
  } catch {
    return false;
  }
}

/** A hex-encoded secp256k1 public key (compressed 33 B or uncompressed 65 B). */
export function isPubkeyHex(input: string): boolean {
  const s = input.trim().toLowerCase();
  return /^(02|03)[0-9a-f]{64}$/.test(s) || /^04[0-9a-f]{128}$/.test(s);
}

export type XpubKind = "xpub" | "ypub" | "zpub";

/** Extended public keys we support (single-sig). Multisig Ypub/Zpub and testnet tpub are rejected. */
export function xpubKind(input: string): XpubKind | null {
  const s = input.trim();
  if (!/^[xyz]pub[1-9A-HJ-NP-Za-km-z]{100,112}$/.test(s)) return null;
  return s.slice(0, 4) as XpubKind;
}
