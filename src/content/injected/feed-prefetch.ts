/** Intercept VK's HTML-embedded API cache, including later SPA replacements. */
export function interceptFeedPrefetch(
  target: object,
  filter: (entry: { method: string; response?: unknown }) => void,
): () => void {
  const restorers: Array<() => void> = [];
  const seen = new WeakSet<object>();

  function watch(object: object, key: string, visit: (value: unknown) => void): void {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    // Leave VK-owned accessors and non-configurable properties intact.
    if (descriptor && (!descriptor.configurable || !('value' in descriptor) || !descriptor.writable)) {
      visit(Reflect.get(object, key));
      return;
    }
    let value = descriptor?.value;
    const get = () => { visit(value); return value; };
    Object.defineProperty(object, key, {
      configurable: true, enumerable: descriptor?.enumerable ?? true,
      get, set(next: unknown) { value = next; visit(value); },
    });
    restorers.push(() => {
      if (Object.getOwnPropertyDescriptor(object, key)?.get !== get) return;
      if (descriptor) Object.defineProperty(object, key, { ...descriptor, value });
      else {
        Reflect.deleteProperty(object, key);
        if (value !== undefined) Reflect.set(object, key, value);
      }
    });
    visit(value);
  }

  function visitCache(value: unknown): void {
    if (!Array.isArray(value)) return;
    for (const entry of value) {
      if (entry && typeof entry === 'object' && typeof entry.method === 'string') filter(entry);
    }
  }

  watch(target, 'cur', value => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    watch(value, 'apiPrefetchCache', visitCache);
  });
  return () => { restorers.reverse().forEach(restore => restore()); };
}
