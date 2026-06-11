import type { FeatureManager } from '../../../core/feature-manager.js';

/** Скрывает эмодзи-статусы у имён пользователей (verified-галочки не трогаем). */
export function registerHideEmojiStatusFeature(manager: FeatureManager): void {
  manager.register('hide_emoji_status', {
    enable: () => {
      manager.injectCSS('hide_emoji_status', `
        [class*="UserNameIcon__icon"]:not(:has(.vkuiIcon--verified_16)),
        [class*="OwnerNameIcon__icon"]:not(.OwnerPageName__esia, .OwnerPageName__prometheus, .OwnerPageName__verified),
        .image_status__status, .PostHeaderTitle__imageStatus,
        span[class^="UserNameIcon-module__icon"]:has(>img),
        div[class^="StatusIcon"]:has(>img) {
          display: none !important;
        }
      `);
    },
    disable: () => manager.removeCSS('hide_emoji_status'),
  });
}
