import type { FeatureManager } from '@/content/core/feature-manager.js';

/** Скрывает правую колонку профиля (друзья, подписки) — CSS hide-right-column.css. */
export function registerHideProfileRightColumnFeature(manager: FeatureManager): void {
  manager.register('hide_profile_right_column', {
    enable: () => manager.enableCss('hide_profile_right_column'),
    disable: () => manager.disableCss('hide_profile_right_column'),
  });
}
