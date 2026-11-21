/** Per-key sliding-window limiter (per server instance, best effort). Used by the API functions. */
export function createRateLimiter(limit: number, windowMs = 3_600_000) {
  const hits = new Map<string, number[]>();
  return {
    limited(key: string, now = Date.now(), max = limit): boolean {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return true;
      }
      recent.push(now);
      hits.set(key, recent);
      if (hits.size > 5000) hits.delete(hits.keys().next().value as string);
      return false;
    },
    reset() {
      hits.clear();
    },
  };
}
