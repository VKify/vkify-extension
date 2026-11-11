export const PHOTO_SEARCH_PROVIDERS = ['yandex', 'ozon', 'wildberries', 'google', 'bing', 'tineye', 'saucenao', 'iqdb'] as const;
export type PhotoSearchProvider = typeof PHOTO_SEARCH_PROVIDERS[number];
export const PHOTO_SEARCH_NAMES: Record<PhotoSearchProvider, string> = { yandex: 'Yandex', ozon: 'Ozon', wildberries: 'Wildberries', google: 'Google Lens', bing: 'Bing', tineye: 'TinEye', saucenao: 'SauceNAO', iqdb: 'IQDB' };
export function photoSearchProviders(value: unknown, language = 'ru'): PhotoSearchProvider[] {
  if (!Array.isArray(value)) return language === 'ru' ? ['yandex', 'ozon', 'wildberries', 'google'] : ['google', 'yandex', 'ozon', 'wildberries'];
  return [...new Set(value.filter((id): id is PhotoSearchProvider => PHOTO_SEARCH_PROVIDERS.includes(id)))];
}
/** Explicit quick buttons; older settings keep their single default action. */
export function photoSearchButtons(value: unknown, enabled: PhotoSearchProvider[], preferred?: string): PhotoSearchProvider[] {
  if (!Array.isArray(value)) {
    const first = enabled.find(id => id === preferred) || enabled[0];
    return first ? [first] : [];
  }
  return enabled.filter(id => value.includes(id));
}
export function photoSearchUrl(provider: PhotoSearchProvider, image: string): string {
  const urls = { yandex: 'https://yandex.ru/images/search?rpt=imageview', google: 'https://lens.google.com/uploadbyurl', ozon: 'https://lens.google.com/uploadbyurl', wildberries: 'https://lens.google.com/uploadbyurl', bing: 'https://www.bing.com/images/search?view=detailv2&iss=sbi', tineye: 'https://tineye.com/search', saucenao: 'https://saucenao.com/search.php', iqdb: 'https://iqdb.org/' };
  const url = new URL(urls[provider]);
  url.searchParams.set(provider === 'bing' ? 'q' : 'url', provider === 'bing' ? 'imgurl:' + image : image);
  if (provider === 'ozon' || provider === 'wildberries') url.searchParams.set('q', 'site:' + (provider === 'ozon' ? 'ozon.ru' : 'wildberries.ru'));
  return url.href;
}
export function getSearchPhotoUrl(image: HTMLImageElement): string | null {
  const safe = (raw: string | null): string | null => {
    if (!raw) return null;
    try { const url = new URL(raw, image.baseURI); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
  };
  for (const attribute of ['data-original', 'data-src', 'data-full', 'data-large']) {
    const url = safe(image.getAttribute(attribute)); if (url) return url;
  }
  const candidates = (image.getAttribute('srcset') || '').split(',').map(part => {
    const [url, descriptor] = part.trim().split(/\s+/);
    return { url: safe(url), size: parseFloat(descriptor) || 1 };
  }).filter(item => item.url).sort((a, b) => b.size - a.size);
  return candidates[0]?.url || safe(image.currentSrc) || safe(image.getAttribute('src'));
}
