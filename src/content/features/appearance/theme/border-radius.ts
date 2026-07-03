import type { FeatureContext } from '@/content/core/feature-context.js';
import type { FeatureMap } from '@/types/index.js';

/**
 * Фигурные пресеты скругления аватарок. Ключи синхронизированы с
 * AVATAR_SHAPES в попапе (AppearanceTab) и enum'ом avatar_radius_shape
 * в settings-schema.ts. Пустая строка / отсутствие → процент из слайдера.
 */
const SHAPE_RADIUS: Record<string, string> = {
  drop:  '0 50% 50% 50%',
  leaf:  '0 50% 0 50%',
  petal: '50% 0 50% 0',
  blob:  '30% 70% 70% 30% / 30% 30% 70% 70%',
};

function buildAvatarCss(radius: string): string {
  return `
    /* Современные аватарки (VKUI/React) */
    .vkuiAvatar__host, .Avatar__wrapper, .Avatar__img,
    .BasicAvatar, .BasicAvatar__noImg,
    .AvatarRich, .AvatarRichBadge__icon, .RichAvatar-module_body__DtxL-,
    .vkuiAvatar__host .stOutline__root, .OwnerPageAvatar__underlay,
    .TopNavBtn__profileImg, .MEAvatar, .ImUserAvatar,
    /* Обводка истории вокруг аватарки (классы хешируются — цепляемся за testid/префикс) */
    [data-testid^="richavatar-outline"], [class*="vkitOutline__root"] {
      border-radius: ${radius} !important;
    }

    /* Мессенджер и звонки */
    .ConvoRecommendList__avatar, .ConversationNoPhoto,
    .EmptyDialogStub__avatar img, .CallUsers__user,
    .ChatSettingsMembersWidget__add:before,
    .ChatSettingsInfo__photoSelf, .ChatSettingsInfo__photoGrid, .ChatSettingsInfo__attach,
    .mail_box_single_ava_img, .mv_chat_reply_form img,
    .olist_item_photo, .ts_contact_img {
      border-radius: ${radius} !important;
    }

    /* Истории и нарративы */
    .NarrativeItem__cover, .NarrativeItem__image, .NarrativeItem__image:after,
    .NarrativeNarrowItem__cover, .NarrativeNarrowItem__image,
    .MetaStoryItemPreview__author, .MetaStoryItemPreview__author:after,
    .post_image_stories_unseen:after, .reply_image_stories_unseen:after,
    .right_list_photo_stories_unseen:after {
      border-radius: ${radius} !important;
    }

    /* Сообщества и группы */
    .group_row_img, .group_row_photo, .group_friends_image, .group_box_image,
    .group_u_photo_img, .group_l_photo, .group_l_photo_img,
    .groups_edit_chats_list__item__icon, .groups_edit_event_log_item_photo>img,
    .GroupBanner__cover, .app_widget_avatar, .feedback_group_photo_img {
      border-radius: ${radius} !important;
    }

    /* Посты, ответы, упоминания, лайки */
    .post_img, .post_field_user_image, .post_from_tt_image, .copy_post_img,
    .reply_img, .reply_fakebox_wrap_image:before, .checkbox_official:before,
    .like_tt_image, .feedback_img,
    .like_share_ava.wdd_imgs .wdd_img_full,
    .like_share_ava.wdd_imgs .wdd_img_half,
    .like_share_ava.wdd_imgs .wdd_img_tiny,
    .wdd_img, .wddi_img,
    .mention_tt_img, .mention_tt_person_img {
      border-radius: ${radius} !important;
    }

    /* Опросы и голосования */
    .media_voting_footer_voted_friend, .voting_tt_image, .wk_voting_avatar {
      border-radius: ${radius} !important;
    }

    /* Приложения и игры */
    .apps_feed_user_photo img, .apps_i_group_photo img,
    .apps_frtt_photo, .apps_ss_friend,
    .appAchievementsLeaderBoardItem__ava, .appAchievementsAchievement__friendIcon {
      border-radius: ${radius} !important;
    }

    /* Музыка, видео, статьи */
    .MusicOwnerCell__avatar,
    .audio_block_small_item__img, .audio_block_small_item .audio_pl__actions_wrap,
    .audio_owner_item__img,
    .VideoHeader__avatar, .videoplayer_end_info_author_photo,
    .article_layer__header_owner_img, .author_page_header__avatar,
    .landing_author_guide_header__avatar, .landing_author_guide_header__avatar img {
      border-radius: ${radius} !important;
    }

    /* Списки, ячейки и прочая легаси-вёрстка */
    .cell_img, .cell_add_source_icon, .people_cell_img,
    .ui_ownblock_img, .ui_zoom_inner, .search_item_img,
    .right_list_img, .flist_item_thumb, .ListAddControl__icon,
    .UiEntityMiniatures__itemImage, .OwnerChooser__itemAvatar,
    .owner_photo_preview50, .owner_photo_preview100, .ow_ava,
    .notification__media.circle, .notifier_image, .tag_frame_inner,
    .fans_fan_img, .fans_idolph_wrap, .bp_img, .blst_img,
    .bookmark_page_item__image, .tu_thumb, .tickets_image__i,
    .Entity__photo, .BugtrackerReporterProfile__photo {
      border-radius: ${radius} !important;
    }

    /* MEAvatar маскируется через SVG — без этого скругление не видно */
    .MEAvatar__svg { display: none !important; }
  `;
}

export function createBorderRadiusFeature(ctx: FeatureContext): FeatureMap {
  // Единая точка применения: читает оба параметра (процент + фигура),
  // т.к. итоговый border-radius зависит от их комбинации.
  async function apply(): Promise<void> {
    // Точечные чтения из кэша StorageManager — не полный IPC-дамп storage.
    const [percentRaw, shapeRaw] = await Promise.all([
      ctx.getSetting<number>('border_radius'),
      ctx.getSetting<string>('avatar_radius_shape'),
    ]);
    // 50% — нативный вид VK (аватарки и так круглые): CSS не нужен.
    // Любое другое значение, включая явный 0 (квадратные), инжектится.
    const percent = typeof percentRaw === 'number' ? percentRaw : 50;
    const shape = shapeRaw || '';

    const radius = SHAPE_RADIUS[shape] ?? (percent !== 50 ? `${percent}%` : '');
    if (!radius) {
      ctx.removeCSS('border_radius');
      return;
    }
    ctx.injectCSS('border_radius', buildAvatarCss(radius));
  }

  return {
    border_radius: {
      enable: () => apply(),
      disable: () => apply(),
    },
    avatar_radius_shape: {
      enable: () => apply(),
      disable: () => apply(),
    },
  };
}
