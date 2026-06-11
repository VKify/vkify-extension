import type { FeatureManager } from '../../../core/feature-manager.js';

/** Скрывает всплывающий мини-чат в углу страницы. */
export function registerHideMiniChatFeature(manager: FeatureManager): void {
  manager.register('hide_mini_chat', {
    enable: () => {
      manager.injectCSS('hide_mini_chat', `
        #fc_container, #fastchat-reforged, .fc_container,
        [class*="MiniChat"], [class*="FastChat"] {
          display: none !important;
        }
      `);
    },
    disable: () => manager.removeCSS('hide_mini_chat'),
  });
}
