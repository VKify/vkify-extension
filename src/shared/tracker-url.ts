/** URL classification for the existing page-level tracker interceptor. */
export const TRACKER_HOSTS = [
  'ads.vk.ru', 'ad.vk.ru', 'stat.vk.ru', 'stats.vk.ru', 'counter.vk.ru', 'counters.vk.ru', 'pixel.vk.ru',
  'akashi.vk.ru', 'stacks.vk.ru', 'vk-analytics.ru',
  '1l-hit.vkplay.ru', '1l-view.vkplay.ru', 'tracker.vkplay.ru', 'stats.vkplay.ru', 'stats.vk-portal.net',
  'top-fwz1.mail.ru', 'top.mail.ru', 'r.mail.ru', 'rs.mail.ru', 'mytopf.mail.ru',
  'mc.yandex.ru', 'mc.yandex.com', 'amc.yandex.ru', 'an.yandex.ru',
  'tns-counter.ru', 'counter.yadro.ru', 'top.rutarget.ru', 'scorecardresearch.com',
  'google-analytics.com', 'googletagmanager.com', 'googlesyndication.com', 'doubleclick.net',
  'connect.facebook.net', 'pixel.facebook.com', 'fbcdn.net',
  'adriver.ru', 'adfox.ru', 'ads.adfox.ru', 'banners.adfox.ru', 'mytarget.ru',
  'analytics.tiktok.com', 'hotjar.com', 'mixpanel.com', 'amplitude.com', 'segment.com', 'segment.io', 'sentry.io',
] as const;

const hosts = new Set<string>(TRACKER_HOSTS);

function isDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/** Compiled once, and only evaluated on VK-owned paths, never query strings. */
const vkPath = /(?:^|\/)(?:rtrg|ads_rotate|al\/vklog|al_stats\.php|stats_http|statlogs|adsint|ads\.(?:events|stats|analytics)|motion_kit|ad_(?:event|view|click)|mini_apps_stats|games_stats|apps_analytics|mini_app_event|game_event|utm\.gif|pixel\.gif|counter\.gif)(?:[\/._-]|$)/i;

export function isTrackerUrl(value: string | URL, base = 'https://vk.ru/'): boolean {
  let url: URL;
  try { url = value instanceof URL ? value : new URL(value, base); } catch { return false; }
  if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) return false;
  const host = url.hostname;
  // Walk DNS labels instead of scanning every pattern for every request.
  for (let candidate = host; candidate.includes('.'); candidate = candidate.slice(candidate.indexOf('.') + 1)) {
    if (hosts.has(candidate)) return true;
  }
  if (host === 'sdk-api.apptracer.ru' && url.pathname.startsWith('/api/crash/')) return true;
  if (host === 'r3.mail.ru' && /^\/k(?:\/|$)/.test(url.pathname)) return true;
  if (isDomain(host, 'yandex.ru') && /^\/(?:metrika|metrica)(?:\/|$)/.test(url.pathname)) return true;
  if (isDomain(host, 'facebook.com') && /^\/tr(?:\/|$)/.test(url.pathname)) return true;
  return ['vk.ru', 'vk.com', 'vkvideo.ru'].some(domain => isDomain(host, domain)) && vkPath.test(url.pathname);
}

