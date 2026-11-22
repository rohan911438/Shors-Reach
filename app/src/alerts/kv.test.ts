import { describe, expect, it } from "vitest";

import { kvFromEnv, upstashKV } from "./kv.js";

describe("upstash KV client", () => {
  it("sends Redis commands as JSON arrays with the bearer token and round-trips JSON", async () => {
    const calls: { url: string; auth: string | null; body: unknown }[] = [];
    const store = new Map<string, string>();
    const fake = (async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as string[];
      calls.push({ url, auth: new Headers(init.headers).get("authorization"), body });
      const [cmd, k, v] = body;
      let result: unknown = "OK";
      if (cmd === "SET") store.set(k!, v!);
      if (cmd === "GET") result = store.get(k!) ?? null;
      return new Response(JSON.stringify({ result }), { status: 200 });
    }) as unknown as typeof fetch;
    const kv = upstashKV("https://redis.test/", "tok", fake);
    await kv.set("a", { x: 1 }, 60);
    expect(await kv.get("a")).toEqual({ x: 1 });
    expect(await kv.get("missing")).toBeNull();
    expect(calls[0]).toEqual({ url: "https://redis.test", auth: "Bearer tok", body: ["SET", "a", '{"x":1}', "EX", 60] });
  });

  it("surfaces errors", async () => {
    const fake = (async () => new Response(JSON.stringify({ error: "WRONGPASS" }), { status: 401 })) as unknown as typeof fetch;
    await expect(upstashKV("https://r", "t", fake).get("a")).rejects.toThrow(/WRONGPASS/);
  });

  it("reads either env naming", () => {
    expect(kvFromEnv({})).toBeNull();
    expect(kvFromEnv({ KV_REST_API_URL: "u", KV_REST_API_TOKEN: "t" })).not.toBeNull();
    expect(kvFromEnv({ UPSTASH_REDIS_REST_URL: "u", UPSTASH_REDIS_REST_TOKEN: "t" })).not.toBeNull();
  });
});
