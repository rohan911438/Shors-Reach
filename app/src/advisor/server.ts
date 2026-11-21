/**
 * Server-side advisor core, shared by the Vercel function (api/advise.ts) and the Vite dev middleware.
 * Web-standard Request → Response so it is easy to test with a mocked Anthropic client.
 */
import Anthropic from "@anthropic-ai/sdk";

import { fallbackPlan } from "./fallback.js";
import { SYSTEM_PROMPT, userMessage } from "./prompt.js";
import { parseSummary, PLAN_JSON_SCHEMA, PlanSchema, type AdviceResponse, type Plan, type Summary } from "./schema.js";
import { createRateLimiter } from "../lib/rateLimit.js";
import { containsIdentifier } from "../scan/score/summary.js";

export const DEFAULT_MODEL = "claude-opus-5-5";

/** Minimal surface we use, so tests can inject a fake. */
export interface MessagesClient {
  messages: { create: (body: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message> };
}

export interface AdvisorEnv {
  apiKey?: string;
  model?: string;
  client?: MessagesClient;
  /** Requests per IP per hour. */
  rateLimit?: number;
  log?: (msg: string) => void;
}

// ---------------------------------------------------------------- rate limit (per instance, best effort)
const limiter = createRateLimiter(10);
export function rateLimited(ip: string, limit: number, now = Date.now()): boolean {
  return limiter.limited(ip, now, limit);
}
export function resetRateLimit() {
  limiter.reset();
}

// ---------------------------------------------------------------- model call
type AttemptResult = { ok: true; plan: Plan } | { ok: false; reason: string; retry: boolean };

async function attempt(client: MessagesClient, model: string, s: Summary, log: (m: string) => void): Promise<AttemptResult> {
  let msg: Anthropic.Message;
  try {
    msg = await client.messages.create({
      model,
      max_tokens: 8000,
      // Opus 5.5 always thinks; low effort keeps this short, cheap and fast. Thinking is never shown.
      output_config: { effort: "low", format: { type: "json_schema", schema: PLAN_JSON_SCHEMA } },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage(s) }],
    } as Anthropic.MessageCreateParamsNonStreaming);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { ok: false, reason: "auth", retry: false };
    if (err instanceof Anthropic.BadRequestError) return { ok: false, reason: "bad-request", retry: false };
    if (err instanceof Anthropic.RateLimitError) return { ok: false, reason: "upstream-rate-limit", retry: false };
    if (err instanceof Anthropic.APIError) return { ok: false, reason: `api-${err.status ?? "error"}`, retry: true };
    return { ok: false, reason: "network", retry: true };
  }
  log(`advisor tokens in=${msg.usage?.input_tokens} out=${msg.usage?.output_tokens} stop=${msg.stop_reason}`);
  if (msg.stop_reason === "refusal") return { ok: false, reason: "refusal", retry: false };
  if (msg.stop_reason === "max_tokens") return { ok: false, reason: "truncated", retry: true };
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, reason: "invalid-json", retry: true };
  }
  const parsed = PlanSchema.safeParse(json);
  if (!parsed.success) return { ok: false, reason: "invalid-plan", retry: true };
  // Belt and braces: the plan must never carry an identifier or ask for secrets.
  const out = JSON.stringify(parsed.data);
  if (containsIdentifier(out) || /\b(send|share|enter|paste)\b[^.]{0,40}\b(seed|private key|mnemonic)/i.test(out))
    return { ok: false, reason: "unsafe-output", retry: true };
  const plan = { ...parsed.data, actions: [...parsed.data.actions].sort((a, b) => a.priority - b.priority) };
  return { ok: true, plan };
}

export async function advise(s: Summary, env: AdvisorEnv): Promise<AdviceResponse> {
  const log = env.log ?? (() => {});
  const model = env.model || DEFAULT_MODEL;
  if (!env.client && !env.apiKey) return { plan: fallbackPlan(s), source: "fallback", fallbackReason: "no-api-key" };
  const client: MessagesClient = env.client ?? new Anthropic({ apiKey: env.apiKey, maxRetries: 1, timeout: 60_000 });
  let last = "unknown";
  for (let i = 0; i < 2; i++) {
    const r = await attempt(client, model, s, log);
    if (r.ok) return { plan: r.plan, source: "ai", model };
    last = r.reason;
    if (!r.retry) break;
  }
  return { plan: fallbackPlan(s), source: "fallback", fallbackReason: last };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function handleAdvise(req: Request, env: AdvisorEnv, ip = "unknown"): Promise<Response> {
  if (req.method !== "POST") return json(405, { error: "Use POST." });
  if (rateLimited(ip, env.rateLimit ?? 10)) return json(429, { error: "Too many requests — try again in an hour." });
  let body: string;
  try {
    body = await req.text();
  } catch {
    return json(400, { error: "Unreadable body." });
  }
  const parsed = parseSummary(body);
  if (!parsed.ok) return json(400, { error: parsed.error });
  return json(200, await advise(parsed.summary, env));
}
