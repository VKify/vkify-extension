import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap } from '../../../types/index.js';

/**
 * Перехватывает клики по ссылкам /away.php и открывает
 * реальный URL напрямую, минуя редирект-трекер VK.
 */

function decodeWin1251(str: string): string {
  try {
    return decodeURIComponent(escape(atob(decodeURIComponent(str))));
  } catch {
    return str;
  }
}

function handleClick(e: MouseEvent): void {
  const target = e.target as HTMLElement | null;
  const link = target?.closest<HTMLAnchorElement>('a');
  if (!link) return;

  if (!/\/away\.php/.test(link.pathname)) return;

  e.preventDefault();
  e.stopPropagation();

  try {
    const params = new URLSearchParams(link.search);
    const raw = params.get('to');
    if (!raw) return;

    const targetUrl = params.get('utf') ? raw : decodeWin1251(raw);
    const url = new URL(targetUrl);
    window.open(url.href, '_blank', 'noopener,noreferrer');
  } catch {
    // Если URL не распознан — открываем как есть
    window.open(link.href, '_blank', 'noopener,noreferrer');
  }
}

export function createBypassAwayLinksFeature(_manager: FeatureManager): FeatureMap {
  let active = false;

  return {
    bypass_away_links: {
      enable: () => {
        if (active) return;
        document.addEventListener('click', handleClick, true);
        active = true;
        console.log('[VKify] bypass_away_links: включено');
      },
      disable: () => {
        document.removeEventListener('click', handleClick, true);
        active = false;
        console.log('[VKify] bypass_away_links: выключено');
      },
    },
  };
}