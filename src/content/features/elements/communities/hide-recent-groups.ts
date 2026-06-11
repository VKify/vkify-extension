import type { FeatureManager } from '../../../core/feature-manager.js';

/** Скрывает блок недавно посещённых групп в разделе «Сообщества». */
export function registerHideRecentGroupsFeature(manager: FeatureManager): void {
  manager.register('hide_recent_groups', {
    enable: () => {
      manager.injectCSS('hide_recent_groups', `
        #react_rootRecentGroups {
          display: none !important;
        }
        section.vkuiGroup__host:has(button[data-testid=clear_recent_groups]) {
          display: none !important;
        }
        section.vkuiGroup__host:has(button[data-testid=clear_recent_groups]) + .vkuiGroup__separatorSibling {
          display: none !important;
        }
      `);
    },
    disable: () => manager.removeCSS('hide_recent_groups'),
  });
}
