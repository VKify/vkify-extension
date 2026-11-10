export const AVATAR_ROUNDING_CSS = `
/* Avatar rounding. Only match avatar components or identified avatar slots. */
/* VKit uses an image, a tint layer and an outline inside the avatar surface. */
:is(
  [data-testid="post-header-avatar"],
  [data-testid="comment-avatar"],
  [data-testid="notification-avatar"],
  [data-testid="clips-author-avatar"],
  [data-testid="video_card_author"],
  [data-testid="MusicPlaylistItem_AuthorLink"],
  [data-testid="links-cell-avatar"],
  [data-testid="profile-avatar"],
  [id^="community_avatar_"],
  [data-testid="header-profile-menu-button"],
  [data-testid="groups-recommendation-block-rec-card-avatar"],
  [data-testid="group_item_list"],
  [data-testid="group_item_slider"],
  [data-testid="group_item_desktop_list"],
  #spa_layout_content [data-testid="list"] > div > a[aria-label] > div > a:is([href*="?from=groups"], [href*="&from=groups"]),
  [data-testid="userrichcell-avatar"],
  [data-testid="calls_main_page_call_friends_item"],
  [data-testid="calls_call_friends_page_item_avatar"],
  [data-testid="calls_history_list_item_avatar"],
  [data-testid^="followers-modal-user-cell-"],
  [data-testid="profile-friends-list"],
  [data-testid="profile-subscriptions-block"],
  section:has(a[href="/friends?act=find"]),
  [data-testid="leftmenuitem"] > a[href^="/"]:not([href^="//"]),
  [data-testid="header-profile-menu"] > a,
  [data-testid="subscriptions-modal"] [data-testid="grid-item"],
  section:has([data-testid="group-followers"]) [data-testid="grid"]
) {
  &:has(> img:first-child),
  & :has(> img:first-child ~ div[aria-hidden="true"]) {
    border-radius: var(--vkify-avatar-radius) !important;

    > :is(img:first-child, img:first-child + div, div[aria-hidden="true"]) {
      border-radius: var(--vkify-avatar-radius) !important;
    }
  }
}

/* The account menu uses a separate rich avatar shared across VK surfaces. */
[style*="--avatar-rich-stroke-width:"]:has(> div > img:first-child),
[style*="--avatar-rich-stroke-width:"] > div:has(> img:first-child),
[style*="--avatar-rich-stroke-width:"] > div > :is(img:first-child, img:first-child ~ div[aria-hidden="true"]),
[data-testid="video_card_author"] > :has(> img:first-child),
[data-testid="video_card_author"] > :has(> img:first-child) > img:first-child {
  border-radius: var(--vkify-avatar-radius) !important;
}

/* Contacts use tappable rows in the community sidebar and its dialog. */
:is(
  div:has(> section[data-testid="rightmenu"]) > section:has(> div[role="button"]),
  [data-testid="modalbox"][role="dialog"]
) a.vkuiInternalTappable > div > div:has(> img:first-child + div[aria-hidden="true"]) {
  border-radius: var(--vkify-avatar-radius) !important;

  > :is(img, div[aria-hidden="true"]) {
    border-radius: var(--vkify-avatar-radius) !important;
  }
}

:is(
  [data-testid="profile-avatar"],
  div:has(> [data-testid="profile-avatar"]),
  img[elementtiming="HET_profile_avatar"],
  .vkitInternalRichAvatar,
  .vkuiAvatar__host,
  .Avatar__wrapper,
  .Avatar__img,
  .BasicAvatar,
  .BasicAvatar__noImg,
  .TopNavBtn__profileImg,
  .ImUserAvatar,
  .MEAvatar,
  .ConvoRecommendList__avatar,
  .ConversationNoPhoto,
  .EmptyDialogStub__avatar img,
  .ChatSettingsInfo__photoSelf,
  .ChatSettingsInfo__photoGrid,
  .mail_box_single_ava_img,
  .friends_photo_img,
  .group_row_img,
  .group_friends_image,
  .group_box_image,
  .group_l_photo_img,
  .feedback_group_photo_img,
  .post_img,
  .post_field_user_image,
  .copy_post_img,
  .reply_img,
  .like_tt_image,
  .mention_tt_person_img,
  .notification__media.circle,
  .notifier_image,
  .MusicOwnerCell__avatar,
  .VideoHeader__avatar,
  .OwnerChooser__itemAvatar,
  .MetaStoryItemPreview__author
),
:is(.vkitInternalRichAvatar, .vkuiAvatar__host) > :is(img, div[aria-hidden="true"]),
.MEAvatar__imgWrapper :is(.ReImage, .ReImage__img) {
  border-radius: var(--vkify-avatar-radius) !important;
}

/* Keep VK's native story ring, including seen and unseen colors. */
[data-testid="story_card_stories"] :has(> img:first-child ~ div > [data-testid^="richavatar-outline-"]) {
  border-radius: var(--vkify-avatar-radius) !important;

  > :is(img:first-child, img:first-child + div, div[aria-hidden="true"]) {
    border-radius: var(--vkify-avatar-radius) !important;
  }
}

[data-testid^="richavatar-outline-"],
:has(> [data-testid^="richavatar-outline-"]),
:has(> [data-testid^="richavatar-outline-"])::before,
.vkuiAvatar__host .stOutline__root,
:is(.MetaStoryItemPreview__author, .post_image_stories_unseen, .reply_image_stories_unseen, .right_list_photo_stories_unseen)::after {
  border-radius: var(--vkify-avatar-radius) !important;
}

/* SVG masks need their own geometry instead of border-radius on the image. */
.MEAvatar__imgWrapper,
[data-testid="group-friends-followers"] svg > g[clip-path^="url(#UsersStackMask"]:has(> image) {
  clip-path: inset(0 round var(--vkify-avatar-radius)) !important;
}
`;
