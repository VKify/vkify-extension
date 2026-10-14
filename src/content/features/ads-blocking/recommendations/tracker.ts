import type { SharedContext } from '../shared.js';
import { CALLS_PROMO_SELECTOR } from './calls-selectors.js';
import { createCandidateIndex, type CandidateRelation } from '@/content/core/dom/candidate-index.js';

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
    label: 'Звонки', selectors: [CALLS_PROMO_SELECTOR],
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

function ancestors(anchor: Element, selector: string): Element[] {
  const result: Element[] = [];
  for (let parent = anchor.parentElement; parent; parent = parent.parentElement) if (parent.matches(selector)) result.push(parent);
  return result;
}

// Start from a distinctive leaf/anchor instead of testing :has() on every
// article, div or section in a long discussion. Keep the catalog selectors
// above for log metadata and the corresponding CSS behavior.
function sources(section: RecommendationSection): CandidateRelation[] {
  const direct = RECOMMENDATION_SECTIONS[section].selectors.map(selector => ({ selector, select: (anchor: Element) => [anchor] }));
  switch (section) {
    case 'block_recommendations_feed':
      return [direct[0], direct[1], {
        selector: 'section[data-testid="groups-recommendation-block"]',
        select: anchor => anchor.parentElement?.matches('div') && anchor.parentElement.parentElement?.matches('article') ? [anchor.parentElement.parentElement] : [],
      }, direct[3], {
        selector: 'a[href*="yandex.ru/project/browser/vk/"]',
        select: anchor => ancestors(anchor, 'section').map(element => element.parentElement)
          .filter((element): element is HTMLElement => !!element?.matches('div') && !!element.parentElement?.closest('#spa_layout_content')),
      }];
    case 'block_recommendations_market':
      return [{ selector: '[title="Может заинтересовать"]', select: anchor => ancestors(anchor, 'section[data-testid="market-catalog-block"]') }];
    case 'block_recommendations_calls':
      return [{
        selector: 'section:is(.vkuiInternalTappable, .vkuiBanner__host)',
        context: anchor => anchor.parentElement,
        select: anchor => {
          const parent = anchor.parentElement;
          return parent?.matches('div') && parent.parentElement?.closest('#spa_layout_content')
            && [...parent.children].some(child => child.matches('[data-testid="calls_aside_menu"]'))
            && anchor.querySelector('img') && anchor.querySelector('a[href]') ? [anchor] : [];
        },
      }];
    case 'block_recommendations_messenger':
      return [...direct.slice(0, 4), {
        selector: 'button[aria-label="Закрыть"].ConversationsBar__close',
        select: anchor => anchor.parentElement?.matches('div') ? [anchor.parentElement] : [],
      }];
    case 'block_music_ads':
      return [direct[0], {
        selector: 'a[href*="vk_music"][href*="musbanner"]', select: anchor => anchor.parentElement ? [anchor.parentElement] : [],
      }, direct[2]];
    case 'block_recommendations_video':
      return [{
        selector: 'a[href="https://vk.ru/vkpremium"]',
        context: anchor => anchor.closest('section'),
        select: anchor => {
          const parent = anchor.closest('section');
          return parent && !parent.querySelector(':scope section a[href="https://vk.ru/vkpremium"]') ? [parent] : [];
        },
      }, {
        selector: 'ins[data-ad-slot]', select: anchor => anchor.parentElement?.closest('#spa_root') ? [anchor] : [],
      }];
    default: return direct;
  }
}

function describeElement(element: Element, selector: string): string {
  const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 240);
  const href = element instanceof HTMLAnchorElement ? element.href : element.querySelector<HTMLAnchorElement>('a[href]')?.href;
  return [text, href, `Селектор: ${selector}`].filter(Boolean).join('\n');
}

export function createRecommendationTracker(shared: SharedContext) {
  const active = new Map<RecommendationSection, (() => void)[]>();
  const recorded = new WeakMap<Element, Set<RecommendationSection>>();
  const index = createCandidateIndex();

  function enable(section: RecommendationSection): void {
    if (active.has(section)) return;
    void shared.loadStats();
    const config = RECOMMENDATION_SECTIONS[section];
    active.set(section, sources(section).map((source, i) => index.add(source, matches => {
      for (const element of matches) {
        const sections = recorded.get(element) ?? new Set<RecommendationSection>();
        if (sections.has(section)) continue;
        sections.add(section);
        recorded.set(element, sections);
        shared.recordBlock(
          'ad',
          location.hostname || 'vk.ru',
          describeElement(element, config.selectors[i]),
          'dom',
          `Раздел: ${config.label}`,
          undefined,
          section,
        );
      }
    })));
  }

  function disable(section: RecommendationSection): void {
    for (const stop of active.get(section) ?? []) stop();
    active.delete(section);
  }

  return { enable, disable };
}
