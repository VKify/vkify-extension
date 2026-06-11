import type { FeatureManager } from '../../../core/feature-manager.js';

/** Скрывает блок «Возможные друзья» (включая локализованные заголовки). */
export function registerHideFriendsSuggestionsFeature(manager: FeatureManager): void {
  manager.register('hide_friends_suggestions', {
    reapplyOnNavigate: true,
    enable: () => {
      manager.injectCSS('hide_friends_suggestions', `
        section.vkuiGroup__host:has([title="Возможные друзья"]),
        section.vkuiGroup__host:has([title="People you may know"]),
        section.vkuiGroup__host:has([title="Ймовірні друзі"]),
        [class*="FriendsSuggestions"], [class*="friends_suggests"],
        .friends_possible, ._friends_suggestions {
          display: none !important;
        }
      `);
    },
    disable: () => manager.removeCSS('hide_friends_suggestions'),
  });
}
