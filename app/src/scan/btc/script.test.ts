import { describe, expect, it } from "vitest";

import { decodeAddress, esploraScripthash, isPubkeyHex, scripts, xpubKind, hexToBytes } from "./script.js";

describe("decodeAddress", () => {
  const ok: [string, string][] = [
    ["1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", "p2pkh"],
    ["1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2", "p2pkh"],
    ["34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo", "p2sh"],
    ["3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy", "p2sh"],
    ["bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu", "p2wpkh"],
    ["BC1QCR8TE4KR609GCAWUTMRZA0J4XV80JY8Z306FYU", "p2wpkh"],
    ["bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3", "p2wsh"],
    ["bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297", "p2tr"],
    ["bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0", "p2tr"],
  ];
  it.each(ok)("%s → %s", (addr, format) => {
    expect(decodeAddress(addr).format).toBe(format);
  });

  const bad: [string, RegExp][] = [
    ["1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb", /checksum/],
    ["bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyv", /checksum/],
    ["bc1Qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu", /mix upper and lower/],
    ["tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx", /testnet/],
    ["mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn", /testnet/],
    ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", /Not a Bitcoin/],
    ["hello", /Not a Bitcoin/],
    ["", /Not a Bitcoin/],
    // v0 program must be bech32 (not bech32m): taproot-style checksum on a q-address fails
    ["bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kemeawh", /checksum/],
  ];
  it.each(bad)("rejects %s", (addr, msg) => {
    expect(() => decodeAddress(addr)).toThrow(msg);
  });

  it("builds the right scriptPubKey", () => {
    expect(decodeAddress("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa").scriptHex).toBe("76a91462e907b15cbf27d5425399ebf6f0fb50ebb88f1888ac");
  });
});

describe("helpers", () => {
  it("esplora scripthash is sha256 of the script, not reversed (genesis P2PK)", () => {
    const pk = hexToBytes(
      "04678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5f",
    );
    expect(esploraScripthash(scripts.p2pk(pk))).toBe("3318537dfb3135df9f3d950dbdf8a7ae68dd7c7dfef61ed17963ff80f3850474");
  });

  it("detects pubkeys", () => {
    expect(isPubkeyHex(`02${"a".repeat(64)}`)).toBe(true);
    expect(isPubkeyHex(`04${"a".repeat(128)}`)).toBe(true);
    expect(isPubkeyHex(`05${"a".repeat(64)}`)).toBe(false);
    expect(isPubkeyHex("02abc")).toBe(false);
  });

  it("detects xpub kinds", () => {
    const zpub = "zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs";
    expect(xpubKind(zpub)).toBe("zpub");
    expect(xpubKind("tpubD6NzVbkrYhZ4XgiXtGrdW5XDAPFCL9h7we1vwNCpn8tGbBcgfVYjXyhWo4E1xkh56hjod1RhGjxbaTLV3X4FyWuejifB9jusQ46QzG87VKp")).toBeNull();
    expect(xpubKind("not an xpub")).toBeNull();
  });
});
