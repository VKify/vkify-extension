import type { FeatureManager } from '../../../core/feature-manager.js';

/** Скрывает недавние группы в «Сообществах» (CSS — hide-recent-groups.css). */
export function registerHideRecentGroupsFeature(manager: FeatureManager): void {
  manager.register('hide_recent_groups', {
    enable: () => manager.enableCss('hide_recent_groups'),
    disable: () => manager.disableCss('hide_recent_groups'),
  });
}
