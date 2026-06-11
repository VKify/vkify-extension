import type { FeatureManager } from '../../../core/feature-manager.js';

/**
 * Убирает всплывающие окна авторизации и баннеры «войдите в VK».
 * Кроме CSS периодически вычищает попапы из DOM и возвращает странице скролл —
 * VK навешивает noscroll/scroll_fix на body при показе оверлея.
 */
export function registerHideAuthPopupFeature(manager: FeatureManager): void {
  let bypassAuthInterval: ReturnType<typeof setInterval> | null = null;

  manager.register('hide_auth_popup', {
    enable: () => {
      manager.injectCSS('hide_auth_popup', `
        .vkc__AuthRoot__authLayer,
        #box_layer_bg,
        #box_layer_wrap,
        .box_layer,
        .popup_box_container,
        #PageBottomBanner,
        .PageBottomBanner,
        #page_bottom_banner,
        .page_bottom_banner,
        .UnauthActionBlock,
        .TopUnauthPanel,
        .vkc__AuthFooter,
        .vkc__BottomAuthPanel,
        .vkc__AuthRoot__root,
        [class*="UnauthBanner"],
        [class*="AuthRoot"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }

        body, html {
          overflow: auto !important;
        }

        body.noscroll,
        body.scroll_fix,
        html.noscroll,
        html.scroll_fix {
          overflow: auto !important;
          position: static !important;
        }
      `);

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
      manager.removeCSS('hide_auth_popup');
      if (bypassAuthInterval) {
        clearInterval(bypassAuthInterval);
        bypassAuthInterval = null;
      }
    },
  });
}
