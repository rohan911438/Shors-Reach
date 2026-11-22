/**
 * Public Scan API v1 — POST /api/v1/scan { "input": "<address | pubkey | xpub | 0x… | qor1…>" }
 *
 * For wallets, exchanges and custodians that want the same key-level check server-side.
 * The input is processed in memory and never stored or logged. POST only, so inputs don't land in URL logs.
 * CORS is open (*) so browser apps can call it too; the embeddable widget runs scans client-side instead.
 */
import { detectInput, InputError, REASONS, scan, type EngineOptions } from "../scan/index.js";
import type { Holding, ScanResult, Status } from "../scan/types.js";
import { createRateLimiter } from "../lib/rateLimit.js";
import { BODY_TOO_LARGE, readCapped } from "../lib/http.js";
import { looksLikeSeedPhrase } from "../lib/seed.js";

export const API_VERSION = "1";

export type Verdict = "exposed" | "exposed-on-spend" | "protected" | "no-funds" | "incomplete";

export interface ApiHolding {
  chain: Holding["chain"];
  format: Holding["format"];
  locator: string;
  status: Status;
  reason: Holding["reason"];
  reasonTitle: string;
  amount: string;
  asset: string;
  usd: number | null;
  evidenceUrl: string | null;
  evidenceTxid: string | null;
}

export interface ApiScanResponse {
  apiVersion: string;
  input: string;
  inputKind: ScanResult["inputKind"];
  verdict: Verdict;
  /** 0–100, share of value (or holdings) exposed at rest. Higher = worse. */
  score: number;
  scoreBasis: ScanResult["scoreBasis"];
  totalsUsd: Record<Status, number>;
  counts: Record<Status, number>;
  holdings: ApiHolding[];
  qorechain: { pqKeyRegistered: boolean; windowLive: boolean } | null;
  sources: ScanResult["sources"];
  scannedAt: string;
  reportUrl: string;
  methodologyUrl: string;
}

export function verdictOf(r: ScanResult): Verdict {
  const funded = r.holdings.filter((h) => !h.details?.zeroBalance && h.amountBase !== "0");
  const failed = r.sources.some((s) => !s.ok && s.source !== "coingecko");
  if (funded.some((h) => h.status === "EXPOSED_NOW")) return "exposed";
  if (failed) return "incomplete";
  if (funded.length === 0) return "no-funds";
  if (funded.some((h) => h.status === "EXPOSED_ON_SPEND" || h.status === "UNKNOWN")) return "exposed-on-spend";
  return "protected";
}

export function toApiResponse(r: ScanResult, origin: string): ApiScanResponse {
  return {
    apiVersion: API_VERSION,
    input: r.input,
    inputKind: r.inputKind,
    verdict: verdictOf(r),
    score: r.score,
    scoreBasis: r.scoreBasis,
    totalsUsd: Object.fromEntries(Object.entries(r.totals.usd).map(([k, v]) => [k, Math.round(v * 100) / 100])) as Record<Status, number>,
    counts: r.totals.count,
    holdings: r.holdings
      .filter((h) => !h.details?.zeroBalance)
      .map((h) => ({
        chain: h.chain,
        format: h.format,
        locator: h.locator,
        status: h.status,
        reason: h.reason,
        reasonTitle: REASONS[h.reason]?.title ?? h.reason,
        amount: h.amount,
        asset: h.asset,
        usd: h.usd === null ? null : Math.round(h.usd * 100) / 100,
        evidenceUrl: h.evidence?.url ?? null,
        evidenceTxid: h.evidence?.txid ?? null,
      })),
    qorechain: r.qore ? { pqKeyRegistered: r.qore.pqKeyRegistered, windowLive: r.qore.window?.live ?? false } : null,
    sources: r.sources,
    scannedAt: r.scannedAt,
    reportUrl: `${origin}/#/scan/${encodeURIComponent(r.input)}`,
    methodologyUrl: `${origin}/#/methodology`,
  };
}

export interface ScanApiDeps {
  origin: string;
  /** Requests per IP per hour without a key. */
  rateLimit?: number;
  /** Optional partner keys (x-api-key) with a higher limit. */
  apiKeys?: string[];
  keyRateLimit?: number;
  engine?: EngineOptions;
  log?: (m: string) => void;
}

export const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-api-key",
  "access-control-max-age": "86400",
};

const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS, ...extra } });

const limiter = createRateLimiter(60);
export function resetScanApiRateLimit() {
  limiter.reset();
}

export async function handleScanApi(req: Request, d: ScanApiDeps, ip = "unknown"): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Use POST with a JSON body { \"input\": \"…\" }.", code: "method" }, { allow: "POST, OPTIONS" });

  const key = req.headers.get("x-api-key") ?? "";
  const partner = !!key && (d.apiKeys ?? []).includes(key);
  if (key && !partner) return json(401, { error: "Unknown API key.", code: "bad-key" });
  const limit = partner ? (d.keyRateLimit ?? 2000) : (d.rateLimit ?? 60);
  if (limiter.limited(partner ? `key:${key}` : `ip:${ip}`, Date.now(), limit))
    return json(429, { error: "Rate limit reached — try again later, or ask for a partner key.", code: "rate-limit" }, { "retry-after": "3600" });

  let body: unknown;
  try {
    const text = await readCapped(req, 4096);
    if (text === null) return json(413, BODY_TOO_LARGE);
    body = JSON.parse(text);
  } catch {
    return json(400, { error: "Send JSON: { \"input\": \"…\" }.", code: "bad-json" });
  }
  const input = typeof (body as { input?: unknown })?.input === "string" ? (body as { input: string }).input.trim() : "";
  if (!input) return json(400, { error: "Missing \"input\".", code: "missing-input" });
  if (input.length > 200) return json(400, { error: "Input too long.", code: "bad-input" });
  if (looksLikeSeedPhrase(input)) return json(400, { error: "That looks like a seed phrase. Never send it anywhere.", code: "seed-phrase" });
  try {
    detectInput(input);
  } catch (err) {
    return json(400, { error: err instanceof InputError ? err.message : "Unsupported input.", code: "bad-input" });
  }

  const t = Date.now();
  try {
    const r = await scan(input, { signal: AbortSignal.timeout(45_000), ...d.engine });
    // Log timing only — never the input.
    d.log?.(`scan-api ok kind=${r.inputKind} ms=${Date.now() - t} partner=${partner}`);
    return json(200, toApiResponse(r, d.origin));
  } catch (err) {
    d.log?.(`scan-api fail ms=${Date.now() - t} err=${err instanceof Error ? err.name : "unknown"}`);
    return json(502, { error: "A data source failed during the scan. Try again shortly.", code: "upstream" });
  }
}
