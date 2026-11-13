import { sendMessage } from '@/shared/messaging.js';
import { SITE_URL } from '@/shared/constants/site.js';

type ShortLinkCall = (url: string) => Promise<unknown>;
const call: ShortLinkCall = async url => {
  const response = await sendMessage({ type: 'VK_API_CALL', method: 'utils.getShortLink', params: { url, private: 1 } });
  if (!response?.success) throw new Error('Short link unavailable');
  return response.data;
};

/** Bounded session cache; never persist theme URLs or private statistics keys. */
export function createThemeShortener(request: ShortLinkCall = call) {
  const cache = new Map<string, Promise<string>>();
  return (url: string): Promise<string> => {
    let source: URL;
    try { source = new URL(url); } catch { return Promise.reject(new Error('Invalid theme URL')); }
    if (source.origin !== new URL(SITE_URL).origin || !/^\/theme\/[a-z0-9_-]+$/i.test(source.pathname)
      || source.search || source.hash || source.username || source.password)
      return Promise.reject(new Error('Invalid theme URL'));
    const cached = cache.get(url);
    if (cached) return cached;
    const pending = (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const data = await Promise.race([request(url), new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Short link timed out')), 15_000);
        })]);
        const value = data as { short_url?: unknown } | null;
        if (typeof value?.short_url !== 'string' || value.short_url.length > 256) throw new Error('Invalid short link');
        const short = new URL(value.short_url);
        if (short.protocol !== 'https:' || short.hostname !== 'vk.cc' || short.port || short.username || short.password
          || short.search || short.hash || !/^\/[a-z0-9_-]+$/i.test(short.pathname)) throw new Error('Invalid short link');
        return short.href;
      } finally { if (timer) clearTimeout(timer); }
    })();
    cache.set(url, pending);
    if (cache.size > 8) cache.delete(cache.keys().next().value!);
    void pending.catch(() => { if (cache.get(url) === pending) cache.delete(url); });
    return pending;
  };
}

export const shortenThemeLink = createThemeShortener();
