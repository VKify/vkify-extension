import type { FeatureManager } from '../../../core/feature-manager.js';

/**
 * Меняет местами панели в мессенджере: список бесед уезжает вправо, а активный
 * диалог — влево (зеркальная раскладка). Реализуется через flex `order` +
 * перенос разделителя/ручки ресайза на другую сторону.
 */
export function registerSwapMessengerPanelsFeature(manager: FeatureManager): void {
  manager.register('messenger_swap_panels', {
    enable: () => {
      manager.injectCSS('messenger_swap_panels', `
        .MEConfig .MEApp__route>:is(.CollapsibleContainer,.MEApp__mainPanel) {
          order: 1;
        }
        .MEConfig .MEApp__mainPanel {
          border-left: 1px solid var(--vkui--color_separator_primary) !important;
          border-right: 0 !important;
        }
        .MEConfig .CollapsibleContainer__widthControllerArea {
          left: -5px !important;
          right: unset !important;
        }
      `);
    },
    disable: () => manager.removeCSS('messenger_swap_panels'),
  });
}
