/**
 * Suppress VK's hidden-item observer and its notification UI while filtering ads.
 * Traced in 33189.fdfbf80b.js (module 968927); the config readers in
 * core_spa.0382f85e.js (module 254270) read vk.pe / vk.toggles on each call.
 * The article ref callback in module 264268 checks feed_replaced_items_stats
 * before creating a ResizeObserver. Existing observers still have the UI guard.
 * Other ResizeObservers and feature flags remain unchanged.
 */
export function suppressFeedNoticeFlags(target: object, enabled: () => boolean): () => void {
  const restore: Array<() => void> = [];
  const watched = new WeakMap<object, Set<string>>();

  function watch(object: object, key: string, visit?: (value: unknown) => void): void {
    let keys = watched.get(object);
    if (!keys) watched.set(object, keys = new Set());
    if (keys.has(key)) return;
    keys.add(key);
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    // Keep VK-owned accessors and immutable configuration intact; DOM fallback remains.
    if (descriptor && (!descriptor.configurable || !('value' in descriptor) || !descriptor.writable)) {
      visit?.(Reflect.get(object, key));
      return;
    }
    let value = descriptor?.value;
    const get = () => visit !== undefined || !enabled() ? value : false;
    try {
      Object.defineProperty(object, key, {
        configurable: true, enumerable: descriptor?.enumerable ?? true,
        get, set(next: unknown) { value = next; visit?.(next); },
      });
    } catch { return; }
    restore.push(() => {
      if (Object.getOwnPropertyDescriptor(object, key)?.get !== get) return;
      if (descriptor) Object.defineProperty(object, key, { ...descriptor, value });
      else {
        Reflect.deleteProperty(object, key);
        if (value !== undefined) Reflect.set(object, key, value);
      }
    });
    visit?.(value);
  }

  watch(target, 'vk', value => {
    if (!value || typeof value !== 'object') return;
    for (const [container, names] of [
      ['pe', ['frontend.feed_replaced_item_notify', 'frontend.feed_replaced_items_stats']],
      ['toggles', ['feed_replaced_item_notify']],
    ] as const) {
      watch(value, container, flags => {
        if (flags && typeof flags === 'object') {
          for (const name of names) watch(flags, name);
        }
      });
    }
  });
  return () => { restore.reverse().forEach(fn => fn()); };
}
