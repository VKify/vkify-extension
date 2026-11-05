import { cssPlugin, handlerFeature } from '@/content/core/features/index.js';
import { ADS_CONTENT_SETTINGS } from '@/shared/constants/ads-content.js';
import type { SharedContext } from '../shared.js';
import { createRecommendationTracker, type RecommendationSection } from './tracker.js';
import type { FeatureContext } from '@/content/core/feature-context.js';
import { InjectedScript } from '@/content/core/injected-scripts.js';
import { waitForInjectedScript } from '@/content/utils/injected-ready.js';

const SECTIONS = ['feed', 'games', 'market', 'calls', 'profile', 'messenger', 'music', 'video', 'communities', 'yandex-browser'] as const;

export function createRecommendationFeatures(shared: SharedContext, ctx: FeatureContext) {
  const tracker = createRecommendationTracker(shared);
  const active = new Set<string>();
  function setBrowserPromo(id: string, enabled: boolean): void {
    if (id !== 'block_yandex_browser_promo') return;
    if (enabled) active.add(id); else active.delete(id);
    const ready = waitForInjectedScript(InjectedScript.FEED_AD_BLOCKER);
    ctx.injectScript(InjectedScript.FEED_AD_BLOCKER);
    ctx.sendEvent('vkify-update-settings', { [id]: enabled });
    void ready.then(() => ctx.sendEvent('vkify-update-settings', { [id]: active.has(id) }));
  }
  return ADS_CONTENT_SETTINGS.map((id, index) => handlerFeature({
    id,
    name: `Реклама и рекомендации: ${SECTIONS[index]}`,
    category: 'ads',
    enabledByDefault: true,
    cssFiles: [`ads-blocking/recommendations/${SECTIONS[index]}.css`],
    plugins: [cssPlugin([`ads-blocking/recommendations/${SECTIONS[index]}.css`])],
    handler: {
      enable: () => { setBrowserPromo(id, true); tracker.enable(id as RecommendationSection); },
      disable: () => { setBrowserPromo(id, false); tracker.disable(id as RecommendationSection); },
    },
  }))
  .filter(feature => !['block_music_ads', 'block_recommendations_video'].includes(feature.id));
}
