import type { FeatureContext } from '../../core/feature-context.js';
import type { FeatureMap } from '@/types/index.js';

/**
 * Перехватывает клики по ссылкам /away.php и открывает
 * реальный URL напрямую, минуя редирект-трекер VK.
 */

function getDestination(link: HTMLAnchorElement): URL | null {
  const isAway = (url: URL | HTMLAnchorElement) =>
    /(^|\.)vk\.(com|ru)$/.test(url.hostname) && url.pathname === '/away.php';
  if (!isAway(link)) return null;
  const parse = (value: string): URL | null => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
    } catch { return null; }
  };
  const decode = (raw: string): URL | null => {
    let value = raw;
    for (let depth = 0; depth < 8; depth++) {
      // Stop decoding as soon as the URL is valid, preserving escapes inside
      // the final path/query (e.g. an encoded ampersand in a query value).
      const url = parse(value);
      if (url) return url;
      try {
        const next = decodeURIComponent(value);
        if (next === value) break;
        value = next;
      } catch { break; }
    }
    try {
      return parse(new TextDecoder().decode(Uint8Array.from(atob(value), char => char.charCodeAt(0))));
    } catch { return null; }
  };

  let url = new URL(link.href);
  const seen = new Set<string>();
  for (let depth = 0; depth < 16; depth++) {
    if (!isAway(url)) return url;
    if (seen.has(url.href)) return null;
    seen.add(url.href);
    const raw = url.searchParams.get('to');
    const next = raw ? decode(raw) : null;
    if (!next) return null;
    url = next;
  }
  return null;
}

function handleClick(e: MouseEvent): void {
  if (e.type === 'auxclick' ? e.button !== 1 : e.button !== 0) return;
  const target = e.composedPath().find(node => node instanceof Element) as Element | undefined;
  const link = target?.closest<HTMLAnchorElement>('a[href]');
  if (!link) return;
  const url = getDestination(link);
  // Leave unsupported links to VK instead of cancelling them and opening VK again.
  if (!url) return;

  e.preventDefault();
  e.stopImmediatePropagation();
  window.open(url.href, '_blank', 'noopener,noreferrer');
}

export function createBypassAwayLinksFeature(_ctx: FeatureContext): FeatureMap {
  let active = false;

  return {
    bypass_away_links: {
      enable: () => {
        if (active) return;
        // Run before VK's delegated document handlers, including handlers on
        // the same capture node which stopPropagation alone would not stop.
        window.addEventListener('click', handleClick, true);
        window.addEventListener('auxclick', handleClick, true);
        active = true;
        console.log('[VKify] bypass_away_links: включено');
      },
      disable: () => {
        window.removeEventListener('click', handleClick, true);
        window.removeEventListener('auxclick', handleClick, true);
        active = false;
        console.log('[VKify] bypass_away_links: выключено');
      },
    },
  };
}
