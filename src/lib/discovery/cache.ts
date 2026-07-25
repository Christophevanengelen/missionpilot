import "server-only";

/**
 * A tiny in-memory, per-query TTL cache for discovery sources.
 *
 * Why it exists: several sources ask us to be frugal — Jobicy documents "no
 * more than one feed check per hour", Himalayas refreshes its own data every
 * 24h so a faster poll buys nothing but risks their 429. One discovery run
 * issues one call per target métier, and nothing stops the owner clicking
 * again a minute later. Caching the answer for the window the SOURCE ITSELF
 * declares keeps repeated runs free instead of hammering them.
 *
 * Scope and honesty: this is process memory, so a cold serverless instance
 * starts empty. It therefore REDUCES traffic, it does not cap it — anyone
 * reading this should not mistake it for a hard rate limiter.
 */

/** Enough for a few métiers across a couple of sources; the cap only exists so
 *  a long-lived instance cannot grow this map without bound. */
const MAX_ENTRIES = 50;

export type TtlCache<T> = {
  get: (key: string) => T | null;
  set: (key: string, value: T) => void;
};

export function createTtlCache<T>(ttlMs: number): TtlCache<T> {
  const entries = new Map<string, { value: T; expiresAt: number }>();
  return {
    get(key) {
      const hit = entries.get(key);
      if (!hit) return null;
      if (hit.expiresAt <= Date.now()) {
        entries.delete(key);
        return null;
      }
      return hit.value;
    },
    set(key, value) {
      // Map iteration is insertion-ordered, so the first key is the oldest.
      if (entries.size >= MAX_ENTRIES && !entries.has(key)) {
        const oldest = entries.keys().next();
        if (!oldest.done) entries.delete(oldest.value);
      }
      entries.set(key, { value, expiresAt: Date.now() + ttlMs });
    },
  };
}
