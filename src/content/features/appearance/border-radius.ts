import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap } from '../../../types/index.js';

export function createBorderRadiusFeature(manager: FeatureManager): FeatureMap {
  return {
    border_radius: {
      enable: (value?: unknown) => {
        if (!value || value === 0) return;
        const v = value as number;

        const cardRadius = v;
        const avatarRadius = Math.min(v, 50);
        const buttonRadius = Math.min(v, 12);
        const inputRadius = Math.min(v, 12);
        const imageRadius = Math.min(v, 16);
        const smallRadius = Math.min(v, 8);
        const tabRadius = Math.min(v, 10);

        manager.injectCSS('border_radius', `
          .ProfileHeader, .page_block, .Post, .post, ._post,
          .wall_item, .feed_row, .box_body, .group_row, .friends_row,
          .vkuiCard, .vkuiGroup__host, .vkuiModalPage__in,
          .vkuiModalCard, .vkuiPopout, .vkuiActionSheet, .vkuiAlert {
            border-radius: ${cardRadius}px !important;
          }

          .page_avatar img, .post_image img, .reply_image img,
          .friend_photo img, .vkuiAvatar__host, .vkuiAvatar__host img,
          .vkuiImageBase__host, .vkuiImageBase__img,
          .MEAvatar, .MEAvatar__imgWrapper, .MEAvatar__imgWrapper img,
          .BasicAvatar, .BasicAvatar img {
            border-radius: ${avatarRadius}% !important;
          }

          .MEAvatar__svg { display: none !important; }

          .flat_button, .button, .vkuiButton__host, .vkuiButton,
          .vkuiIconButton__host {
            border-radius: ${buttonRadius}px !important;
          }

          .vkuiTabs__host, .vkuiTabs__in, .vkuiTabsItem__host {
            border-radius: ${tabRadius}px !important;
          }

          input[type="text"], input[type="search"], input[type="password"],
          input[type="email"], textarea, .vkuiInput__host, .vkuiInput__el,
          .vkuiTextarea__host, .vkuiSearch__host, .vkuiSearch__input {
            border-radius: ${inputRadius}px !important;
          }

          .page_post_thumb_wrap img, .media_link__photo img,
          .PhotoPrimaryAttachment img, .PhotoPrimaryAttachment,
          .vkuiImage__host {
            border-radius: ${imageRadius}px !important;
          }

          .vkuiCounter__host, .vkuiBadge__host, .vkuiSimpleCell__host,
          .UnreadCounter, .vkuiHorizontalCell__host, .vkuiScrollArrow__host {
            border-radius: ${smallRadius}px !important;
          }

          .vkuiHorizontalScroll__host {
            border-radius: ${cardRadius}px !important;
          }

          .vkuiTappable__ripple, .vkuiTappable__stateLayer {
            border-radius: inherit !important;
          }

          :root {
            --vkui_internal--Image_border_radius: ${imageRadius}px !important;
          }
        `);
      },
      disable: () => manager.removeCSS('border_radius'),
    },
  };
}