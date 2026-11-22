import { beforeEach, describe, expect, it } from "vitest";

import type { ScanResult } from "../scan/types.js";
import { handleAlerts, MAX_PER_TARGET, resetAlertsRateLimit, type AlertsDeps, type Sub } from "./handler.js";
import { memoryKV } from "./kv.js";

const ADDR = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";
const ORIGIN = "https://app.test";

function result(status: "EXPOSED_NOW" | "EXPOSED_ON_SPEND"): ScanResult {
  const z = { EXPOSED_NOW: 0, EXPOSED_ON_SPEND: 0, PROTECTED: 0, UNKNOWN: 0 };
  return {
    input: ADDR,
    inputKind: "btc-address",
    holdings: [{ chain: "bitcoin", format: "p2wpkh", locator: ADDR, amountBase: "100000", amount: "0.001", asset: "BTC", usd: 60, status, reason: "btc-hash-hidden" }],
    totals: { usd: { ...z, [status]: 60 }, count: z, unpricedCount: 0 },
    score: status === "EXPOSED_NOW" ? 100 : 0,
    scoreBasis: "usd",
    sources: [{ source: "mempool.space", ok: true }],
    scannedAt: new Date().toISOString(),
  };
}

function setup(over: Partial<AlertsDeps> = {}) {
  const kv = memoryKV();
  const mail: { to: string; subject: string; text: string }[] = [];
  const tg: { chat: string; text: string }[] = [];
  let status: "EXPOSED_NOW" | "EXPOSED_ON_SPEND" = "EXPOSED_ON_SPEND";
  const deps: AlertsDeps = {
    kv,
    mailer: { send: async (to, subject, text) => void mail.push({ to, subject, text }) },
    telegram: { username: "shors_bot", send: async (chat, text) => void tg.push({ chat, text }) },
    scanner: async () => result(status),
    origin: ORIGIN,
    cronSecret: "cron-secret",
    telegramSecret: "tg-secret",
    ...over,
  };
  return { kv, mail, tg, deps, setStatus: (s: typeof status) => (status = s) };
}

const post = (body: unknown, path = "/api/alerts", headers: Record<string, string> = {}) =>
  new Request(`${ORIGIN}${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
const cron = (secret = "cron-secret") => new Request(`${ORIGIN}/api/alerts?action=cron`, { headers: { authorization: `Bearer ${secret}` } });
const linkParts = (text: string, kind: "confirm" | "unsubscribe") => {
  const m = new RegExp(`#/watch/${kind}/([0-9a-f]+)/([0-9a-f]+)`).exec(text)!;
  return { id: m[1]!, t: m[2]! };
};

beforeEach(() => resetAlertsRateLimit());

describe("alerts — status & gating", () => {
  it("reports what is enabled", async () => {
    const { deps } = setup();
    expect(await (await handleAlerts(new Request(`${ORIGIN}/api/alerts?action=status`), deps)).json()).toEqual({ storage: true, email: true, telegram: true });
    const off = await handleAlerts(new Request(`${ORIGIN}/api/alerts`), { ...deps, kv: null });
    expect(await off.json()).toEqual({ storage: false, email: false, telegram: false });
  });

  it("503 without storage; 503 for a channel that's off", async () => {
    const { deps } = setup();
    expect((await handleAlerts(post({ action: "subscribe", input: ADDR, channel: "email", email: "a@b.co" }), { ...deps, kv: null })).status).toBe(503);
    expect((await handleAlerts(post({ action: "subscribe", input: ADDR, channel: "email", email: "a@b.co" }), { ...deps, mailer: null })).status).toBe(503);
  });

  it("validates input, email and seed phrases", async () => {
    const { deps } = setup();
    const r = (b: object) => handleAlerts(post({ action: "subscribe", channel: "email", email: "a@b.co", ...b }), deps).then((x) => x.json());
    expect((await r({ input: "hello" })).code).toBe("bad-input");
    expect((await r({ input: ADDR, email: "nope" })).code).toBe("bad-email");
    expect((await r({ input: "abandon ability able about above absent absorb abstract absurd abuse access accident" })).code).toBe("seed-phrase");
  });
});

describe("alerts — email flow (double opt-in)", () => {
  it("subscribe → confirm → cron alerts on change → unsubscribe deletes everything", async () => {
    const { deps, mail, kv, setStatus } = setup();
    const res = await handleAlerts(post({ action: "subscribe", input: ADDR, channel: "email", email: "me@example.com", label: "Cold <b>wallet</b>" }), deps);
    expect(res.status).toBe(200);
    expect(mail).toHaveLength(1);
    expect(mail[0]!.text).not.toContain("/api/alerts?"); // links go to the app, not a GET endpoint
    const { id, t } = linkParts(mail[0]!.text, "confirm");

    // Pending subscriptions are not checked.
    expect(await (await handleAlerts(cron(), deps)).json()).toMatchObject({ checked: 0 });

    expect((await handleAlerts(post({ action: "confirm", id, t: "0".repeat(t.length) }), deps)).status).toBe(404);
    expect(await (await handleAlerts(post({ action: "confirm", id, t }), deps)).json()).toMatchObject({ status: "active", label: "Cold bwallet/b" });

    // First run takes the baseline; nothing sent.
    expect(await (await handleAlerts(cron(), deps)).json()).toEqual({ checked: 1, alerted: 0, errors: 0 });
    expect(mail).toHaveLength(1);

    setStatus("EXPOSED_NOW");
    expect(await (await handleAlerts(cron(), deps)).json()).toEqual({ checked: 1, alerted: 1, errors: 0 });
    expect(mail[1]!.subject).toMatch(/A key was revealed/);
    expect(mail[1]!.text).not.toContain(ADDR);
    expect(mail[1]!.text).toContain("bc1qar0s…5mdq");

    const u = linkParts(mail[1]!.text, "unsubscribe");
    await handleAlerts(post({ action: "unsubscribe", ...u }), deps);
    expect([...kv.dump().keys()].filter((k) => k.startsWith("alerts:sub:"))).toEqual([]);
    expect(await (await handleAlerts(cron(), deps)).json()).toMatchObject({ checked: 0 });
  });

  it(`caps at ${MAX_PER_TARGET} per email`, async () => {
    const { deps } = setup();
    for (let i = 0; i < MAX_PER_TARGET; i++)
      expect((await handleAlerts(post({ action: "subscribe", input: ADDR, channel: "email", email: "x@y.co" }), deps)).status).toBe(200);
    expect((await handleAlerts(post({ action: "subscribe", input: ADDR, channel: "email", email: "X@y.co" }), deps)).status).toBe(429);
  });

  it("rate-limits subscribe per IP", async () => {
    const { deps } = setup();
    let last = 0;
    for (let i = 0; i < 11; i++) last = (await handleAlerts(post({ action: "subscribe", input: ADDR, channel: "telegram" }), deps, "9.9.9.9")).status;
    expect(last).toBe(429);
  });
});

describe("alerts — telegram flow", () => {
  const hook = (text: string, secret = "tg-secret", chat = 42) =>
    post({ message: { chat: { id: chat }, text } }, "/api/alerts?action=telegram", { "x-telegram-bot-api-secret-token": secret });

  it("deep link → /start activates → /stop deletes", async () => {
    const { deps, tg, kv } = setup();
    const r = await (await handleAlerts(post({ action: "subscribe", input: ADDR, channel: "telegram", label: "Hot" }), deps)).json();
    const token = /start=([0-9a-f]+)/.exec(r.link)![1]!;
    expect(r.link).toBe(`https://t.me/shors_bot?start=${token}`);

    expect((await handleAlerts(hook(`/start ${token}`, "wrong"), deps)).status).toBe(401);
    await handleAlerts(hook(`/start ${token}`), deps);
    expect(tg.at(-1)!.text).toMatch(/Watching "Hot"/);
    const subs = [...kv.dump().entries()].filter(([k]) => k.startsWith("alerts:sub:")).map(([, v]) => v as Sub);
    expect(subs[0]).toMatchObject({ status: "active", target: "42" });

    // The link is single-use.
    await handleAlerts(hook(`/start ${token}`, "tg-secret", 77), deps);
    expect(tg.at(-1)).toMatchObject({ chat: "77", text: expect.stringMatching(/expired/) });

    await handleAlerts(hook("/stop"), deps);
    expect(tg.at(-1)!.text).toMatch(/1 alert/);
    expect([...kv.dump().keys()].filter((k) => k.startsWith("alerts:sub:"))).toEqual([]);
  });
});

describe("alerts — cron", () => {
  it("requires the cron secret", async () => {
    const { deps } = setup();
    expect((await handleAlerts(cron("nope"), deps)).status).toBe(401);
    expect((await handleAlerts(cron(), { ...deps, cronSecret: undefined })).status).toBe(401);
  });

  it("a failing scan is counted, not fatal", async () => {
    const { deps, mail } = setup({ scanner: async () => Promise.reject(new Error("down")) });
    await handleAlerts(post({ action: "subscribe", input: ADDR, channel: "email", email: "me@example.com" }), deps);
    await handleAlerts(post({ action: "confirm", ...linkParts(mail[0]!.text, "confirm") }), deps);
    expect(await (await handleAlerts(cron(), deps)).json()).toEqual({ checked: 0, alerted: 0, errors: 1 });
  });
});
