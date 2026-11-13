import { catalogApiFeature } from '../../hiding/catalog-api-feature.js';
import { cssPlugin, handlerFeature } from '@/content/core/features/index.js';
import type { SharedContext } from '../shared.js';
import { createCallsPromoStats } from './calls-stats.js';
import type { FeatureContext } from '@/content/core/feature-context.js';
import { InjectedScript } from '@/content/core/injected-scripts.js';
import { waitForInjectedScript } from '@/content/utils/injected-ready.js';

const SECTIONS = [
  ['block_recommendations_feed', 'feed'],
  ['block_recommendations_calls', 'calls'],
  ['block_recommendations_profile', 'profile'],
  ['block_recommendations_communities', 'communities'],
  ['block_yandex_browser_promo', 'yandex-browser'],
] as const;

export function createRecommendationFeatures(shared: SharedContext, ctx: FeatureContext) {
  const apiOnly = new Set(['block_recommendations_feed', 'block_yandex_browser_promo', 'block_recommendations_profile']);
  const tracker = createCallsPromoStats(shared);
  const active = new Set<string>();
  function setApiFilter(id: string, enabled: boolean): void {
    if (!['block_yandex_browser_promo', 'block_recommendations_communities', 'block_recommendations_feed', 'block_recommendations_profile'].includes(id)) return;
    const script = id === 'block_recommendations_communities'
      ? InjectedScript.COMMUNITY_CATALOG_BLOCKER : InjectedScript.FEED_AD_BLOCKER;

    if (enabled) active.add(id); else active.delete(id);
    ctx.sendEvent('vkify-update-settings', { [id]: enabled });
    if (!enabled) return;
    const ready = waitForInjectedScript(script);
    ctx.injectScript(script);
    void ready.then(() => ctx.sendEvent('vkify-update-settings', { [id]: active.has(id) }));
  }
  return SECTIONS.map(([id, section]) => handlerFeature({
    id,
    name: `Реклама и рекомендации: ${section}`,
    category: 'ads',
    enabledByDefault: true,
    cssFiles: apiOnly.has(id) ? undefined : [`ads-blocking/recommendations/${section}.css`],
    plugins: apiOnly.has(id) ? [] : [cssPlugin([`ads-blocking/recommendations/${section}.css`])],
    handler: {
      enable: () => { setApiFilter(id, true); if (id === 'block_recommendations_calls') tracker.enable(); },
      disable: () => { setApiFilter(id, false); if (id === 'block_recommendations_calls') tracker.disable(); },
    },
  }))
  .concat([catalogApiFeature('block_recommendations_games', 'Промоблоки игр', 'ads'), catalogApiFeature('block_recommendations_market', 'Рекомендации Маркета', 'ads')]);
}
