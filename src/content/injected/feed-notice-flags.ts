/**
 * Suppress VK's hidden-item observer and its notification UI while filtering ads.
 * Traced in 33189.fdfbf80b.js (module 968927); the config readers in
 * core_spa.0382f85e.js (module 254270) read vk.pe / vk.toggles on each call.
 * The article ref callback in module 264268 checks feed_replaced_items_stats
 * before creating a ResizeObserver. Existing observers still have the UI guard.
 * Other ResizeObservers and feature flags remain unchanged.
 * Browser promo entry points in core_spa and pageFeedSpa also read these
 * configuration objects directly: feed_yandex_browser gates feed startup,
 * invite_promo_*_enabled gates menu insertion, its tooltip, and the modal.
 */
export function suppressFeedNoticeFlags(target: object, enabled: () => boolean,
  browserPromo: { feed: () => boolean; menu: () => boolean } = { feed: () => false, menu: () => false },
): () => void {
  const restore: Array<() => void> = [];
  const watched = new WeakMap<object, Set<string>>();

  function watch(object: object, key: string, visit?: (value: unknown) => void, suppress = enabled): void {
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
    const get = () => visit !== undefined || !suppress() ? value : false;
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
    for (const [container, rules] of [
      ['pe', [
        ['frontend.feed_replaced_item_notify', enabled], ['frontend.feed_replaced_items_stats', enabled],
        ['frontend.invite_promo_menu_item_enabled', browserPromo.menu],
        ['frontend.invite_promo_menu_item_custom_enabled', browserPromo.menu],
        ['frontend.invite_promo_modal_enabled', browserPromo.menu],
        ['frontend.vkconnect_profile_menu_ya_browser_banner_enabled', browserPromo.menu],
      ]],
      ['toggles', [
        ['feed_replaced_item_notify', enabled], ['feed_yandex_browser', browserPromo.feed],
        // Search inserts its banner between results only if a placement is enabled.
        ['feed_search_ya_bro_p1', browserPromo.menu],
        ['feed_search_ya_bro_p2', browserPromo.menu],
        ['feed_search_ya_bro_p3', browserPromo.menu],
      ]],
    ] as const) {
      watch(value, container, flags => {
        if (flags && typeof flags === 'object') {
          for (const [name, predicate] of rules) watch(flags, name, undefined, predicate);
        }
      });
    }
  });
  return () => { restore.reverse().forEach(fn => fn()); };
}
