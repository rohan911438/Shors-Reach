import { describe, expect, it } from "vitest";

import { HttpError, Net, type Transport } from "./net.js";

describe("Net", () => {
  it("retries retryable statuses then succeeds", async () => {
    let calls = 0;
    const t: Transport = async () => (++calls < 3 ? { status: 503, text: "busy" } : { status: 200, text: '{"ok":1}' });
    const net = new Net({ transport: t, backoffMs: 1 });
    expect(await net.json<{ ok: number }>({ url: "https://x.test/a" })).toEqual({ ok: 1 });
    expect(calls).toBe(3);
  });

  it("throws HttpError for 404 without retrying", async () => {
    let calls = 0;
    const t: Transport = async () => {
      calls++;
      return { status: 404, text: "nope" };
    };
    const net = new Net({ transport: t, backoffMs: 1 });
    await expect(net.json({ url: "https://x.test/b" })).rejects.toBeInstanceOf(HttpError);
    expect(calls).toBe(1);
  });

  it("times out slow requests", async () => {
    const t: Transport = (_req, signal) =>
      new Promise((_, reject) => signal?.addEventListener("abort", () => reject(new Error("aborted"))));
    const net = new Net({ transport: t, timeoutMs: 20, retries: 0 });
    await expect(net.json({ url: "https://x.test/c" })).rejects.toThrow(/timeout/);
  });

  it("caches identical requests", async () => {
    let calls = 0;
    const t: Transport = async () => {
      calls++;
      return { status: 200, text: "1" };
    };
    const net = new Net({ transport: t });
    await Promise.all([net.json({ url: "https://x.test/d" }), net.json({ url: "https://x.test/d" })]);
    expect(calls).toBe(1);
  });

  it("limits concurrency per host", async () => {
    let active = 0;
    let peak = 0;
    const t: Transport = async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return { status: 200, text: "1" };
    };
    const net = new Net({ transport: t, concurrency: 2 });
    await Promise.all(Array.from({ length: 8 }, (_, i) => net.json({ url: `https://x.test/${i}` })));
    expect(peak).toBe(2);
  });
});
