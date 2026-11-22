/**
 * Tiny key-value surface for the opt-in alerts backend.
 * Production: Upstash Redis REST (Vercel Marketplace → env KV_REST_API_URL / KV_REST_API_TOKEN,
 * or UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN). Tests: in-memory.
 */
export interface KV {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  sadd(key: string, member: string): Promise<void>;
  srem(key: string, member: string): Promise<void>;
  smembers(key: string): Promise<string[]>;
}

export function memoryKV(): KV & { dump(): Map<string, unknown> } {
  const m = new Map<string, unknown>();
  const sets = new Map<string, Set<string>>();
  return {
    async get<T>(k: string) {
      return (m.has(k) ? structuredClone(m.get(k)) : null) as T | null;
    },
    async set(k, v) {
      m.set(k, structuredClone(v));
    },
    async del(k) {
      m.delete(k);
    },
    async sadd(k, v) {
      (sets.get(k) ?? sets.set(k, new Set()).get(k)!).add(v);
    },
    async srem(k, v) {
      sets.get(k)?.delete(v);
    },
    async smembers(k) {
      return [...(sets.get(k) ?? [])];
    },
    dump: () => m,
  };
}

export function upstashKV(url: string, token: string, fetchFn: typeof fetch = fetch): KV {
  const cmd = async <T>(...args: (string | number)[]): Promise<T> => {
    const res = await fetchFn(url.replace(/\/$/, ""), {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => ({}))) as { result?: T; error?: string };
    if (!res.ok || body.error) throw new Error(`kv ${args[0]} failed: ${body.error ?? res.status}`);
    return body.result as T;
  };
  return {
    async get<T>(k: string) {
      const v = await cmd<string | null>("GET", k);
      return v === null ? null : (JSON.parse(v) as T);
    },
    async set(k, v, ttl) {
      await (ttl ? cmd("SET", k, JSON.stringify(v), "EX", ttl) : cmd("SET", k, JSON.stringify(v)));
    },
    async del(k) {
      await cmd("DEL", k);
    },
    async sadd(k, v) {
      await cmd("SADD", k, v);
    },
    async srem(k, v) {
      await cmd("SREM", k, v);
    },
    async smembers(k) {
      return (await cmd<string[]>("SMEMBERS", k)) ?? [];
    },
  };
}

export function kvFromEnv(env: Record<string, string | undefined>): KV | null {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? upstashKV(url, token) : null;
}
