import type { SharedContext } from '../shared.js';

export const RECOMMENDATION_SECTIONS = {
  block_recommendations_feed: {
    label: 'Лента', selectors: [
      '[data-testid="channels-recommendation-block"]',
      '[data-testid="channel-post-recommendation-block"]',
      'article:has(> div > section[data-testid="groups-recommendation-block"])',
      'div[data-testid="feed_apps_right_block"]',
      '#spa_layout_content div:has(> section a[href*="yandex.ru/project/browser/vk/"])',
    ],
  },
  block_recommendations_games: {
    label: 'Игры', selectors: [
      'section[data-testid="catalog-section-social_recommend"]',
      'a[data-testid="catalog-section-promo_banner"]',
    ],
  },
  block_recommendations_market: {
    label: 'Маркет', selectors: ['section[data-testid="market-catalog-block"]:has([title="Может заинтересовать"])'],
  },
  block_recommendations_calls: {
    label: 'Звонки', selectors: ['#spa_layout_content section.vkuiBanner__host:has(img[alt="Some alt"])'],
  },
  block_recommendations_profile: {
    label: 'Меню профиля', selectors: ['a[class*="ImageBanner-module_banner"]'],
  },
  block_recommendations_messenger: {
    label: 'Мессенджер', selectors: [
      '.ConversationsBar.ConvoList__conversationsBar',
      '.ConvoList__conversationsBar',
      '[class^="ConversationsBar"]',
      '[class*=" ConversationsBar"]',
      'div:has(> button[aria-label="Закрыть"].ConversationsBar__close)',
    ],
  },
  block_music_ads: {
    label: 'Музыка', selectors: [
      '[data-testid="subscriptionbanner"]',
      ':has(> a[href*="vk_music"][href*="musbanner"])',
      '[data-testid="AudioCatalog_SectionListenEachOther"]',
    ],
  },
  block_recommendations_video: {
    label: 'Видео', selectors: ['section:has(a[href="https://vk.ru/vkpremium"]):not(:has(section a[href="https://vk.ru/vkpremium"]))', '#spa_root ins[data-ad-slot]'],
  },
  block_recommendations_communities: {
    label: 'Сообщества', selectors: ['[data-testid="similar-group-block"]'],
  },
  block_yandex_browser_promo: {
    label: 'Яндекс Браузер в меню', selectors: ['#l_invite_menu_promo', '#l_invite_promo'],
  },
} as const;

export type RecommendationSection = keyof typeof RECOMMENDATION_SECTIONS;

function describeElement(element: Element, selector: string): string {
  const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 240);
  const href = element instanceof HTMLAnchorElement ? element.href : element.querySelector<HTMLAnchorElement>('a[href]')?.href;
  return [text, href, `Селектор: ${selector}`].filter(Boolean).join('\n');
}

export function createRecommendationTracker(shared: SharedContext) {
  const active = new Set<RecommendationSection>();
  const recorded = new WeakMap<Element, Set<RecommendationSection>>();
  let observer: MutationObserver | null = null;
  let scanTimer: ReturnType<typeof setTimeout> | null = null;

  function scan(): void {
    scanTimer = null;
    for (const section of active) {
      const config = RECOMMENDATION_SECTIONS[section];
      for (const selector of config.selectors) {
        let matches: NodeListOf<Element>;
        try { matches = document.querySelectorAll(selector); } catch { continue; }
        for (const element of matches) {
          const sections = recorded.get(element) ?? new Set<RecommendationSection>();
          if (sections.has(section)) continue;
          sections.add(section);
          recorded.set(element, sections);
          shared.recordBlock(
            'ad',
            location.hostname || 'vk.ru',
            describeElement(element, selector),
            'dom',
            `Раздел: ${config.label}`,
            undefined,
            section,
          );
        }
      }
    }
  }

  function scheduleScan(): void {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 50);
  }

  function ensureObserver(): void {
    if (observer) return;
    observer = new MutationObserver(scheduleScan);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function enable(section: RecommendationSection): void {
    active.add(section);
    void shared.loadStats();
    ensureObserver();
    scan();
  }

  function disable(section: RecommendationSection): void {
    active.delete(section);
    if (active.size > 0) return;
    observer?.disconnect();
    observer = null;
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = null;
  }

  return { enable, disable };
}
