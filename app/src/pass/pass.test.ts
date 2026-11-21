import { describe, expect, it } from "vitest";

import { canonicalJson } from "./fields.js";
import { buildMemo, parseMemo, scoreBucket, usdBucket, verifyNativeProof, type NativeTxJson, type PassFields } from "./proof.js";
import { attestFromNativeTx, type AttestDeps } from "./relayer.js";

const HOLDER = "qor1wpae9a38v7vlj2xvun2cw0669w4ls568zar4w8";
const HOLDER_EVM = "0x707B92f6276799f928CCe4D5873f5A2babF85347";
const FIELDS: PassFields = { scanHash: `0x${"ab".repeat(32)}`, scoreBucket: 7, chainsMask: 3, exposedUsdBucket: 5 };
const TXHASH = "82CAAC0311B6927598BBD789BFD250CE236DD6DD0B241CB444B511CFE74A1104";

function tx(over: { code?: number; memo?: string; ext?: boolean; alg?: number; to?: string; type?: string } = {}): NativeTxJson {
  return {
    tx: {
      body: {
        messages: [{ "@type": over.type ?? "/cosmos.bank.v1beta1.MsgSend", from_address: HOLDER, to_address: over.to ?? HOLDER, amount: [{ denom: "uqor", amount: "1" }] }],
        memo: over.memo ?? buildMemo(FIELDS),
        extension_options: over.ext === false ? [] : [{ "@type": "/qorechain.pqc.v1.PQCHybridSignature", algorithm_id: over.alg ?? 1, pqc_signature: "AAAA" }],
      },
    },
    tx_response: { code: over.code ?? 0, txhash: TXHASH, height: "100" },
  };
}

describe("memo", () => {
  it("round-trips", () => expect(parseMemo(buildMemo(FIELDS))).toEqual(FIELDS));
  it("rejects junk and out-of-range values", () => {
    expect(parseMemo("hello")).toBeNull();
    expect(parseMemo(buildMemo({ ...FIELDS, scoreBucket: 11 }))).toBeNull();
    expect(parseMemo(buildMemo({ ...FIELDS, exposedUsdBucket: 16 }))).toBeNull();
  });
  it("fits QoreX's 256-byte memo limit", () => expect(new TextEncoder().encode(buildMemo({ ...FIELDS, chainsMask: 65535 })).length).toBeLessThanOrEqual(256));
});

describe("buckets", () => {
  it("score buckets", () => {
    expect(scoreBucket(0)).toBe(0);
    expect(scoreBucket(69)).toBe(6);
    expect(scoreBucket(100)).toBe(10);
  });
  it("usd buckets", () => {
    expect(usdBucket(0)).toBe(0);
    expect(usdBucket(5)).toBe(1);
    expect(usdBucket(12_000)).toBe(5);
    expect(usdBucket(6_460_000)).toBe(7);
  });
  it("canonical JSON is key-order independent", () => expect(canonicalJson({ b: 1, a: [{ d: 2, c: 3 }] })).toBe(canonicalJson({ a: [{ c: 3, d: 2 }], b: 1 })));
});

describe("verifyNativeProof", () => {
  it("accepts a hybrid-signed self-transfer with a valid memo", () => {
    const r = verifyNativeProof(tx());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.holderEvm).toBe(HOLDER_EVM);
      expect(r.fields).toEqual(FIELDS);
      expect(r.txHash).toBe(`0x${TXHASH.toLowerCase()}`);
    }
  });
  it.each([
    ["failed tx", { code: 5 }],
    ["no PQC extension", { ext: false }],
    ["wrong algorithm", { alg: 2 }],
    ["transfer to someone else", { to: "qor1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq" }],
    ["other message type", { type: "/cosmos.staking.v1beta1.MsgDelegate" }],
    ["bad memo", { memo: "gm" }],
  ])("rejects %s", (_, over) => expect(verifyNativeProof(tx(over)).ok).toBe(false));
});

describe("attestFromNativeTx", () => {
  const deps = (o: Partial<AttestDeps> = {}): AttestDeps & { submitted: unknown[] } => {
    const submitted: unknown[] = [];
    return {
      submitted,
      rest: "https://rest",
      fetchJson: async () => ({ status: 200, body: tx() }),
      hasPass: async () => false,
      keyRegistered: async () => true,
      proofUsed: async () => false,
      submit: async (a) => {
        submitted.push(a);
        return { evmTxHash: "0xfeed" };
      },
      ...o,
    };
  };

  it("submits attest() with the memo fields for the tx signer", async () => {
    const d = deps();
    const r = await attestFromNativeTx(TXHASH.toLowerCase(), d);
    expect(r.status).toBe(200);
    expect(d.submitted[0]).toMatchObject({ holder: HOLDER_EVM, scoreBucket: 7, chainsMask: 3, nativeTxHash: `0x${TXHASH.toLowerCase()}` });
  });
  it("400 on a malformed hash", async () => expect((await attestFromNativeTx("xyz", deps())).status).toBe(400));
  it("404 while the tx is not indexed yet", async () =>
    expect((await attestFromNativeTx(TXHASH, deps({ fetchJson: async () => ({ status: 404, body: null }) }))).status).toBe(404));
  it("409 when already minted", async () => {
    const r = await attestFromNativeTx(TXHASH, deps({ hasPass: async () => true }));
    expect(r).toMatchObject({ status: 409, body: { code: "already-minted" } });
  });
  it("409 when the proof was used", async () => expect((await attestFromNativeTx(TXHASH, deps({ proofUsed: async () => true }))).status).toBe(409));
  it("422 without a registered PQ key", async () => expect((await attestFromNativeTx(TXHASH, deps({ keyRegistered: async () => false }))).status).toBe(422));
  it("422 on a classical-only tx and never submits", async () => {
    const d = deps({ fetchJson: async () => ({ status: 200, body: tx({ ext: false }) }) });
    expect((await attestFromNativeTx(TXHASH, d)).status).toBe(422);
    expect(d.submitted).toHaveLength(0);
  });
});
