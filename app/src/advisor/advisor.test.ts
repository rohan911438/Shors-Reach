import { beforeEach, describe, expect, it } from "vitest";

import { fallbackPlan } from "./fallback.js";
import { PlanSchema, parseSummary, type Summary } from "./schema.js";
import { advise, handleAdvise, resetRateLimit, type MessagesClient } from "./server.js";

const zero = { EXPOSED_NOW: 0, EXPOSED_ON_SPEND: 0, PROTECTED: 0, UNKNOWN: 0 };

export const SUMMARIES: Record<string, Summary> = {
  satoshiEra: {
    score: 100,
    scoreBasis: "usd",
    totalsUsdRounded: { ...zero, EXPOSED_NOW: 6_500_000 },
    holdings: [
      { chain: "bitcoin", format: "p2pk", status: "EXPOSED_NOW", reason: "btc-p2pk-output", usdRounded: 5_000_000 },
      { chain: "bitcoin", format: "p2pkh", status: "EXPOSED_NOW", reason: "btc-sibling-key-revealed", usdRounded: 1_500_000 },
    ],
    questionnaire: { signedMessages: "unsure", custodial: false },
    qorechain: null,
  },
  evmActive: {
    score: 70,
    scoreBasis: "usd",
    totalsUsdRounded: { ...zero, EXPOSED_NOW: 21_000, UNKNOWN: 9_000 },
    holdings: [
      { chain: "ethereum", format: "eoa", status: "EXPOSED_NOW", reason: "evm-nonce-nonzero", usdRounded: 21_000 },
      { chain: "base", format: "eoa", status: "UNKNOWN", reason: "evm-offchain-signature-possible", usdRounded: 9_000 },
    ],
    questionnaire: { signedMessages: "unsure", custodial: false },
    qorechain: { pqKeyRegistered: false, windowLive: false },
  },
  careful: {
    score: 0,
    scoreBasis: "usd",
    totalsUsdRounded: { ...zero, EXPOSED_ON_SPEND: 3_000, PROTECTED: 70 },
    holdings: [
      { chain: "bitcoin", format: "p2wpkh", status: "EXPOSED_ON_SPEND", reason: "btc-hash-hidden", usdRounded: 3_000 },
      { chain: "qorechain", format: "qore-native", status: "PROTECTED", reason: "qore-native-pq-required", usdRounded: 70 },
    ],
    questionnaire: { signedMessages: "no", custodial: false },
    qorechain: { pqKeyRegistered: true, windowLive: false },
  },
};

const GOOD_PLAN = {
  summary: "Most of the value is behind keys already on-chain. Moving it is straightforward.",
  actions: [
    { priority: 2, title: "Stop reusing addresses", why: "Reuse reveals keys.", how: "Use a fresh address each time." },
    { priority: 1, title: "Move exposed coins", why: "Keys are public.", how: "Send to a fresh bc1q address." },
  ],
  stopDoing: ["Reusing addresses."],
  unknowns: ["Timing of quantum attacks is uncertain."],
  qorechainNote: "QoreChain requires hybrid signatures for native transactions.",
};

function fakeClient(texts: string[], stop = "end_turn"): MessagesClient & { calls: number } {
  const c = {
    calls: 0,
    messages: {
      create: async () => {
        const text = texts[Math.min(c.calls, texts.length - 1)]!;
        c.calls++;
        return {
          id: "msg_test",
          type: "message",
          role: "assistant",
          model: "claude-opus-5-5",
          content: [{ type: "text", text, citations: null }],
          stop_reason: stop,
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 10 },
        } as never;
      },
    },
  };
  return c;
}

describe("summary validation", () => {
  it("accepts the three fixture summaries", () => {
    for (const s of Object.values(SUMMARIES)) expect(parseSummary(s).ok).toBe(true);
  });

  it.each([
    ["bitcoin address", "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"],
    ["legacy address", "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"],
    ["evm address", "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"],
    ["txid", "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b"],
  ])("rejects a payload containing a %s", (_, id) => {
    const bad = { ...SUMMARIES.careful, holdings: [{ ...SUMMARIES.careful!.holdings[0]!, reason: id }] };
    const r = parseSummary(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).not.toContain(id);
  });

  it("rejects unknown fields and out-of-range values", () => {
    expect(parseSummary({ ...SUMMARIES.careful, extra: 1 }).ok).toBe(false);
    expect(parseSummary({ ...SUMMARIES.careful, score: 101 }).ok).toBe(false);
    expect(parseSummary("not json").ok).toBe(false);
  });
});

describe("rule-based fallback", () => {
  it.each(Object.keys(SUMMARIES))("produces a valid, safe plan for %s", (k) => {
    const plan = fallbackPlan(SUMMARIES[k]!);
    expect(PlanSchema.safeParse(plan).success).toBe(true);
    expect(JSON.stringify(plan)).not.toMatch(/b(you should buy|buy (some|more)|price target|guaranteed returns?)b/i);
    expect(plan.stopDoing.some((x) => /seed phrase/.test(x))).toBe(true);
  });

  it("puts the QoreChain registration first-class when the key is missing", () => {
    expect(fallbackPlan(SUMMARIES.evmActive!).actions.some((a) => /post-quantum key/i.test(a.title))).toBe(true);
    expect(fallbackPlan(SUMMARIES.careful!).actions.some((a) => /post-quantum key/i.test(a.title))).toBe(false);
  });

  it("is deterministic", () => {
    expect(fallbackPlan(SUMMARIES.satoshiEra!)).toEqual(fallbackPlan(SUMMARIES.satoshiEra!));
  });
});

describe("advise() with a mocked API", () => {
  it("returns the AI plan sorted by priority", async () => {
    const r = await advise(SUMMARIES.satoshiEra!, { client: fakeClient([JSON.stringify(GOOD_PLAN)]) });
    expect(r.source).toBe("ai");
    expect(r.plan.actions[0]!.priority).toBe(1);
  });

  it("retries once on invalid JSON, then succeeds", async () => {
    const c = fakeClient(["{oops", JSON.stringify(GOOD_PLAN)]);
    const r = await advise(SUMMARIES.satoshiEra!, { client: c });
    expect(r.source).toBe("ai");
    expect(c.calls).toBe(2);
  });

  it("falls back after two invalid answers", async () => {
    const c = fakeClient(["{oops"]);
    const r = await advise(SUMMARIES.satoshiEra!, { client: c });
    expect(r.source).toBe("fallback");
    expect(r.fallbackReason).toBe("invalid-json");
    expect(c.calls).toBe(2);
  });

  it("rejects model output that leaks an identifier", async () => {
    const leaky = { ...GOOD_PLAN, summary: "Move 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa now." };
    const r = await advise(SUMMARIES.satoshiEra!, { client: fakeClient([JSON.stringify(leaky)]) });
    expect(r.source).toBe("fallback");
    expect(r.fallbackReason).toBe("unsafe-output");
  });

  it("does not retry a refusal", async () => {
    const c = fakeClient(["{}"], "refusal");
    const r = await advise(SUMMARIES.satoshiEra!, { client: c });
    expect(r.fallbackReason).toBe("refusal");
    expect(c.calls).toBe(1);
  });

  it("uses the fallback without an API key", async () => {
    const r = await advise(SUMMARIES.careful!, {});
    expect(r).toMatchObject({ source: "fallback", fallbackReason: "no-api-key" });
  });
});

describe("HTTP handler", () => {
  beforeEach(() => resetRateLimit());
  const post = (body: unknown) => new Request("http://x/api/advise", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });

  it("400s on a payload with an address", async () => {
    const res = await handleAdvise(post({ ...SUMMARIES.careful, note: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" }), {});
    expect(res.status).toBe(400);
  });

  it("200s with a fallback plan when no key is configured", async () => {
    const res = await handleAdvise(post(SUMMARIES.evmActive), {});
    expect(res.status).toBe(200);
    expect(((await res.json()) as { source: string }).source).toBe("fallback");
  });

  it("rate-limits per IP", async () => {
    for (let i = 0; i < 3; i++) expect((await handleAdvise(post(SUMMARIES.careful), { rateLimit: 3 }, "1.2.3.4")).status).toBe(200);
    expect((await handleAdvise(post(SUMMARIES.careful), { rateLimit: 3 }, "1.2.3.4")).status).toBe(429);
    expect((await handleAdvise(post(SUMMARIES.careful), { rateLimit: 3 }, "5.6.7.8")).status).toBe(200);
  });

  it("405s on GET", async () => {
    expect((await handleAdvise(new Request("http://x/api/advise"), {})).status).toBe(405);
  });
});
