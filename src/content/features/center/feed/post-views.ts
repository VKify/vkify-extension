import { cssPlugin, type FeatureDefinition, type FeaturePlugin } from '@/content/core/features/index.js';
import { getLang } from '@/content/i18n/lang.js';
import { POST_ROOT as POST, POST_DATE } from './post-dom.js';

const KEY = /^-?[1-9]\d*_[1-9]\d*$/;
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};

export function postViewsPage(raw: unknown): Map<string, number> {
  const data = Array.isArray(raw) ? raw : object(raw).items;
  const result = new Map<string, number>();
  if (!Array.isArray(data)) throw new Error('Invalid post response');
  for (const value of data) {
    const post = object(value), key = `${post.owner_id}_${post.id}`, count = object(post.views).count;
    if (KEY.test(key) && typeof count === 'number' && Number.isSafeInteger(count) && count >= 0) result.set(key, count);
  }
  return result;
}

function postKey(post: HTMLElement): string | null {
  const key = post.dataset.postId ?? '';
  if (KEY.test(key)) return key;
  return null;
}

const viewsPlugin: FeaturePlugin = {
  name: 'post-views',
  setup(ctx) {
    let alive = true, running = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cache = new Map<string, number | null>();
    const queue = new Set<string>();
    const inFlight = new Set<string>();
    const bindings = new Map<HTMLElement, { key: string | null; visible: boolean; badge: HTMLElement; sync: () => void; stop: () => void }>();
    const text = (count: number | null): string => count === null ? (getLang() === 'ru' ? 'VK не предоставил число просмотров' : 'VK did not provide a view count')
      : `${getLang() === 'ru' ? 'Просмотры' : 'Views'}: ${new Intl.NumberFormat(getLang()).format(count)}`;
    function enqueue(key: string): void {
      if (cache.has(key) || inFlight.has(key)) return;
      queue.add(key);
      if (!timer && !running) timer = setTimeout(() => { timer = undefined; void flush(); }, 180);
    }
    async function flush(): Promise<void> {
      if (!alive || running || !queue.size) return;
      const keys = [...queue].filter(key => [...bindings.values()].some(binding => binding.key === key && binding.visible)).slice(0, 50);
      keys.forEach(key => queue.delete(key));
      if (!keys.length) { queue.clear(); return; }
      running = true;
      keys.forEach(key => inFlight.add(key));
      try {
        const response = postViewsPage(await ctx.vkApi.call('wall.getById', { posts: keys.join(','), extended: 0, copy_history_depth: 0 }));
        if (alive) keys.forEach(key => cache.set(key, response.get(key) ?? null));
      } catch { if (alive) keys.forEach(key => cache.set(key, null)); }
      finally {
        running = false;
        keys.forEach(key => inFlight.delete(key));
        if (alive) {
          while (cache.size > 500) cache.delete(cache.keys().next().value!);
          bindings.forEach(binding => binding.sync());
          if (queue.size && !timer) timer = setTimeout(() => { timer = undefined; void flush(); }, 180);
        }
      }
    }
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const binding = bindings.get(entry.target as HTMLElement);
        if (binding) { binding.visible = entry.isIntersecting; if (binding.visible) binding.sync(); }
      }
    }, { rootMargin: '200px' });
    ctx.registerMutationObserver(POST, element => {
      if (!(element instanceof HTMLElement) || element.parentElement?.closest(POST) || bindings.has(element)) return;
      bindings.forEach((binding, post) => { if (!post.isConnected) { observer.unobserve(post); binding.stop(); binding.badge.remove(); bindings.delete(post); } });
      const badge = document.createElement('span'); badge.dataset.vkifyPostViews = '';
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('viewBox', '0 0 24 24'); icon.setAttribute('width', '16'); icon.setAttribute('height', '16'); icon.setAttribute('fill', 'none'); icon.setAttribute('stroke', 'currentColor'); icon.setAttribute('stroke-width', '1.7'); icon.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS(icon.namespaceURI, 'path'); path.setAttribute('d', 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z');
      const circle = document.createElementNS(icon.namespaceURI, 'circle'); circle.setAttribute('cx', '12'); circle.setAttribute('cy', '12'); circle.setAttribute('r', '2.5'); icon.append(path, circle);
      const number = document.createElement('span'); badge.append(icon, number);
      let meta: HTMLElement | null = null;
      const binding = { key: null as string | null, visible: false, badge, sync: () => {}, stop: () => {} };
      binding.sync = (): void => {
        if (!alive || !element.isConnected) return;
        const key = postKey(element);
        if (key !== binding.key) { binding.key = key; badge.remove(); }
        if (!key || !binding.visible) return;
        const own = <T extends Element>(selector: string): T | undefined => [...element.querySelectorAll<T>(selector)].find(el => el.closest(POST) === element);
        const date = own<HTMLElement>(POST_DATE);
        const target = date?.parentElement;
        if (!target) return;
        if (meta !== target) { meta?.removeAttribute('data-vkify-post-meta'); meta = date ? target : null; }
        if (meta && !meta.hasAttribute('data-vkify-post-meta')) meta.setAttribute('data-vkify-post-meta', '');
        const count = cache.get(key);
        const value = count === undefined ? '…' : count === null ? '—' : new Intl.NumberFormat(getLang(), { notation: 'compact', maximumFractionDigits: 1 }).format(count);
        if (number.textContent !== value) number.textContent = value;
        const label = count === undefined ? (getLang() === 'ru' ? 'Загрузка просмотров' : 'Loading views') : text(count);
        if (badge.title !== label) { badge.title = label; badge.setAttribute('aria-label', label); }
        if (badge.parentElement !== target) { if (date) target.insertBefore(badge, date); else target.append(badge); }
        if (count === undefined) enqueue(key);
      };
      const off = ctx.observeChanges(binding.sync, { container: element, schedule: 'frame' });
      const attributes = new MutationObserver(binding.sync);
      attributes.observe(element, { attributes: true, attributeFilter: ['data-post-id', 'id'] });
      binding.stop = () => { off(); attributes.disconnect(); meta?.removeAttribute('data-vkify-post-meta'); };
      bindings.set(element, binding); binding.sync(); observer.observe(element);
    });
    return () => {
      alive = false; clearTimeout(timer); observer.disconnect(); queue.clear(); inFlight.clear();
      bindings.forEach(binding => { binding.stop(); binding.badge.remove(); }); bindings.clear(); cache.clear();
    };
  },
};

export const postViewsFeature: FeatureDefinition = {
  id: 'post_views', name: 'Просмотры постов', category: 'feed', requiresDomLayer: true,
  reapplyOnNavigate: true, reapplyOnLanguageChange: true, cssFiles: ['center/feed/post-views.css'],
  plugins: [cssPlugin(['center/feed/post-views.css']), viewsPlugin],
};
