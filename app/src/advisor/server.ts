/**
 * Server-side advisor core, shared by the Vercel function (api/advise.ts) and the Vite dev middleware.
 * Web-standard Request → Response. The model is Google Gemini, called over REST (no SDK) with JSON-schema
 * structured output. Tests inject a fake `GenerateClient`.
 */
import { fallbackPlan } from "./fallback.js";
import { SYSTEM_PROMPT, userMessage } from "./prompt.js";
import { parseSummary, PLAN_JSON_SCHEMA, PlanSchema, type AdviceResponse, type Plan, type Summary } from "./schema.js";
import { BODY_TOO_LARGE, readCapped } from "../lib/http.js";
import { createRateLimiter } from "../lib/rateLimit.js";
import { containsIdentifier } from "../scan/score/summary.js";

export const DEFAULT_MODEL = "gemini-3.5-flash";
const API = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GenerateRequest {
  model: string;
  system: string;
  user: string;
  schema: unknown;
  maxOutputTokens: number;
}
export interface GenerateResult {
  text: string;
  /** Gemini finishReason: STOP, MAX_TOKENS, SAFETY, RECITATION, … */
  finishReason: string;
  usage?: { in?: number; out?: number };
  /** Model that actually answered (may be a fallback model). */
  model?: string;
}
/** Thrown by a client for HTTP-level failures so the retry policy can decide. */
export class UpstreamError extends Error {
  constructor(readonly status: number) {
    super(`upstream ${status}`);
  }
}
/** Minimal surface we use, so tests can inject a fake. */
export interface GenerateClient {
  generate: (req: GenerateRequest) => Promise<GenerateResult>;
}

/** Backup models tried, in order, when the primary one is overloaded (503/500/504), missing (404) or too slow. */
export const DEFAULT_FALLBACK_MODELS = ["gemini-3.5-flash-lite", "gemini-3-flash-preview"];

export interface GeminiClientOptions {
  /** Per-call timeout. */
  timeoutMs?: number;
  /**
   * Total time budget for everything this client does, from creation. Vercel kills the function at maxDuration
   * (60 s), so the budget must end early enough for the caller to still return its rule-based fallback.
   */
  budgetMs?: number;
  fallbackModels?: string[];
  now?: () => number;
}

/**
 * REST client with key rotation and model fallback.
 * - 401/403/429 → next key, same model.
 * - 503/500/502/504, 404 or a timeout → next model.
 * - Never runs past the time budget: it throws UpstreamError(504) instead, so the caller can fall back in time.
 */
export function geminiClient(keys: string[], timeoutMsOrOpts: number | GeminiClientOptions = {}): GenerateClient {
  const o = typeof timeoutMsOrOpts === "number" ? { timeoutMs: timeoutMsOrOpts } : timeoutMsOrOpts;
  const now = o.now ?? Date.now;
  const timeoutMs = o.timeoutMs ?? 25_000;
  const deadline = now() + (o.budgetMs ?? 45_000);
  const fallbacks = o.fallbackModels ?? DEFAULT_FALLBACK_MODELS;
  let current = 0;
  return {
    async generate(req) {
      let lastStatus = 0;
      const models = [req.model, ...fallbacks.filter((m) => m !== req.model)];
      models: for (const model of models) {
        for (let tries = 0; tries < keys.length; tries++) {
          const left = deadline - now() - 1_000;
          if (left < 2_000) throw new UpstreamError(504);
          const key = keys[(current + tries) % keys.length]!;
          let res: Response;
          try {
            res = await fetch(`${API}/${encodeURIComponent(model)}:generateContent`, {
              method: "POST",
              headers: { "content-type": "application/json", "x-goog-api-key": key },
              signal: AbortSignal.timeout(Math.min(timeoutMs, left)),
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: req.system }] },
                contents: [{ role: "user", parts: [{ text: req.user }] }],
                generationConfig: {
                  responseMimeType: "application/json",
                  responseJsonSchema: req.schema,
                  maxOutputTokens: req.maxOutputTokens,
                  temperature: 0.4,
                  // Gemini 3.x thinks by default; low keeps the plan fast. Thoughts are never shown or logged.
                  ...(/gemini-3/.test(model) ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
                },
              }),
            });
          } catch {
            lastStatus = 504; // timeout or network error: this model is not answering, try the next one
            continue models;
          }
          if (res.ok) {
            current = (current + tries) % keys.length;
          const data = (await res.json()) as {
            candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
            promptFeedback?: { blockReason?: string };
            usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
          };
          const cand = data.candidates?.[0];
          const text = (cand?.content?.parts ?? [])
            .filter((p) => !p.thought && typeof p.text === "string")
            .map((p) => p.text)
            .join("");
            return {
              text,
              finishReason: data.promptFeedback?.blockReason ? "SAFETY" : (cand?.finishReason ?? "UNKNOWN"),
              usage: { in: data.usageMetadata?.promptTokenCount, out: data.usageMetadata?.candidatesTokenCount },
              model,
            };
          }
          lastStatus = res.status;
          if ([401, 403, 429].includes(res.status)) continue; // next key
          if ([404, 500, 502, 503, 504].includes(res.status)) continue models; // next model
          throw new UpstreamError(res.status); // 400 etc.: a bug on our side, don't hammer
        }
      }
      throw new UpstreamError(lastStatus);
    },
  };
}

/** Accepts GEMINI_API_KEYS (comma separated) and/or GEMINI_API_KEY. */
export function parseKeys(...values: (string | undefined)[]): string[] {
  return [...new Set(values.flatMap((v) => (v ?? "").split(",")).map((k) => k.trim()).filter(Boolean))];
}

export interface AdvisorEnv {
  apiKeys?: string[];
  model?: string;
  /** Backup models when the primary is overloaded (ADVISOR_FALLBACK_MODELS). */
  fallbackModels?: string[];
  client?: GenerateClient;
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

// ---------------------------------------------------------------- output guard
const SECRET_ASK = /\b(send|share|enter|paste|type|upload|give)\b[^.!?]{0,40}\b(seed|private key|mnemonic|recovery phrase)/i;
const NEGATION = /\b(never|don'?t|do not|not|no one|nobody|nor|avoid|stop)\b/i;
/** True when a sentence tells the user to hand over a secret. "Never share your seed phrase" is fine. */
export function asksForSecrets(text: string): boolean {
  return text.split(/(?<=[.!?])\s+|\n|"\s*,\s*"/).some((sentence) => {
    const m = SECRET_ASK.exec(sentence);
    return !!m && !NEGATION.test(sentence.slice(0, m.index + m[1]!.length));
  });
}

// ---------------------------------------------------------------- model call
type AttemptResult = { ok: true; plan: Plan; model?: string } | { ok: false; reason: string; retry: boolean };

async function attempt(client: GenerateClient, model: string, s: Summary, log: (m: string) => void): Promise<AttemptResult> {
  let r: GenerateResult;
  try {
    r = await client.generate({ model, system: SYSTEM_PROMPT, user: userMessage(s), schema: PLAN_JSON_SCHEMA, maxOutputTokens: 8000 });
  } catch (err) {
    if (err instanceof UpstreamError) {
      if (err.status === 401 || err.status === 403) return { ok: false, reason: "auth", retry: false };
      if (err.status === 400 || err.status === 404) return { ok: false, reason: "bad-request", retry: false };
      if (err.status === 429) return { ok: false, reason: "upstream-rate-limit", retry: false };
      return { ok: false, reason: `api-${err.status || "error"}`, retry: true };
    }
    return { ok: false, reason: "network", retry: true };
  }
  log(`advisor model=${r.model ?? model} tokens in=${r.usage?.in} out=${r.usage?.out} finish=${r.finishReason}`);
  if (r.finishReason === "SAFETY" || r.finishReason === "RECITATION" || r.finishReason === "PROHIBITED_CONTENT")
    return { ok: false, reason: "refusal", retry: false };
  if (r.finishReason === "MAX_TOKENS") return { ok: false, reason: "truncated", retry: true };
  let json: unknown;
  try {
    json = JSON.parse(r.text);
  } catch {
    return { ok: false, reason: "invalid-json", retry: true };
  }
  const parsed = PlanSchema.safeParse(json);
  if (!parsed.success) return { ok: false, reason: "invalid-plan", retry: true };
  // Belt and braces: the plan must never carry an identifier or ask for secrets.
  const out = JSON.stringify(parsed.data);
  if (containsIdentifier(out) || asksForSecrets(out))
    return { ok: false, reason: "unsafe-output", retry: true };
  const plan = { ...parsed.data, actions: [...parsed.data.actions].sort((a, b) => a.priority - b.priority) };
  return { ok: true, plan, model: r.model };
}

export async function advise(s: Summary, env: AdvisorEnv): Promise<AdviceResponse> {
  const log = env.log ?? (() => {});
  const model = env.model || DEFAULT_MODEL;
  const keys = env.apiKeys ?? [];
  if (!env.client && keys.length === 0) return { plan: fallbackPlan(s), source: "fallback", fallbackReason: "no-api-key" };
  const client = env.client ?? geminiClient(keys, { timeoutMs: 15_000, budgetMs: 45_000, fallbackModels: env.fallbackModels });
  let last = "unknown";
  for (let i = 0; i < 2; i++) {
    const r = await attempt(client, model, s, log);
    if (r.ok) return { plan: r.plan, source: "ai", model: r.model ?? model };
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
  let body: string | null;
  try {
    body = await readCapped(req, 32_768);
  } catch {
    return json(400, { error: "Unreadable body." });
  }
  if (body === null) return json(413, BODY_TOO_LARGE);
  const parsed = parseSummary(body);
  if (!parsed.ok) return json(400, { error: parsed.error });
  return json(200, await advise(parsed.summary, env));
}
