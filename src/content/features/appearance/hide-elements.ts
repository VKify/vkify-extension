import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap } from '../../../types/index.js';

export function createHideFeatures(manager: FeatureManager): FeatureMap {
  let bypassAuthInterval: ReturnType<typeof setInterval> | null = null;

  return {
    hide_stories: {
      reapplyOnNavigate: true,
      enable: () => {
        manager.injectCSS('hide_stories', `
          [class*="StoriesSection"], [class*="stories_feed"],
          [class*="StoryBlock"], .stories_feed_wrap, ._stories_wrap {
            display: none !important;
          }
        `);
      },
      disable: () => manager.removeCSS('hide_stories'),
    },

    hide_recommendations: {
      reapplyOnNavigate: true,
      enable: () => {
        manager.injectCSS('hide_recommendations', `
          [class*="RecommendedGroups"], [class*="RecommendedContent"],
          [class*="feed_recom"], [class*="FeedRecommendation"],
          .feed_groups_recomm, .feed_friends_recomm,
          ._feed_recommendations, .groups_recomm, .public_recomm {
            display: none !important;
          }
        `);
      },
      disable: () => manager.removeCSS('hide_recommendations'),
    },

    hide_friends_suggestions: {
      reapplyOnNavigate: true,
      enable: () => {
        manager.injectCSS('hide_friends_suggestions', `
          section.vkuiGroup__host:has([title="Возможные друзья"]),
          section.vkuiGroup__host:has([title="People you may know"]),
          section.vkuiGroup__host:has([title="Ймовірні друзі"]),
          [class*="FriendsSuggestions"], [class*="friends_suggests"],
          .friends_possible, ._friends_suggestions {
            display: none !important;
          }
        `);
      },
      disable: () => manager.removeCSS('hide_friends_suggestions'),
    },

    hide_emoji_status: {
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
    },

    hide_mini_chat: {
      enable: () => {
        manager.injectCSS('hide_mini_chat', `
          #fc_container, #fastchat-reforged, .fc_container,
          [class*="MiniChat"], [class*="FastChat"] {
            display: none !important;
          }
        `);
      },
      disable: () => manager.removeCSS('hide_mini_chat'),
    },

    hide_scroll_top: {
      enable: () => {
        manager.injectCSS('hide_scroll_top', `
          #stl_left, .stl_left, .TopButton,
          [class*="ScrollToTop"], [class*="scroll_to_top"] {
            display: none !important;
          }
        `);
      },
      disable: () => manager.removeCSS('hide_scroll_top'),
    },

    hide_menu_settings: {
      enable: () => {
        manager.injectCSS('hide_menu_settings', `
          [class*="LeftMenuItem"][class*="settings"],
          [class*="vkitLeftMenuItem__settings"],
          .left_menu_nav [href*="/settings"], #l_set {
            display: none !important;
          }
        `);
      },
      disable: () => manager.removeCSS('hide_menu_settings'),
    },

    hide_auth_popup: {
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
    },
  };
}