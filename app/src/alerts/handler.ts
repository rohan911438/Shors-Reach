/**
 * /api/alerts — OPT-IN server-side alerts. This is the one place an address is stored by us, and only after
 * the user asks for it: input + email (or Telegram chat id), deleted on unsubscribe. Pending (unconfirmed)
 * subscriptions expire after 48 h.
 *
 *   GET  ?action=status                      which channels this deployment has enabled
 *   POST { action:"subscribe", input, channel:"email", email, label? }   → confirmation email (double opt-in)
 *   POST { action:"subscribe", input, channel:"telegram", label? }       → t.me deep link to confirm
 *   POST { action:"confirm", id, t }         from the app page the email links to (#/watch/confirm/<id>/<t>)
 *   POST { action:"unsubscribe", id, t }     deletes everything (#/watch/unsubscribe/<id>/<t>)
 * Links point at the app (URL fragment), so mail scanners that prefetch links can't confirm or unsubscribe,
 * and tokens never appear in server logs.
 *   POST ?action=telegram                    Telegram webhook (/start <token>, /stop)
 *   GET  ?action=cron                        scheduled re-check (Authorization: Bearer CRON_SECRET)
 */
import { createRateLimiter } from "../lib/rateLimit.js";
import { looksLikeSeedPhrase } from "../lib/seed.js";
import { detectInput } from "../scan/index.js";
import type { ScanResult } from "../scan/types.js";
import { diff, short, snapshotOf, type Change, type Snapshot } from "../watch/diff.js";
import type { KV } from "./kv.js";
import type { Mailer, Telegram } from "./notify.js";

export interface Sub {
  id: string;
  token: string;
  input: string;
  label: string;
  channel: "email" | "telegram";
  target: string | null; // email address or Telegram chat id
  status: "pending" | "active";
  createdAt: string;
  snapshot?: Snapshot;
  lastCheckedAt?: string;
  lastAlertAt?: string;
}

export interface AlertsDeps {
  kv: KV | null;
  mailer: Mailer | null;
  telegram: Telegram | null;
  scanner: (input: string) => Promise<ScanResult>;
  /** Public origin for links, e.g. https://shors-reach.vercel.app */
  origin: string;
  cronSecret?: string;
  telegramSecret?: string;
  now?: () => number;
  /** Max subscriptions re-checked per cron run (keeps the function under its time limit). */
  batch?: number;
  log?: (m: string) => void;
}

export const MAX_PER_TARGET = 5;
const PENDING_TTL = 48 * 3600;
const EMAIL_RE = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,190}\.[a-z]{2,24}$/i;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const rand = (bytes = 18) => {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
};
const same = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};
const cleanLabel = (s: unknown, input: string) =>
  (typeof s === "string" ? s.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 40) : "") || short(input);

const subKey = (id: string) => `alerts:sub:${id}`;
const ALL = "alerts:subs";
const targetKey = (channel: string, target: string) => `alerts:target:${channel}:${target.toLowerCase()}`;
const tgLinkKey = (token: string) => `alerts:tglink:${token}`;

// ---------------------------------------------------------------- messages

export function alertText(sub: Sub, changes: Change[], origin: string): { subject: string; text: string } {
  const alerts = changes.filter((c) => c.tone === "alert");
  const subject = alerts.length
    ? `⚠ ${sub.label}: ${alerts[0]!.title}${alerts.length > 1 ? ` (+${alerts.length - 1} more)` : ""}`
    : `✓ ${sub.label}: ${changes[0]!.title}`;
  const lines = changes.map((c) => `${c.tone === "alert" ? "⚠" : "✓"} ${c.title}\n  ${c.detail}`);
  const unsub =
    sub.channel === "email" ? `Unsubscribe: ${origin}/#/watch/unsubscribe/${sub.id}/${sub.token}` : "Send /stop to unsubscribe.";
  const text = `Shor's Reach watch — ${sub.label}\n\n${lines.join("\n\n")}\n\nSee the full scan: ${origin}/#/watch\n\n${unsub}`;
  return { subject, text };
}

async function deliver(d: AlertsDeps, sub: Sub, subject: string, text: string) {
  if (!sub.target) return;
  if (sub.channel === "email") await d.mailer?.send(sub.target, subject, text);
  else await d.telegram?.send(sub.target, `${subject}\n\n${text}`);
}

// ---------------------------------------------------------------- store helpers

async function saveSub(kv: KV, sub: Sub) {
  await kv.set(subKey(sub.id), sub, sub.status === "pending" ? PENDING_TTL : undefined);
  await kv.sadd(ALL, sub.id);
}
async function deleteSub(kv: KV, sub: Sub) {
  await kv.del(subKey(sub.id));
  await kv.srem(ALL, sub.id);
  if (sub.target) await kv.srem(targetKey(sub.channel, sub.target), sub.id);
  await kv.del(tgLinkKey(sub.token));
}
async function countLive(kv: KV, key: string): Promise<number> {
  let n = 0;
  for (const id of await kv.smembers(key)) if (await kv.get(subKey(id))) n++;
  return n;
}

// ---------------------------------------------------------------- actions

async function subscribe(d: AlertsDeps, kv: KV, body: Record<string, unknown>): Promise<Response> {
  const input = typeof body.input === "string" ? body.input.trim() : "";
  if (looksLikeSeedPhrase(input)) return json(400, { error: "That looks like a seed phrase. Never paste it anywhere.", code: "seed-phrase" });
  try {
    detectInput(input);
  } catch (err) {
    return json(400, { error: err instanceof Error ? err.message : "Unsupported input.", code: "bad-input" });
  }
  const label = cleanLabel(body.label, input);
  const now = new Date(d.now?.() ?? Date.now()).toISOString();

  if (body.channel === "email") {
    if (!d.mailer) return json(503, { error: "Email alerts are not enabled on this deployment.", code: "channel-off" });
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!EMAIL_RE.test(email)) return json(400, { error: "Enter a valid email address.", code: "bad-email" });
    if ((await countLive(kv, targetKey("email", email))) >= MAX_PER_TARGET)
      return json(429, { error: `Up to ${MAX_PER_TARGET} alerts per email.`, code: "too-many" });
    const sub: Sub = { id: rand(8), token: rand(), input, label, channel: "email", target: email, status: "pending", createdAt: now };
    await saveSub(kv, sub);
    await kv.sadd(targetKey("email", email), sub.id);
    const link = `${d.origin}/#/watch/confirm/${sub.id}/${sub.token}`;
    await d.mailer.send(
      email,
      `Confirm alerts for ${label}`,
      `You asked Shor's Reach to alert you when the quantum exposure of "${label}" changes.\n\nConfirm: ${link}\n\nIf this wasn't you, ignore this email — nothing is stored after 48 hours.\n\nWe store only the address/key you entered and this email, and delete both when you unsubscribe.`,
    );
    return json(200, { ok: true, status: "pending", message: "Check your inbox to confirm." });
  }

  if (body.channel === "telegram") {
    if (!d.telegram) return json(503, { error: "Telegram alerts are not enabled on this deployment.", code: "channel-off" });
    const sub: Sub = { id: rand(8), token: rand(12), input, label, channel: "telegram", target: null, status: "pending", createdAt: now };
    await saveSub(kv, sub);
    await kv.set(tgLinkKey(sub.token), sub.id, PENDING_TTL);
    return json(200, { ok: true, status: "pending", link: `https://t.me/${d.telegram.username}?start=${sub.token}`, message: "Open Telegram and press Start to confirm." });
  }

  return json(400, { error: "channel must be email or telegram.", code: "bad-channel" });
}

async function confirm(kv: KV, id: string, t: string): Promise<Response> {
  const sub = await kv.get<Sub>(subKey(id));
  if (!sub || !same(sub.token, t)) return json(404, { error: "This link is invalid or has expired.", code: "invalid" });
  if (sub.status !== "active") {
    sub.status = "active";
    await saveSub(kv, sub);
  }
  return json(200, { ok: true, status: "active", label: sub.label });
}

async function unsubscribe(kv: KV, id: string, t: string): Promise<Response> {
  const sub = await kv.get<Sub>(subKey(id));
  if (sub && same(sub.token, t)) await deleteSub(kv, sub);
  // Same answer either way: don't reveal whether an id exists.
  return json(200, { ok: true, status: "deleted" });
}

async function telegramWebhook(d: AlertsDeps, kv: KV, req: Request): Promise<Response> {
  if (!d.telegram || !d.telegramSecret || !same(req.headers.get("x-telegram-bot-api-secret-token") ?? "", d.telegramSecret))
    return json(401, { error: "unauthorized" });
  const update = (await req.json().catch(() => null)) as { message?: { chat?: { id?: number | string }; text?: string } } | null;
  const chat = update?.message?.chat?.id;
  const text = update?.message?.text?.trim() ?? "";
  if (chat === undefined) return json(200, { ok: true });
  const chatId = String(chat);

  const start = /^\/start\s+([0-9a-f]{24})$/.exec(text);
  if (start) {
    const id = await kv.get<string>(tgLinkKey(start[1]!));
    const sub = id ? await kv.get<Sub>(subKey(id)) : null;
    if (!sub) {
      await d.telegram.send(chatId, "That link has expired. Start again from the Shor's Reach watchlist.");
      return json(200, { ok: true });
    }
    if ((await countLive(kv, targetKey("telegram", chatId))) >= MAX_PER_TARGET) {
      await d.telegram.send(chatId, `You already have ${MAX_PER_TARGET} alerts. Send /stop to remove them first.`);
      return json(200, { ok: true });
    }
    sub.target = chatId;
    sub.status = "active";
    await saveSub(kv, sub);
    await kv.sadd(targetKey("telegram", chatId), sub.id);
    await kv.del(tgLinkKey(sub.token));
    await d.telegram.send(chatId, `✓ Watching "${sub.label}". You'll get a message here when its quantum exposure changes. Send /stop to unsubscribe from all alerts.`);
    return json(200, { ok: true });
  }
  if (/^\/stop\b/.test(text)) {
    const ids = await kv.smembers(targetKey("telegram", chatId));
    for (const id of ids) {
      const sub = await kv.get<Sub>(subKey(id));
      if (sub) await deleteSub(kv, sub);
    }
    await kv.del(targetKey("telegram", chatId));
    await d.telegram.send(chatId, `Unsubscribed — ${ids.length} alert(s) and their data deleted.`);
    return json(200, { ok: true });
  }
  await d.telegram.send(chatId, "Shor's Reach alerts. Add an address on the watchlist page to get started. /stop removes all alerts.");
  return json(200, { ok: true });
}

export async function runCron(d: AlertsDeps, kv: KV): Promise<{ checked: number; alerted: number; errors: number }> {
  const log = d.log ?? (() => {});
  const subs: Sub[] = [];
  for (const id of await kv.smembers(ALL)) {
    const s = await kv.get<Sub>(subKey(id));
    if (!s) await kv.srem(ALL, id); // expired pending entry
    else if (s.status === "active") subs.push(s);
  }
  // Least recently checked first, so every subscription gets its turn across runs.
  subs.sort((a, b) => (a.lastCheckedAt ?? "").localeCompare(b.lastCheckedAt ?? ""));
  let checked = 0,
    alerted = 0,
    errors = 0;
  for (const sub of subs.slice(0, d.batch ?? 25)) {
    try {
      const snap = snapshotOf(await d.scanner(sub.input));
      const changes = sub.snapshot ? diff(sub.snapshot, snap) : [];
      if (changes.length) {
        const { subject, text } = alertText(sub, changes, d.origin);
        await deliver(d, sub, subject, text);
        sub.lastAlertAt = new Date(d.now?.() ?? Date.now()).toISOString();
        alerted++;
      }
      if (!(snap.partial && sub.snapshot && !sub.snapshot.partial)) sub.snapshot = snap;
      sub.lastCheckedAt = new Date(d.now?.() ?? Date.now()).toISOString();
      await saveSub(kv, sub);
      checked++;
    } catch (err) {
      errors++;
      log(`alerts cron: ${sub.id} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { checked, alerted, errors };
}

const subscribeLimiter = createRateLimiter(10);
export function resetAlertsRateLimit() {
  subscribeLimiter.reset();
}

export async function handleAlerts(req: Request, d: AlertsDeps, ip = "unknown"): Promise<Response> {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "";
  if (action === "status" || (req.method === "GET" && !action))
    return json(200, { storage: !!d.kv, email: !!(d.kv && d.mailer), telegram: !!(d.kv && d.telegram) });
  if (!d.kv) return json(503, { error: "Alerts are not enabled on this deployment.", code: "no-storage" });
  const kv = d.kv;

  if (action === "telegram" && req.method === "POST") return telegramWebhook(d, kv, req);
  if (action === "cron") {
    if (!d.cronSecret || !same(req.headers.get("authorization") ?? "", `Bearer ${d.cronSecret}`)) return json(401, { error: "unauthorized" });
    return json(200, await runCron(d, kv));
  }
  if (req.method === "POST") {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    if (body?.action === "subscribe") {
      if (subscribeLimiter.limited(ip)) return json(429, { error: "Too many requests — try again in an hour.", code: "rate-limit" });
      return subscribe(d, kv, body);
    }
    if (body?.action === "confirm") return confirm(kv, str(body.id), str(body.t));
    if (body?.action === "unsubscribe") return unsubscribe(kv, str(body.id), str(body.t));
    return json(400, { error: "Unknown action." });
  }
  return json(405, { error: "Unsupported method/action." });
}
