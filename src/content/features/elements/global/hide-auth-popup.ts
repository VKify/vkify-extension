import type { FeatureManager } from '@/content/core/feature-manager.js';
import { SELECTORS } from '@/content/selectors/index.js';

/**
 * Убирает всплывающие окна авторизации и баннеры «войдите в VK».
 * CSS живёт в hide-auth-popup.css (грузится манифестом, гейтится маркером
 * data-vkify-hide_auth_popup). Помимо CSS периодически вычищает попапы из DOM
 * и возвращает странице скролл — VK навешивает noscroll/scroll_fix на body.
 *
 * Migrated to new DOM layer: список попапов — в SELECTORS.auth.popups.
 */
export function registerHideAuthPopupFeature(manager: FeatureManager): void {
  let bypassAuthInterval: ReturnType<typeof setInterval> | null = null;

  manager.register('hide_auth_popup', {
    enable: () => {
      manager.enableCss('hide_auth_popup');

      const fixVK = () => {
        SELECTORS.auth.popups.forEach(selector => {
          document.querySelectorAll(selector).forEach(el => el.remove());
        });

        document.body.style.overflow = 'auto';
        document.documentElement.style.overflow = 'auto';
        document.body.classList.remove('noscroll', 'scroll_fix');
        document.documentElement.classList.remove('noscroll', 'scroll_fix');
      };

      fixVK();
      bypassAuthInterval = setInterval(fixVK, 500);
    },
    disable: () => {
      manager.disableCss('hide_auth_popup');
      if (bypassAuthInterval) {
        clearInterval(bypassAuthInterval);
        bypassAuthInterval = null;
      }
    },
  });
}
