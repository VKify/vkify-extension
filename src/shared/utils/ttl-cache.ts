/**
 * Bounded cache with per-entry TTL. Replaces the unbounded `new Map()` user
 * caches in vk-api-client.ts and the spy injected script, which grew forever
 * on long-lived VK tabs and served permanently-stale online status.
 *
 * Eviction: oldest-inserted entry when over `max` (insertion-order Map).
 * Expiry: entries older than `ttlMs` are treated as absent.
 */
export class TtlCache<K, V> {
  private readonly store = new Map<K, { value: V; at: number }>();

  constructor(
    private readonly max = 500,
    private readonly ttlMs = 5 * 60 * 1000,
  ) {}

  get(key: K): V | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (Date.now() - hit.at > this.ttlMs) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  set(key: K, value: V): void {
    this.store.delete(key);
    this.store.set(key, { value, at: Date.now() });
    if (this.store.size > this.max) {
      const oldest = this.store.keys().next().value as K | undefined;
      if (oldest !== undefined) this.store.delete(oldest);
    }
  }

  delete(key: K): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}