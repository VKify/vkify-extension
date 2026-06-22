import type { FeatureManager } from '@/content/core/feature-manager.js';

/** Скрывает эмодзи-статусы у имён пользователей (CSS — hide-emoji-status.css). */
export function registerHideEmojiStatusFeature(manager: FeatureManager): void {
  manager.register('hide_emoji_status', {
    enable: () => manager.enableCss('hide_emoji_status'),
    disable: () => manager.disableCss('hide_emoji_status'),
  });
}
