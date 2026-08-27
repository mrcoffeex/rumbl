type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

/**
 * Process-local TTL cache. On Vercel each warm isolate keeps its own map, which
 * still absorbs repeated polls (join/results/session detail every 2s) and
 * auth middleware lookups within that instance.
 */
export class TtlCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  constructor(private readonly defaultTtlMs: number) {}

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs = this.defaultTtlMs): T {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }

  async getOrSet<T>(key: string, loader: () => Promise<T>, ttlMs = this.defaultTtlMs): Promise<T> {
    const hit = this.get<T>(key);
    if (hit !== undefined) return hit;
    const value = await loader();
    return this.set(key, value, ttlMs);
  }

  delete(key: string) {
    this.store.delete(key);
  }

  deletePrefix(prefix: string) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  clear() {
    this.store.clear();
  }

  /** Test helper: approximate live entry count (expired rows may linger until touched). */
  size() {
    return this.store.size;
  }
}

/** Short-lived reads: public join/results and session detail polls. */
export const readCache = new TtlCache(1_500);

/** Auth account lookups on every protected request. */
export const authUserCache = new TtlCache(10_000);

/** Admin dashboard aggregates — safe to lag a few seconds. */
export const adminCache = new TtlCache(15_000);

export function sessionCacheKeys(sessionId: number, publicToken?: string) {
  return {
    detail: `session:detail:${sessionId}`,
    results: `session:results:${sessionId}`,
    listOwner: (ownerId: number) => `session:list:${ownerId}`,
    publicSession: publicToken ? `public:session:${publicToken}` : undefined,
    publicResults: publicToken ? `public:results:${publicToken}` : undefined,
  };
}

export function invalidateSessionCaches(sessionId: number, publicToken?: string, ownerId?: number) {
  const keys = sessionCacheKeys(sessionId, publicToken);
  readCache.delete(keys.detail);
  readCache.delete(keys.results);
  if (keys.publicSession) readCache.delete(keys.publicSession);
  if (keys.publicResults) readCache.delete(keys.publicResults);
  if (ownerId != null) readCache.delete(keys.listOwner(ownerId));
  adminCache.clear();
}

export function invalidateAuthUser(userId: number) {
  authUserCache.delete(`auth:user:${userId}`);
  adminCache.clear();
}
