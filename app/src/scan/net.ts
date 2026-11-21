/**
 * Network layer for the scan engine.
 *
 * - Pluggable Transport: production uses fetch; unit tests use recorded fixtures (no network).
 * - Per-host concurrency limit, timeout, retries with backoff, in-memory cache per Net instance.
 */

export interface NetRequest {
  url: string;
  method?: "GET" | "POST";
  /** JSON body for POST requests. */
  body?: unknown;
}

export interface NetResponse {
  status: number;
  text: string;
}

export type Transport = (req: NetRequest, signal?: AbortSignal) => Promise<NetResponse>;

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    public readonly body: string,
  ) {
    super(`HTTP ${status} for ${url}${body ? `: ${body.slice(0, 200)}` : ""}`);
    this.name = "HttpError";
  }
}

export const fetchTransport: Transport = async (req, signal) => {
  const res = await fetch(req.url, {
    method: req.method ?? "GET",
    headers: req.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
    signal,
  });
  return { status: res.status, text: await res.text() };
};

/** Stable key for caching and fixtures. */
export function requestKey(req: NetRequest): string {
  const method = req.method ?? "GET";
  return req.body === undefined ? `${method} ${req.url}` : `${method} ${req.url} ${stableStringify(req.body)}`;
}

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
    .join(",")}}`;
}

export interface NetOptions {
  transport?: Transport;
  /** Max parallel requests per host. */
  concurrency?: number;
  timeoutMs?: number;
  retries?: number;
  /** Base backoff in ms (doubles each retry). */
  backoffMs?: number;
  signal?: AbortSignal;
}

class Semaphore {
  private active = 0;
  private queue: (() => void)[] = [];
  constructor(private readonly max: number) {}
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) await new Promise<void>((r) => this.queue.push(r));
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      this.queue.shift()?.();
    }
  }
}

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

export class Net {
  private readonly transport: Transport;
  private readonly concurrency: number;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly backoffMs: number;
  private readonly signal?: AbortSignal;
  private readonly hosts = new Map<string, Semaphore>();
  private readonly cache = new Map<string, Promise<NetResponse>>();

  constructor(opts: NetOptions = {}) {
    this.transport = opts.transport ?? fetchTransport;
    this.concurrency = opts.concurrency ?? 4;
    this.timeoutMs = opts.timeoutMs ?? 10_000;
    this.retries = opts.retries ?? 2;
    this.backoffMs = opts.backoffMs ?? 400;
    this.signal = opts.signal;
  }

  /** Raw response (any status). Cached per request key, failures are not cached. */
  async request(req: NetRequest): Promise<NetResponse> {
    const key = requestKey(req);
    const hit = this.cache.get(key);
    if (hit) return hit;
    const p = this.withRetries(req);
    this.cache.set(key, p);
    p.catch(() => this.cache.delete(key));
    return p;
  }

  /** Parsed JSON; throws HttpError for non-2xx. */
  async json<T>(req: NetRequest): Promise<T> {
    const res = await this.request(req);
    if (res.status < 200 || res.status >= 300) throw new HttpError(res.status, req.url, res.text);
    try {
      return JSON.parse(res.text) as T;
    } catch {
      throw new HttpError(res.status, req.url, `invalid JSON: ${res.text.slice(0, 80)}`);
    }
  }

  private semaphore(url: string): Semaphore {
    let host: string;
    try {
      host = new URL(url).host;
    } catch {
      host = url;
    }
    let s = this.hosts.get(host);
    if (!s) {
      s = new Semaphore(this.concurrency);
      this.hosts.set(host, s);
    }
    return s;
  }

  private async withRetries(req: NetRequest): Promise<NetResponse> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      if (attempt > 0) await sleep(this.backoffMs * 2 ** (attempt - 1), this.signal);
      try {
        const res = await this.semaphore(req.url).run(() => this.once(req));
        if (RETRYABLE.has(res.status) && attempt < this.retries) {
          lastErr = new HttpError(res.status, req.url, res.text);
          continue;
        }
        return res;
      } catch (err) {
        if (this.signal?.aborted) throw err;
        lastErr = err;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  private async once(req: NetRequest): Promise<NetResponse> {
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    this.signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      return await this.transport(req, ctrl.signal);
    } catch (err) {
      if (ctrl.signal.aborted && !this.signal?.aborted) {
        throw new Error(`timeout after ${this.timeoutMs} ms: ${req.url}`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
      this.signal?.removeEventListener("abort", onAbort);
    }
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new Error("aborted"));
      },
      { once: true },
    );
  });
}

/** Transport that answers from a recorded fixture map; unknown requests fail loudly. */
export function fixtureTransport(fixtures: Record<string, NetResponse | unknown>): Transport {
  return async (req) => {
    const key = requestKey(req);
    if (!(key in fixtures)) throw new Error(`no fixture for: ${key}`);
    const v = fixtures[key];
    if (v && typeof v === "object" && "status" in v && "text" in v) return v as NetResponse;
    return { status: 200, text: JSON.stringify(v) };
  };
}
