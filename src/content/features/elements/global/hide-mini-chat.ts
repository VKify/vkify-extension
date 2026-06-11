import type { FeatureManager } from '../../../core/feature-manager.js';

/** Скрывает всплывающий мини-чат в углу (CSS — hide-mini-chat.css). */
export function registerHideMiniChatFeature(manager: FeatureManager): void {
  manager.register('hide_mini_chat', {
    enable: () => manager.enableCss('hide_mini_chat'),
    disable: () => manager.disableCss('hide_mini_chat'),
  });
}
