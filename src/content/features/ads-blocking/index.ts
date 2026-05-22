import type { FeatureManager } from '../../core/feature-manager.js';
import { InjectedScript } from '../../core/injected-scripts.js';
import { waitForInjectedScript } from '../../utils/injected-ready.js';
import type { StatsLogEntry } from '../../../types/index.js';

interface TrackerState {
  observer: MutationObserver | null;
  intervalId: ReturnType<typeof setInterval> | null;
  destroyed: boolean;
}

const CONFIG = {
  scanDebounceMs: 16,
  periodicScanMs: 2000,
  postSelectors: [
    'article[data-index]',
    '[data-testid="post"]',
    '[data-post-id]',
    '.feed_row article',
    '.page_block article',
  ],
  adDomains: [
    'mradx.net', 'yandex.net', 'yastat.net',
    'ad.mail.ru', 'favicon.yandex.net', 'get-direct',
  ],
  // Однозначные маркеры рекламы — блокируют пост самостоятельно.
  // НЕ включать 'реклам' — слишком широко, ложные срабатывания на посты об ad-blocking.
  hardMarkers: ['erid', 'спонсор', 'sponsored', ' advert', 'на правах рекламы', 'партнёрский материал', 'партнерский материал'],
  ctaPhrases: ['купить', 'заказать', 'узнать больше', 'подробнее'],
  buttonSelectors: 'button, [role="button"], .vkuiButton, [class*="button"]',
  // Слово 'реклам' блокирует только в сочетании с другими сигналами (внешняя ссылка / CTA / aria-label).
  // Это предотвращает блокировку постов, которые ОБСУЖДАЮТ рекламу, а не являются ей.
  adWordTrigger: 'реклам',
  antiAdContexts: [
    // Блокировщики рекламы
    'блокировка реклам', 'блокировать реклам', 'без рекламы',
    'убрать реклам', 'скрытие реклам', 'удаление реклам',
    'антиреклам', 'анти-реклам', 'adblock', 'ad block',
    'adblocker', 'no ads', 'block ads', 'remove ads',
    'hide ads', 'никаких реклам', 'отключить реклам',
    'фильтр реклам', 'защита от реклам',
    // Обсуждение рекламы в контексте инструментов
    'от рекламы', 'чистим', 'очищаем', 'убираем реклам',
    'реклама отсека', 'реклам не будет', 'без рекламы',
    'избавиться от реклам', 'скрыть реклам', 'скрывает реклам',
  ],
  whitelistedOwners: ['-235511300'],
};

const TRACKER_DOM_CONFIG = {
  domains: [
    'top-fwz1.mail.ru', 'top.mail.ru', 'ad.mail.ru', 'r.mail.ru',
    'mc.yandex.ru', 'mc.yandex.com', 'yandex.ru/metrika',
    'yandex.ru/metrica', 'google-analytics.com',
    'googletagmanager.com', 'googlesyndication.com',
    'doubleclick.net', 'connect.facebook.net',
    'pixel.facebook.com', 'analytics.tiktok.com',
    'top.rutarget.ru', 'counter.yadro.ru', 'amc.yandex.ru',
    'an.yandex.ru', 'ads.adfox.ru', 'banners.adfox.ru',
    'mytopf.mail.ru', 'stats.vk-portal.net',
  ],
  scriptIds: [
    'tmr-code', 'tmr-counter', 'yt-metrika',
    'yandex-metrika', 'ga-code',
  ],
  inlinePatterns: [
    'top-fwz1.mail.ru', 'top.mail.ru', 'mc.yandex.ru',
    'ym(', 'yaCounter', '_tmr.push', 'mailru-code',
    'gtag(', 'fbq(', 'VK.Retargeting',
  ],
  relatedSelectors: [
    'img[src*="top-fwz1.mail.ru"]', 'img[src*="top.mail.ru"]',
    'img[src*="mc.yandex.ru"]', 'img[src*="pixel."]',
    'img[src*="counter."]', 'img[width="1"][height="1"]',
    'img[style*="display: none"]',
    'iframe[src*="top-fwz1.mail.ru"]',
    'iframe[src*="mc.yandex.ru"]',
    'iframe[src*="doubleclick.net"]',
    'noscript:has(img[src*="top-fwz1.mail.ru"])',
    'noscript:has(img[src*="mc.yandex.ru"])',
  ],
  scanIntervalMs: 3000,
};

const PROCESSED_ATTR = 'data-ad-checked';
const BLOCKED_ATTR = 'data-ad-blocked';

export function registerAdsBlockingFeatures(manager: FeatureManager): { forceScan: () => void } {
  let isEnabled = false;
  let scanTimeout: ReturnType<typeof setTimeout> | null = null;
  let observer: MutationObserver | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let styleElement: HTMLStyleElement | null = null;
  let trackerState: TrackerState | null = null;

  // ── Stats ────────────────────────────────────────────────────────────────
  const STATS_KEYS = ['stats_trackers_blocked', 'stats_ads_blocked', 'stats_block_log'] as const;
  const LOG_MAX = 30;

  let statsTrackers = 0;
  let statsAds = 0;
  let statsLog: StatsLogEntry[] = [];
  let statsFlushTimer: ReturnType<typeof setTimeout> | null = null;
  let statsLoaded = false;

  async function loadStats(): Promise<void> {
    if (statsLoaded) return;
    statsLoaded = true; // до await — исключает параллельные вызовы
    try {
      const data = await chrome.storage.local.get([...STATS_KEYS]);
      // += вместо = : если блоки случились до разрешения storage, они не потеряются
      statsTrackers += (data['stats_trackers_blocked'] as number) || 0;
      statsAds      += (data['stats_ads_blocked']      as number) || 0;
      const stored   = (data['stats_block_log']  as StatsLogEntry[]) || [];
      // in-memory записи свежее — идут первыми, хвост берём из storage
      statsLog = [...statsLog, ...stored].slice(0, LOG_MAX);
    } catch { statsLoaded = false; /* разрешить повтор при следующем вызове */ }
  }

  function scheduleStatsFlush(): void {
    if (statsFlushTimer) return;
    statsFlushTimer = setTimeout(() => {
      statsFlushTimer = null;
      void chrome.storage.local.set({
        stats_trackers_blocked: statsTrackers,
        stats_ads_blocked:      statsAds,
        stats_block_log:        statsLog,
      }).catch(() => {});
    }, 1500);
  }

  function recordBlock(kind: 'tracker' | 'ad', domain: string, detail?: string, method?: 'dom' | 'api'): void {
    if (kind === 'tracker') statsTrackers++;
    else                    statsAds++;

    statsLog.unshift({ kind, domain, time: Date.now(), detail, method });
    if (statsLog.length > LOG_MAX) statsLog.length = LOG_MAX;
    scheduleStatsFlush();
  }

  function handleBlocked(e: Event): void {
    const ev = (e as CustomEvent<{ kind: string; domain: string; url?: string; detail?: string; method?: 'dom' | 'api' }>).detail ?? {};
    if (ev.kind === 'tracker' && ev.domain) {
      recordBlock('tracker', ev.domain, ev.url ?? ev.domain);
    } else if (ev.kind === 'ad' && ev.domain) {
      recordBlock('ad', ev.domain, ev.detail, ev.method ?? 'api');
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ── Custom keywords ───────────────────────────────────────────────────────
  let customBlockWords: string[] = [];
  let customAllowWords: string[] = [];

  // Загружаем слова при старте
  void chrome.storage.local.get(['custom_block_words', 'custom_allow_words']).then(data => {
    customBlockWords = (data['custom_block_words'] as string[]) || [];
    customAllowWords = (data['custom_allow_words'] as string[]) || [];
  }).catch(() => {});

  // Обновляем при изменении настроек в реальном времени
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes['custom_block_words']) customBlockWords = (changes['custom_block_words'].newValue as string[]) || [];
    if (changes['custom_allow_words']) customAllowWords = (changes['custom_allow_words'].newValue as string[]) || [];

    // Сброс статистики из попапа — синхронизируем in-memory переменные,
    // иначе следующий flush перезапишет нули обратно старыми значениями
    if (changes['stats_trackers_blocked']?.newValue === 0) { statsTrackers = 0; }
    if (changes['stats_ads_blocked']?.newValue === 0)      { statsAds = 0; }
    if (changes['stats_block_log'] && Array.isArray(changes['stats_block_log'].newValue) &&
        changes['stats_block_log'].newValue.length === 0)  { statsLog = []; }
  });
  // ─────────────────────────────────────────────────────────────────────────

  function hidePost(post: Element, reason: string): void {
    (post as HTMLElement).style.setProperty('display', 'none', 'important');
    post.setAttribute(BLOCKED_ATTR, 'true');
    const snippet = post.textContent?.trim().replace(/\s+/g, ' ').slice(0, 300) ?? '';
    recordBlock('ad', 'лента ВКонтакте', snippet, 'dom');
    console.log(`[AdBlocker/Fallback] Hidden (${reason}):`, snippet.slice(0, 80));
  }

  function isWhitelisted(post: Element): boolean {
    const postId = post.getAttribute('data-post-id') || '';
    const ownerId = postId.split('_')[0];
    return CONFIG.whitelistedOwners.includes(ownerId);
  }

  function hasAntiAdContext(text: string): boolean {
    return CONFIG.antiAdContexts.some(ctx => text.includes(ctx));
  }

  function hasHardMarker(text: string): boolean {
    return CONFIG.hardMarkers.some(m => text.includes(m));
  }

  function hasObfuscatedAd(html: string): boolean {
    return /рекл[\s\S]{0,50}ама/i.test(html);
  }

  function hasAdSources(images: NodeListOf<Element>): boolean {
    for (const img of images) {
      const src = (img as HTMLImageElement).src || '';
      if (CONFIG.adDomains.some(d => src.includes(d))) return true;
      if (src.includes('utm_') || src.includes('_ga=')) return true;
    }
    return false;
  }

  function hasExternal(links: NodeListOf<Element>): boolean {
    for (const link of links) {
      const href = (link as HTMLAnchorElement).href || '';
      if (!href) continue;
      if (
        href.includes('vk.com') ||
        href.includes('vkontakte') ||
        href.includes('vk.ru') ||
        href.includes('vk.cc') ||
        href.startsWith('/')
      ) continue;
      return true;
    }
    return false;
  }

  function hasCommercialButtons(buttons: NodeListOf<Element>): boolean {
    for (const btn of buttons) {
      const text = btn.textContent?.toLowerCase() || '';
      if (CONFIG.ctaPhrases.some(p => text.includes(p))) return true;
    }
    return false;
  }

  function isAdPost(post: Element): boolean {
    if (isWhitelisted(post)) return false;

    const text = post.textContent?.toLowerCase() || '';

    // 1. Кастомный whitelist — абсолютный приоритет
    if (customAllowWords.length > 0 && customAllowWords.some(w => w && text.includes(w))) return false;

    // 2. Кастомные стоп-слова
    if (customBlockWords.length > 0 && customBlockWords.some(w => w && text.includes(w))) return true;

    const isAntiAdContent = hasAntiAdContext(text);

    // 3. Жёсткие маркеры (erid, спонсор, …) — блокируют самостоятельно
    if (!isAntiAdContent && hasHardMarker(text)) return true;

    const links   = post.querySelectorAll('a[href]');
    const images  = post.querySelectorAll('img');
    const buttons = post.querySelectorAll(CONFIG.buttonSelectors);

    // 4. Рекламные CDN / tracking-параметры в картинках
    if (hasAdSources(images)) return true;

    // 5. Нативная реклама VK (кнопка «Рекламная запись»)
    if (post.querySelector('[data-testid="post-header-subscription-button"]')) return true;

    // 6. aria-label с «реклам» (VK сам помечает свои рекламные блоки)
    if (!isAntiAdContent) {
      const labels = post.querySelectorAll('[aria-label]');
      for (const el of labels) {
        const label = el.getAttribute('aria-label')?.toLowerCase() || '';
        if (label.includes('реклам')) return true;
      }
    }

    // 7. Слово «реклам» — только в сочетании с хотя бы одним дополнительным сигналом.
    //    Это предотвращает ложные срабатывания на посты, ОБСУЖДАЮЩИЕ рекламу
    //    (например, пост о фиче «блокировка рекламы» в VKify-группе).
    if (!isAntiAdContent && text.includes(CONFIG.adWordTrigger)) {
      const hasCTA = CONFIG.ctaPhrases.some(p => text.includes(p));
      if (hasCTA || hasExternal(links) || hasCommercialButtons(buttons)) return true;
    }

    // 8. CTA + внешняя ссылка (без упоминания «реклам»)
    if (!isAntiAdContent) {
      const hasCTA = CONFIG.ctaPhrases.some(p => text.includes(p));
      if (hasCTA && hasExternal(links)) return true;
    }

    // 9. Обфусцированное слово «реклама»
    if (!isAntiAdContent && hasObfuscatedAd((post as HTMLElement).innerHTML)) return true;

    return false;
  }

  function scanAndBlock(): void {
    if (!isEnabled) return;

    const selector = CONFIG.postSelectors.join(', ');
    const posts = document.querySelectorAll(selector);
    let count = 0;

    posts.forEach(post => {
      if (post.hasAttribute(PROCESSED_ATTR)) return;
      post.setAttribute(PROCESSED_ATTR, 'true');
      if (post.hasAttribute(BLOCKED_ATTR)) return;

      if (isAdPost(post)) {
        hidePost(post, 'js-analysis');
        count++;
      }
    });

    if (count > 0) console.log(`[AdBlocker/Fallback] Blocked ${count} ad(s) via DOM scan`);
  }

  function injectPermanentCSS(): void {
    const css = `
      [${BLOCKED_ATTR}="true"] {
        display: none !important;
      }

      [class*="erid"],
      [class*="Erid"],
      [data-testid="videos_for_you_block_spa"],
      .apps_feedRightAppsBlock {
        display: none !important;
      }

      ${CONFIG.adDomains.map(d => `img[src*="${d}"]`).join(',\n      ')} {
        display: none !important;
      }

      ${CONFIG.adDomains.map(d =>
        CONFIG.postSelectors.map(s => `${s}:has(img[src*="${d}"])`).join(',\n      ')
      ).join(',\n      ')} {
        display: none !important;
      }

      ${CONFIG.postSelectors.map(s =>
        `${s}:has(a[href*="//"]:not([href*="vk.com"]):not([href*="vkontakte"])):has(button, [role="button"])`
      ).join(',\n      ')} {
        display: none !important;
      }

      ${CONFIG.postSelectors.map(s =>
        `${s}:has([data-testid="post-header-subscription-button"])`
      ).join(',\n      ')} {
        display: none !important;
      }
    `;

    if (styleElement) styleElement.remove();
    styleElement = document.createElement('style');
    styleElement.id = 'ad-blocker-styles';
    styleElement.textContent = css;
    document.head.insertBefore(styleElement, document.head.firstChild);
  }

  function setupObserver(): void {
    if (observer) observer.disconnect();

    observer = new MutationObserver((mutations) => {
      if (!isEnabled) return;

      let hasNewNodes = false;
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          hasNewNodes = true;
          break;
        }
      }

      if (!hasNewNodes) return;

      if (scanTimeout) clearTimeout(scanTimeout);
      scanTimeout = setTimeout(scanAndBlock, CONFIG.scanDebounceMs);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function enable(): void {
    if (isEnabled) return;
    isEnabled = true;

    void loadStats();
    // Слушаем API-блокировки от ad-feed-blocker (kind:'ad') даже если block_trackers выключен
    window.addEventListener('vkify:blocked', handleBlocked);
    manager.injectScript(InjectedScript.AD_FEED_BLOCKER);
    waitForInjectedScript(InjectedScript.AD_FEED_BLOCKER).then(() => {
      manager.sendEvent('vkify-update-settings', { block_feed_ads: true });
    });

    injectPermanentCSS();

    scanAndBlock();
    setupObserver();

    // Повторный скан через requestAnimationFrame ловит посты, отрисованные после
    // первого прохода (React/Vue рендер). Три setTimeout с нарастающей задержкой
    // заменяем одним — MutationObserver перехватит всё остальное.
    requestAnimationFrame(scanAndBlock);

    intervalId = setInterval(() => {
      if (!isEnabled || document.hidden) return;
      scanAndBlock();
    }, CONFIG.periodicScanMs);

    console.log('[AdBlocker] Enabled (fetch interceptor + CSS/JS fallback)');
  }

  function disable(): void {
    isEnabled = false;

    window.removeEventListener('vkify:blocked', handleBlocked);
    manager.sendEvent('vkify-update-settings', { block_feed_ads: false });

    if (scanTimeout) clearTimeout(scanTimeout);
    if (intervalId) clearInterval(intervalId);
    if (observer) observer.disconnect();
    if (styleElement) styleElement.remove();

    document.querySelectorAll(`[${BLOCKED_ATTR}="true"]`).forEach(el => {
      (el as HTMLElement).style.display = '';
      el.removeAttribute(BLOCKED_ATTR);
      el.removeAttribute(PROCESSED_ATTR);
    });

    console.log('[AdBlocker] Disabled');
  }

  function isTrackerScript(script: HTMLScriptElement): boolean {
    const src = script.src || '';
    const id = script.id || '';
    const content = script.textContent || '';

    if (src && TRACKER_DOM_CONFIG.domains.some(d => src.includes(d))) return true;
    if (id && TRACKER_DOM_CONFIG.scriptIds.includes(id)) return true;
    if (!src && content.length > 0 &&
        TRACKER_DOM_CONFIG.inlinePatterns.some(p => content.includes(p))) return true;

    return false;
  }

  function removeTrackersFromDOM(): number {
    let removedCount = 0;

    document.querySelectorAll('script').forEach(script => {
      if (isTrackerScript(script)) {
        script.remove();
        removedCount++;
      }
    });

    const combinedSelector = TRACKER_DOM_CONFIG.relatedSelectors.join(', ');
    try {
      document.querySelectorAll(combinedSelector).forEach(el => {
        el.remove();
        removedCount++;
      });
    } catch {
      TRACKER_DOM_CONFIG.relatedSelectors.forEach(selector => {
        try {
          document.querySelectorAll(selector).forEach(el => {
            el.remove();
            removedCount++;
          });
        } catch { /* skip */ }
      });
    }

    return removedCount;
  }

  function enableTrackerBlocking(): void {
    if (trackerState) disableTrackerBlocking();

    trackerState = {
      observer: null,
      intervalId: null,
      destroyed: false,
    };

    void loadStats();
    manager.injectScript(InjectedScript.TRACKER_BLOCKER);
    waitForInjectedScript(InjectedScript.TRACKER_BLOCKER).then(() => {
      manager.sendEvent('vkify-update-settings', { block_trackers: true });
    });

    const initialRemoved = removeTrackersFromDOM();
    if (initialRemoved > 0) {
      console.log(`[TrackerBlocker/DOM] Initial cleanup: removed ${initialRemoved} element(s)`);
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const state = trackerState;

    state.observer = new MutationObserver((mutations) => {
      if (!trackerState || trackerState.destroyed) return;

      let hasNewScripts = false;

      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          const el = node as Element;

          if ((el as HTMLElement).tagName === 'SCRIPT' && isTrackerScript(el as HTMLScriptElement)) {
            el.remove();
            console.log('[TrackerBlocker/DOM] Blocked:', (el as HTMLScriptElement).src || '(inline)');
            continue;
          }

          if (el.querySelector?.('script')) hasNewScripts = true;
        }
      }

      if (hasNewScripts) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (!trackerState || trackerState.destroyed) return;
          const count = removeTrackersFromDOM();
          if (count > 0) console.log(`[TrackerBlocker/DOM] Removed ${count} nested element(s)`);
        }, 50);
      }
    });

    state.observer.observe(document.documentElement, { childList: true, subtree: true });

    state.intervalId = setInterval(() => {
      if (!trackerState || trackerState.destroyed || document.hidden) return;
      const count = removeTrackersFromDOM();
      if (count > 0) console.log(`[TrackerBlocker/DOM] Periodic: removed ${count}`);
    }, TRACKER_DOM_CONFIG.scanIntervalMs);

    console.log('[TrackerBlocker] Enabled (network interceptor + DOM fallback)');
  }

  function disableTrackerBlocking(): void {
    if (!trackerState) return;
    trackerState.destroyed = true;

    if (statsFlushTimer) { clearTimeout(statsFlushTimer); statsFlushTimer = null; }
    manager.sendEvent('vkify-update-settings', { block_trackers: false });

    if (trackerState.observer) {
      trackerState.observer.disconnect();
      trackerState.observer = null;
    }

    if (trackerState.intervalId) {
      clearInterval(trackerState.intervalId);
      trackerState.intervalId = null;
    }

    trackerState = null;
    console.log('[TrackerBlocker] Disabled (page reload needed to fully restore)');
  }

  manager.registerMultiple({
    block_left_ads: {
      reapplyOnNavigate: true,
      enable: () => {
        manager.injectCSS('block_left_ads', `
          #ads_wrapper,
          [id*="ads_"],
          [class*="ads_"] {
            display: none !important;
          }
        `);
      },
      disable: () => manager.removeCSS('block_left_ads'),
    },

    block_feed_ads: { reapplyOnNavigate: true, enable, disable },

    block_trackers: {
      enable: enableTrackerBlocking,
      disable: disableTrackerBlocking,
    },
  });

  return {
    forceScan: () => {
      if (isEnabled) scanAndBlock();
    },
  };
}