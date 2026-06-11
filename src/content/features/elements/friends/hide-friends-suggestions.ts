import type { FeatureManager } from '../../../core/feature-manager.js';

/** Скрывает блок «Возможные друзья» (CSS — hide-friends-suggestions.css). */
export function registerHideFriendsSuggestionsFeature(manager: FeatureManager): void {
  manager.register('hide_friends_suggestions', {
    enable: () => manager.enableCss('hide_friends_suggestions'),
    disable: () => manager.disableCss('hide_friends_suggestions'),
  });
}
