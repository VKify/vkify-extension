import type { FeatureDefinition } from '@/content/core/features/index.js';
import { InjectedScript } from '@/content/core/injected-scripts.js';
import { waitForInjectedScript } from '@/content/utils/injected-ready.js';
import { ScriptInjector } from '@/content/core/script-injector.js';
import { dispatchPageEvent } from '@/content/utils/page-event.js';

export function catalogApiFeature(id: string, name: string, category: 'ads' | 'hiding' = 'hiding'): FeatureDefinition {
  let enabled = false;
  return { id, name, category, enabledByDefault: category === 'ads', phase: 'early-css', tags: ['network', 'injected-script'],
    init(ctx) {
      enabled = true;
      const script = InjectedScript.CATALOG_VISIBILITY_FILTER;
      const update = () => ctx.sendEvent('vkify-update-settings', { [id]: enabled });
      update(); const ready = waitForInjectedScript(script); ctx.injectScript(script); void ready.then(update);
    },
    destroy(ctx) { enabled = false; ctx.sendEvent('vkify-update-settings', { [id]: false }); },
  };
}

export function startCatalogVisibilityEarly(): void {
  const keys = ['block_left_ads', 'block_recommendations_games', 'block_recommendations_market', 'block_recommendations_communities', 'hide_recent_groups'];
  void chrome.storage.local.get(keys).then(async settings => {
    const catalog = settings.block_left_ads !== false || settings.block_recommendations_games !== false || settings.block_recommendations_market !== false || settings.hide_recent_groups === true;
    const communities = settings.block_recommendations_communities !== false;
    const scripts = [...catalog ? [InjectedScript.CATALOG_VISIBILITY_FILTER] : [], ...communities ? [InjectedScript.COMMUNITY_CATALOG_BLOCKER] : []];
    if (!scripts.length) return;
    const injector = new ScriptInjector();
    await Promise.all(scripts.map(script => { const ready = waitForInjectedScript(script); injector.inject(script); return ready; }));
    const latest = await chrome.storage.local.get(keys);
    dispatchPageEvent('vkify-update-settings', { block_left_ads: latest.block_left_ads !== false,
      block_recommendations_games: latest.block_recommendations_games !== false, block_recommendations_market: latest.block_recommendations_market !== false,
      block_recommendations_communities: latest.block_recommendations_communities !== false, hide_recent_groups: latest.hide_recent_groups === true });
  }).catch(() => {});
}
