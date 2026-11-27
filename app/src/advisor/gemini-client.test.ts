import { afterEach, describe, expect, it, vi } from "vitest";
import { geminiClient, UpstreamError } from "./server.js";

const REQ = { model: "primary", system: "s", user: "u", schema: {}, maxOutputTokens: 100 };
const ok = (text = '{"x":1}') =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }] }), { status: 200 });

/** Mock fetch that answers per model name from a script. */
function mockFetch(byModel: Record<string, (() => Response | Promise<Response>)[]>) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const model = decodeURIComponent(/models\/([^:]+):/.exec(url)![1]!);
      calls.push(model);
      const next = byModel[model]?.shift();
      if (!next) throw new Error(`unexpected call to ${model}`);
      return next();
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("geminiClient", () => {
  it("returns the primary model's answer when it works", async () => {
    const calls = mockFetch({ primary: [() => ok()] });
    const r = await geminiClient(["k1"], { fallbackModels: ["backup"] }).generate(REQ);
    expect(r.model).toBe("primary");
    expect(calls).toEqual(["primary"]);
  });

  it("moves to the next model when the primary is overloaded (503)", async () => {
    const calls = mockFetch({ primary: [() => new Response("busy", { status: 503 })], backup: [() => ok()] });
    const r = await geminiClient(["k1", "k2"], { fallbackModels: ["backup"] }).generate(REQ);
    expect(r.model).toBe("backup");
    expect(calls).toEqual(["primary", "backup"]); // 503 skips the other keys: the model, not the key, is busy
  });

  it("moves to the next model when the primary hangs or the network fails", async () => {
    const calls = mockFetch({
      primary: [() => Promise.reject(new DOMException("timed out", "TimeoutError"))],
      backup: [() => ok()],
    });
    const r = await geminiClient(["k1"], { fallbackModels: ["backup"] }).generate(REQ);
    expect(r.model).toBe("backup");
    expect(calls).toEqual(["primary", "backup"]);
  });

  it("rotates keys on 429 before changing model", async () => {
    const calls = mockFetch({ primary: [() => new Response("", { status: 429 }), () => ok()] });
    const r = await geminiClient(["k1", "k2"], { fallbackModels: ["backup"] }).generate(REQ);
    expect(r.model).toBe("primary");
    expect(calls).toEqual(["primary", "primary"]);
  });

  it("does not try other models on a 400 (our bug, not theirs)", async () => {
    const calls = mockFetch({ primary: [() => new Response("bad", { status: 400 })] });
    await expect(geminiClient(["k1"], { fallbackModels: ["backup"] }).generate(REQ)).rejects.toMatchObject({ status: 400 });
    expect(calls).toEqual(["primary"]);
  });

  it("stops at the time budget instead of running past the function limit", async () => {
    let t = 0;
    const calls = mockFetch({
      primary: [
        () => {
          t += 44_000; // the first model ate almost the whole budget
          return new Response("busy", { status: 503 });
        },
      ],
      backup: [() => ok()],
    });
    const p = geminiClient(["k1"], { budgetMs: 45_000, fallbackModels: ["backup"], now: () => t }).generate(REQ);
    await expect(p).rejects.toBeInstanceOf(UpstreamError);
    await expect(p).rejects.toMatchObject({ status: 504 });
    expect(calls).toEqual(["primary"]);
  });

  it("throws the last status when every model fails", async () => {
    mockFetch({ primary: [() => new Response("", { status: 503 })], backup: [() => new Response("", { status: 503 })] });
    await expect(geminiClient(["k1"], { fallbackModels: ["backup"] }).generate(REQ)).rejects.toMatchObject({ status: 503 });
  });
});
