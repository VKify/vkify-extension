import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap } from '../../../types/index.js';

/**
 * Компактный режим — убирает отступы и скругления между блоками VK,
 * добавляет тонкие разделители для визуального разграничения.
 */

const CSS_ID = 'compact_spacing';

const CSS = `
  /* ── 1. Сброс margin у блоков (без !important там, где достаточно) ── */
  :is(
    .page_block:last-child, .page_block_cell, .PageBlock,
    .like_wrap .BadgesStack,
    .VKCOMMessenger__reforgedRightColumn,
    .AppsCatalogMainPage, .ShortVideoPage, .ShortVideoPost,
    .DonutCatalogPromo, .RightMenuBlock,
    .ProfileHeaderSkeleton, .ProfileSkeleton__layout,
    .ProfileSkeleton__column + .ProfileSkeleton__column,
    .ProfileGroupSkeleton
  ) { margin: 0; }

  /* ── 2. Сброс margin с !important для упрямых блоков ─────────────── */
  :is(
    .feed_wall--no-islands, .page_block,
    ._playlist_page_content_block, .faq_search_form,
    .stories_feed_wrap, .posting_feed_wrap,
    .PostingReactBlock__root .vkui__root > *
  ) { margin: 0 !important; }

  /* ── 3. Сброс border-radius и box-shadow ─────────────────────────── */
  :is(
    .page_block, .PageBlock, .page_block_cell,
    .ReplyBoxDonut, .ShortVideoPost,
    #page_layout .CatalogBlock--divided,
    #page_layout .audio_section,
    .faq_search_form,
    .vkuiGroup__modeCard
  ),
  :is(.theme .redesigned-group-cover, .redesigned-group-info)::before,
  .redesigned-group-cover::after {
    border-radius: 0 !important;
    box-shadow: none !important;
  }

  /* ── 4. Тонкие разделители между соседними блоками ──────────────── */
  .page_block + .page_block,
  .wall_item + .wall_item,
  ._post + ._post,
  .feed_row + .feed_row,
  section.vkuiGroup__host + section.vkuiGroup__host {
    border-top: 1px solid var(
      --vkui--color_separator_primary,
      var(--separator_common, rgba(0, 0, 0, .1))
    ) !important;
  }

  /* ── 5. Убираем gap у flex/grid-контейнеров фида (новый VK) ──────── */
  #feed_rows,
  .feed_rows_wrap,
  div[class*="FeedLayout__feed"],
  div[class*="FeedLayout__content"] {
    gap: 0 !important;
    row-gap: 0 !important;
  }

  /* ── 6. Скрываем VKUI-спейсеры и разделители ────────────────────── */
  #spa_root .vkui__root > :first-child[class*="Spacing"],
  .vkuiInternalTwoColumnLayoutColumn + .vkuiInternalTwoColumnLayoutColumn
    > div > [class*="Spacing"],
  .ProfileGroupSkeleton::after,
  div[class*="Spacing"]:has(+ .vkuiGroup__modeCard, + .ProfileHeader),
  .ProfileHeader + div[class*="Spacing"],
  .vkuiGroup__separatorSibling {
    display: none !important;
  }

  /* ── 7. Стена (Wall) — сброс margin у постов ─────────────────────── */
  .wall_module :is(
    .wall_posts > .wall_archive_link_block ~ .page_block,
    .page_wall_posts .page_block ~ .page_block,
    .page_wall_posts
      .page_block:not(.unshown) ~ .page_block.unshown + .page_block:not(.unshown),
    .wall_posts.all > .all ~ .all,
    .wall_posts.all > .post:not(.unshown) ~ .post.unshown + .post:not(.unshown),
    .wall_posts.all > .all ~ .all_ads_promoted_post,
    .wall_posts.own > .own ~ .own,
    .wall_posts.own > .post:not(.unshown) ~ .post.unshown + .post:not(.unshown),
    .wall_posts.own > .own ~ .own_ads_promoted_post,
    .wall_posts.postponed > .postponed ~ .postponed,
    .wall_posts.suggested > .suggest ~ .suggest,
    .wall_posts_search > .post ~ .post
  ) {
    margin-top:    0 !important;
    margin-bottom: 0 !important;
  }

  /* ── 8. Профиль ──────────────────────────────────────────────────── */
  .Profile .RedesignedPageBlockContainer,
  #page_layout .CatalogBlock--divided:not(:first-child),
  .im-page_classic #im_dialogs { margin-top: 0; }

  .Profile .WallLegacy        { padding-top: 0 !important; margin-top: 0 !important; }
  .Profile .ScrollStickyWrapper { margin-left: 0 !important; margin-right: 0 !important; flex-grow: 0; }

  :is(
    .Profile .ScrollStickyWrapper > [style*="top: 64px"],
    .vkuiInternalTwoColumnLayoutColumn
      + .vkuiInternalTwoColumnLayoutColumn > div[style*="top: 64px"]
  ) { top: var(--header-height, 48px) !important; }

  /* Правый нижний скруглённый угол у последних карточек */
  :is(
    .Profile .ScrollStickyWrapper .vkuiGroup__modeCard:last-of-type,
    .im-page:not(.im-page_group) + .im-right-menu .ui_rmenu,
    .RightMenuBlock,
    .vkuiInternalTwoColumnLayoutColumn
      + .vkuiInternalTwoColumnLayoutColumn > div > .vkuiGroup__modeCard:last-of-type,
    .VKCOMMessenger__reforgedRightColumn .vkuiGroup__modeCard,
    .wide_column_left :is(
      .narrow_column > :last-child > :last-child .vkuiGroup__modeCard,
      .narrow_column > :last-child .page_block:last-child,
      .narrow_column > .page_block:last-child
    )
  ) { border-radius: 0 0 20px 0 !important; }

  /* Псевдоэлемент для угловой заплатки */
  :is(
    .vkuiInternalTwoColumnLayoutColumn
      + .vkuiInternalTwoColumnLayoutColumn > div,
    .Profile .ScrollStickyWrapper > div,
    .im-right-menu,
    .wide_column_left .narrow_column
  )::before {
    content: '';
    position: absolute;
    bottom: -20px; left: 0;
    width: 20px; height: 20px;
    background: var(--nsRightCorner);
  }

  /* ── 9. Двухколоночный лейаут ────────────────────────────────────── */
  .vkuiInternalTwoColumnLayoutColumn
    + .vkuiInternalTwoColumnLayoutColumn { margin-left: 0 !important; }

  .wide_column_right .wide_column_wrap { margin-left:  var(--narrow-column-width); }
  .wide_column_left  .wide_column_wrap { margin-right: var(--narrow-column-width); }

  /* ── 10. Мессенджер ──────────────────────────────────────────────── */
  :is(.im-page, .VKCOMMessenger__reforgedRoot) {
    margin: 0; padding: 0;
    height: calc(100vh - var(--header-height, 48px));
  }
  .im-right-menu { margin-left: var(--im-right-menu-width, 550px); }

  :is(
    #page_header, #page_layout,
    .im-page_classic :is(
      .im-group-online, .im-page--header, .im-page--chat-header
    )
  ) { padding: 0 !important; }

  /* ── 11. Клипсы / Shorts ─────────────────────────────────────────── */
  .vkuiInternalTwoColumnLayoutColumn:has(div[class*="ClipsCarousel__root"]) {
    background: var(--n15e);
    backdrop-filter: var(--blb);
  }
  div[class*="FeedLayout__rightWrapper"] {
    padding-top: 0;
    height: calc(100vh - var(--header-height, 48px));
  }
  div[class*="ClipsCarousel__startGapItemWrapper"] { align-items: flex-start; }

  /* ── 12. Прочее ──────────────────────────────────────────────────── */
  .VKCOMSettingsContent     { width: auto; }
  .feed_reposts_more_link   { margin: 0; width: 100%; border-radius: 0; }
`;

export function createCompactSpacingFeature(manager: FeatureManager): FeatureMap {
  return {
    compact_spacing: {
      reapplyOnNavigate: true,
      enable: () => manager.injectCSS(CSS_ID, CSS),
      disable: () => manager.removeCSS(CSS_ID),
    },
  };
}