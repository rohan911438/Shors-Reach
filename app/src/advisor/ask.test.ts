import { beforeEach, describe, expect, it } from "vitest";

import { ask, fallbackAnswer, handleAsk, resetAskRateLimit, type AskRequest } from "./ask.js";
import { SUMMARIES } from "./fixtures.js";
import type { GenerateClient, GenerateRequest } from "./server.js";
import { UpstreamError } from "./server.js";

const summary = Object.values(SUMMARIES)[0]!;
const req = (question: string, extra: Partial<AskRequest> = {}): AskRequest => ({ summary, question, ...extra });

function client(texts: string[], finish = "STOP"): GenerateClient & { calls: number; seen: GenerateRequest[] } {
  const c = {
    calls: 0,
    seen: [] as GenerateRequest[],
    generate: async (r: GenerateRequest) => {
      c.seen.push(r);
      const text = texts[Math.min(c.calls, texts.length - 1)]!;
      c.calls++;
      return { text, finishReason: finish };
    },
  };
  return c;
}

const post = (body: unknown) =>
  new Request("http://x/api/ask", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });

beforeEach(() => resetAskRateLimit());

describe("ask — AI path", () => {
  it("returns the model's answer and sends only summary + question", async () => {
    const c = client([JSON.stringify({ answer: "Taproot puts the key on-chain.", followUps: ["What next?"] })]);
    const r = await ask(req("why is my Taproot address red?"), { client: c });
    expect(r.source).toBe("ai");
    expect(r.answer).toMatch(/Taproot/);
    expect(c.seen[0]!.user).toContain("why is my Taproot address red?");
    expect(c.seen[0]!.user).toContain(JSON.stringify(summary));
  });

  it("rejects an answer that leaks an identifier and falls back", async () => {
    const leak = JSON.stringify({ answer: "Move from bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq now.", followUps: [] });
    const r = await ask(req("why is my Taproot address red?"), { client: client([leak]) });
    expect(r.source).toBe("fallback");
    expect(r.fallbackReason).toBe("unsafe-output");
    expect(r.answer).toMatch(/Taproot/);
  });

  it("rejects an answer that asks for the seed phrase", async () => {
    const bad = JSON.stringify({ answer: "Please enter your seed phrase so we can check it.", followUps: [] });
    const r = await ask(req("what do I do with a Ledger?"), { client: client([bad]) });
    expect(r.source).toBe("fallback");
  });

  it("does not retry on rate limit and falls back", async () => {
    let calls = 0;
    const c: GenerateClient = {
      generate: async () => {
        calls++;
        throw new UpstreamError(429);
      },
    };
    const r = await ask(req("what should I move first?"), { client: c });
    expect(calls).toBe(1);
    expect(r.fallbackReason).toBe("api-429");
  });

  it("retries once on invalid JSON", async () => {
    const c = client(["not json", JSON.stringify({ answer: "Ok.", followUps: [] })]);
    const r = await ask(req("what should I move first?"), { client: c });
    expect(c.calls).toBe(2);
    expect(r.source).toBe("ai");
  });
});

describe("ask — rule-based fallback", () => {
  it.each([
    ["why is my Taproot address red?", /Taproot/],
    ["what do I do with a Ledger?", /hardware wallet/i],
    ["when will quantum computers break bitcoin?", /estimates vary/],
    ["how do I register on QoreChain?", /ML-DSA-87/],
  ])("%s", (q, re) => {
    expect(fallbackAnswer(req(q)).answer).toMatch(re);
  });

  it("declines price questions", () => {
    expect(fallbackAnswer(req("which coin should I buy?")).answer).toMatch(/can't give price or investment advice/);
  });

  it("works with no API key", async () => {
    const r = await ask(req("why is my Taproot address red?"), {});
    expect(r).toMatchObject({ source: "fallback", fallbackReason: "no-api-key" });
  });
});

describe("handleAsk — input guards", () => {
  it("refuses a question containing an address before any model call", async () => {
    const c = client([JSON.stringify({ answer: "x", followUps: [] })]);
    const res = await handleAsk(post({ summary, question: "is bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq safe?" }), { client: c });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("identifier");
    expect(c.calls).toBe(0);
  });

  it("refuses a pasted seed phrase", async () => {
    const seed = "abandon ability able about above absent absorb abstract absurd abuse access accident";
    const res = await handleAsk(post({ summary, question: seed }), {});
    expect((await res.json()).code).toBe("seed-phrase");
  });

  it("refuses identifiers smuggled into history", async () => {
    const res = await handleAsk(
      post({ summary, question: "and now?", history: [{ q: "hi", a: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" }] }),
      {},
    );
    expect(res.status).toBe(400);
  });

  it("rejects extra fields and a summary carrying identifiers", async () => {
    expect((await handleAsk(post({ summary, question: "hi there", address: "x" }), {})).status).toBe(400);
    const bad = { ...summary, holdings: [{ ...summary.holdings[0], chain: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq" }] };
    expect((await handleAsk(post({ summary: bad, question: "hi there" }), {})).status).toBe(400);
  });

  it("405 on GET, 400 on junk, 200 on a valid question", async () => {
    expect((await handleAsk(new Request("http://x", { method: "GET" }), {})).status).toBe(405);
    expect((await handleAsk(post("nope"), {})).status).toBe(400);
    const ok = await handleAsk(post({ summary, question: "what should I move first?" }), {});
    expect(ok.status).toBe(200);
    expect((await ok.json()).answer).toBeTruthy();
  });

  it("rate-limits per IP", async () => {
    for (let i = 0; i < 3; i++) await handleAsk(post({ summary, question: "what first?" }), { rateLimit: 3 }, "1.2.3.4");
    expect((await handleAsk(post({ summary, question: "what first?" }), { rateLimit: 3 }, "1.2.3.4")).status).toBe(429);
  });
});
