/** Intercept VK's HTML-embedded API cache, including later SPA replacements. */
export function interceptFeedPrefetch(
  target: object,
  filter: (entry: { method: string; response?: unknown; request?: unknown }) => void,
): () => void {
  // Injected bundles share this registry: ads and thumbnails must both observe
  // later SPA caches, without wrapping or overriding each other's accessors.
  const key = '__vkifyPrefetchObservers';
  type Filter = typeof filter;
  type Coordinator = { filters: Set<Filter>; visit: () => void; stop: () => void };
  const shared = target as Record<string, Coordinator | undefined>;
  const existing = shared[key];
  if (existing) {
    existing.filters.add(filter);
    existing.visit();
    return () => { existing.filters.delete(filter); if (!existing.filters.size) existing.stop(); };
  }
  const filters = new Set<Filter>([filter]);
  let current: object | undefined;
  let stopCache: (() => void) | undefined;
  let stopCur = () => {};

  function watch(object: object, key: string, visit: (value: unknown) => void): () => void {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    // Leave VK-owned accessors and non-configurable properties intact.
    if (descriptor && (!descriptor.configurable || !('value' in descriptor) || !descriptor.writable)) {
      visit(Reflect.get(object, key));
      return () => {};
    }
    let value = descriptor?.value;
    const get = () => { visit(value); return value; };
    Object.defineProperty(object, key, {
      configurable: true, enumerable: descriptor?.enumerable ?? true,
      get, set(next: unknown) { value = next; visit(value); },
    });
    visit(value);
    return () => {
      if (Object.getOwnPropertyDescriptor(object, key)?.get !== get) return;
      if (descriptor) Object.defineProperty(object, key, { ...descriptor, value });
      else {
        Reflect.deleteProperty(object, key);
        if (value !== undefined) Reflect.set(object, key, value);
      }
    };
  }

  function visitCache(value: unknown): void {
    if (!Array.isArray(value)) return;
    for (const entry of value) {
      if (entry && typeof entry === 'object' && typeof entry.method === 'string') {
        for (const subscriber of filters) subscriber(entry);
      }
    }
  }

  const visitCur = (value: unknown) => {
    if (value === current) return;
    stopCache?.(); stopCache = undefined;
    current = value && typeof value === 'object' ? value : undefined;
    if (current) stopCache = watch(current, 'apiPrefetchCache', visitCache);
  };
  const coordinator: Coordinator = {
    filters,
    visit: () => { const cur = Reflect.get(target, 'cur'); if (cur) visitCache(cur.apiPrefetchCache); },
    stop: () => {
      stopCache?.(); stopCur(); current = undefined;
      if (shared[key] === coordinator) Reflect.deleteProperty(target, key);
    },
  };
  Object.defineProperty(target, key, { configurable: true, value: coordinator });
  stopCur = watch(target, 'cur', visitCur);
  return () => { filters.delete(filter); if (!filters.size) coordinator.stop(); };
}
