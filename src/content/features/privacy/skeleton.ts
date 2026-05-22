import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap } from '../../../types/index.js';

export function createSkeletonModeFeature(manager: FeatureManager): FeatureMap {
  return {
    skeleton_mode: {
      enable: () => {
        manager.injectCSS('skeleton_mode', `
          .page_avatar img, .post_image img, .reply_image img,
          .friend_photo img, .im_peer_photo img, .online_camera_image,
          .vkuiAvatar__host img, .vkuiImageBase__host img,
          .MEAvatar img, .BasicAvatar img, .ReImage__img,
          .vkuiUsersStack__photo image {
            visibility: hidden !important;
            opacity: 0 !important;
          }

          .page_avatar, .post_image, .reply_image, .friend_photo,
          .im_peer_photo, .vkuiAvatar__host, .vkuiImageBase__host,
          .MEAvatar, .BasicAvatar, .ReImage, .vkuiUsersStack__photo {
            background: var(--vkui--color_background_secondary) !important;
          }

          .MEAvatar__svg, .vkuiUsersStack__fill { opacity: 0 !important; }

          .OwnerPageName, .OwnerPageName__icons,
          .OwnerPageName .vkuiEllipsisText__content,
          .CommunityHead__groupName--4rPhH {
            color: transparent !important;
            background: var(--vkui--color_background_secondary) !important;
            border-radius: 4px !important;
          }

          .author, .author_name, .wall_signed,
          .PostHeaderTitle, .PostHeaderTitle__link,
          .PostHeaderSubtitle__name, .im_peer_title, .top_nav_link,
          .vkuiTitle__host, .vkuiSimpleCell__children,
          .ConvoTitle__author, .ConvoTitle__title,
          .vkuiEllipsisText__content, .vkuiRichCell__children {
            color: transparent !important;
            background: var(--vkui--color_background_secondary) !important;
            border-radius: 4px !important;
          }

          .wall_post_text, .reply_text, .post_text,
          .message_text, .im_msg_text, .vkuiText__host,
          .vkuiParagraph__host, .ConvoListItem__text,
          .ConvoListItem__message, .MessagePreview {
            color: transparent !important;
            background: var(--vkui--color_background_secondary) !important;
            border-radius: 4px !important;
          }

          .vkuiRichCell__subtitle, .vkuiRichCell__extraSubtitle,
          .vkuiSimpleCell__subtitle, .vkuiCaption__host,
          .vkuiFootnote__host, .vkuiSubhead__host {
            color: transparent !important;
            background: var(--vkui--color_background_secondary) !important;
            border-radius: 4px !important;
          }

          .vkuiLink__host {
            color: transparent !important;
            background: var(--vkui--color_background_secondary) !important;
            border-radius: 4px !important;
          }

          .vkuiIcon { opacity: 0.8 !important; }

          .vkuiCounter__host, .vkuiBadge__host,
          [data-testid="leftmenuitem-counter"], .UnreadCounter {
            background: var(--vkui--color_background_secondary) !important;
            color: transparent !important;
          }

          .vkuiButton__content, .vkuiButton__in {
            color: transparent !important;
            background: var(--vkui--color_background_secondary) !important;
            border-radius: 4px !important;
          }

          .ConvoListItem__date, .post_date, .reply_date,
          .PostHeaderSubtitle__item {
            color: transparent !important;
            background: var(--vkui--color_background_secondary) !important;
            border-radius: 4px !important;
          }

          .vkuiTabsItem__label {
            color: transparent !important;
            background: var(--vkui--color_background_secondary) !important;
            border-radius: 4px !important;
          }

          .Emoji { opacity: 0.3 !important; }
        `);
      },
      disable: () => manager.removeCSS('skeleton_mode'),
    },
  };
}