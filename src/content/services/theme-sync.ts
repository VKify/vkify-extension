import { StorageKey } from '../../shared/constants/storage-keys.js';

/**
 * Снимает текущую схему оформления VK со страницы и пишет её в
 * chrome.storage (`vk_scheme`). Попап читает это значение в режиме темы
 * «Как в ВК», чтобы окно расширения и встроенная страница настроек
 * совпадали по светлой/тёмной теме с самим VK.
 *
 * Детект — по яркости вычисленного фона <body> (надёжнее, чем угадывать
 * по конкретному классу VKUI, который VK периодически меняет). Обновляется
 * при смене темы VK (наблюдаем атрибуты <html>/<body>) и системной схемы.
 */

function detectVKScheme(): 'dark' | 'light' {
  try {
    const bg = getComputedStyle(document.body).backgroundColor;
    const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) {
      const r = Number(m[1]), g = Number(m[2]), b = Number(m[3]);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance < 0.5 ? 'dark' : 'light';
    }
  } catch { /* ignore */ }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

let last: 'dark' | 'light' | null = null;
let observer: MutationObserver | null = null;
let mql: MediaQueryList | null = null;
let mqlHandler: (() => void) | null = null;
let scheduled = false;

function sync(): void {
  const scheme = detectVKScheme();
  if (scheme === last) return;
  last = scheme;
  try {
    void chrome.storage.local.set({ [StorageKey.VK_SCHEME]: scheme });
  } catch { /* extension context invalidated */ }
}

function schedule(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => { scheduled = false; sync(); });
}

export function startThemeSync(): void {
  const begin = (): void => {
    sync();

    // VK переключает тему классом/атрибутом на <html>/<body> без перезагрузки —
    // пересчитываем яркость фона при таких изменениях.
    observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'scheme'],
    });
    if (document.body) {
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['class', 'style', 'scheme'],
      });
    }

    mql = matchMedia('(prefers-color-scheme: dark)');
    mqlHandler = () => schedule();
    mql.addEventListener('change', mqlHandler);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', begin, { once: true });
  } else {
    begin();
  }
}

export function stopThemeSync(): void {
  observer?.disconnect();
  observer = null;
  if (mql && mqlHandler) mql.removeEventListener('change', mqlHandler);
  mql = null;
  mqlHandler = null;
}
