import { describe, expect, it } from "vitest";

import { bothEncodings, pubkeysInScript, scriptPushes, siblingForms } from "./pubkeys.js";
import { hexToBytes } from "./script.js";
import { deriveXpubAddress } from "./scan.js";

const GENESIS =
  "04678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5f";

describe("siblingForms", () => {
  const forms = siblingForms(GENESIS);
  it("derives all 7 forms of one key", () => {
    expect(forms.map((f) => f.format).sort()).toEqual(["p2pk", "p2pk", "p2pkh", "p2pkh", "p2sh-p2wpkh", "p2tr", "p2wpkh"]);
  });
  it("includes Satoshi's genesis address (uncompressed P2PKH)", () => {
    expect(forms.some((f) => f.address === "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")).toBe(true);
  });
  it("includes the genesis P2PK scripthash", () => {
    expect(forms.some((f) => f.scripthash === "3318537dfb3135df9f3d950dbdf8a7ae68dd7c7dfef61ed17963ff80f3850474")).toBe(true);
  });
  it("compressed and uncompressed encode the same point", () => {
    const { compressed, uncompressed } = bothEncodings(hexToBytes(GENESIS));
    expect(compressed.length).toBe(33);
    expect(uncompressed.length).toBe(65);
    expect(bothEncodings(compressed).uncompressed).toEqual(uncompressed);
  });
});

describe("script parsing", () => {
  it("extracts pushes including PUSHDATA1", () => {
    const pushes = scriptPushes(`02abcd4c03aabbcc51`);
    expect(pushes.map((p) => p.length)).toEqual([2, 3]);
  });
  it("finds the keys of a 2-of-3 multisig script", () => {
    const k1 = "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
    const k2 = "02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5";
    const k3 = "02f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9";
    const script = `5221${k1}21${k2}21${k3}53ae`;
    expect(pubkeysInScript(script)).toHaveLength(3);
  });
  it("ignores junk that looks like a key but is not on the curve", () => {
    expect(pubkeysInScript(`21${"02" + "ff".repeat(32)}ac`)).toHaveLength(0);
  });
});

describe("xpub derivation (BIP-84 test vectors)", () => {
  // BIP-84: mnemonic "abandon … about", account 0
  const zpub = "zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs";
  it("first receive address", () => {
    expect(deriveXpubAddress(zpub, 0, 0)).toBe("bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu");
  });
  it("second receive address", () => {
    expect(deriveXpubAddress(zpub, 0, 1)).toBe("bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g");
  });
  it("first change address", () => {
    expect(deriveXpubAddress(zpub, 1, 0)).toBe("bc1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el");
  });
});
