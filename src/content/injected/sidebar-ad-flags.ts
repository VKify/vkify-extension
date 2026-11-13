/** Native left-ad loader checks this flag before issuing its JSONP campaigns. */
export function suppressSidebarAdLoading(target: object, enabled: () => boolean): () => void {
  const restores: Array<() => void> = [];
  const seen = new WeakMap<object, Set<string>>();
  function watch(object: object, key: string, visit?: (value: unknown) => void): void {
    let keys = seen.get(object);
    if (!keys) seen.set(object, keys = new Set());
    if (keys.has(key)) return;
    keys.add(key);
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (descriptor && (!descriptor.configurable || !('value' in descriptor) || !descriptor.writable)) {
      visit?.(Reflect.get(object, key)); return;
    }
    let value = descriptor?.value;
    const get = () => visit || !enabled() ? value : true;
    try {
      Object.defineProperty(object, key, { configurable: true, enumerable: descriptor?.enumerable ?? true,
        get, set(next: unknown) { value = next; visit?.(next); } });
    } catch { return; }
    restores.push(() => {
      if (Object.getOwnPropertyDescriptor(object, key)?.get !== get) return;
      if (descriptor) Object.defineProperty(object, key, { ...descriptor, value });
      else { Reflect.deleteProperty(object, key); if (value !== undefined) Reflect.set(object, key, value); }
    });
    visit?.(value);
  }
  watch(target, 'vk', vk => {
    if (!vk || typeof vk !== 'object') return;
    watch(vk, 'pe', flags => {
      if (flags && typeof flags === 'object') watch(flags, 'frontend.tgb_disabled');
    });
  });
  return () => { restores.reverse().forEach(restore => restore()); };
}
