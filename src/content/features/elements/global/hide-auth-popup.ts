import type { FeatureManager } from '../../../core/feature-manager.js';

/**
 * Убирает всплывающие окна авторизации и баннеры «войдите в VK».
 * CSS живёт в hide-auth-popup.css (грузится манифестом, гейтится маркером
 * data-vkify-hide_auth_popup). Помимо CSS периодически вычищает попапы из DOM
 * и возвращает странице скролл — VK навешивает noscroll/scroll_fix на body.
 */
export function registerHideAuthPopupFeature(manager: FeatureManager): void {
  let bypassAuthInterval: ReturnType<typeof setInterval> | null = null;

  manager.register('hide_auth_popup', {
    enable: () => {
      manager.enableCss('hide_auth_popup');

      const fixVK = () => {
        const selectors = [
          '.vkc__AuthRoot__authLayer', '#box_layer_bg', '#box_layer_wrap',
          '.box_layer', '.popup_box_container', '#PageBottomBanner',
          '.PageBottomBanner', '#page_bottom_banner', '.page_bottom_banner',
          '.UnauthActionBlock', '.TopUnauthPanel', '.vkc__AuthFooter',
          '.vkc__BottomAuthPanel',
        ];

        selectors.forEach(selector => {
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
