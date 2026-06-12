import type { FeatureManager } from '../../../core/feature-manager.js';

/** Скрывает блок «Истории возможных друзей» на профиле (CSS — hide-stories-discover.css). */
export function registerHideStoriesDiscoverFeature(manager: FeatureManager): void {
  manager.register('hide_stories_discover', {
    enable: () => manager.enableCss('hide_stories_discover'),
    disable: () => manager.disableCss('hide_stories_discover'),
  });
}
