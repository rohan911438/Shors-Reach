import { describe, expect, it } from "vitest";

import { readCapped } from "./http.js";

const req = (body: string, headers: Record<string, string> = {}) => new Request("https://x/", { method: "POST", body, headers });

describe("readCapped", () => {
  it("returns the body under the cap", async () => {
    expect(await readCapped(req('{"a":1}'), 100)).toBe('{"a":1}');
  });
  it("rejects on a large Content-Length without reading", async () => {
    expect(await readCapped(req("x", { "content-length": "999999" }), 100)).toBeNull();
  });
  it("rejects while streaming when the header is absent or lies", async () => {
    expect(await readCapped(req("x".repeat(5000)), 1000)).toBeNull();
  });
  it("handles multi-byte text", async () => {
    expect(await readCapped(req("é✓"), 100)).toBe("é✓");
  });
});
