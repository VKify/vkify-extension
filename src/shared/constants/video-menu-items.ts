/** Native sidebar order, including separators anchored to the following stable item. */
export const VIDEO_MENU_IDS: readonly string[] = [
  "main_menu_vk_live",
  "main_menu_trends",
  "main_menu_popular_trends",
  "main_menu_clips",
  "sep_video_personal",
  "main_menu_my_history",
  "main_menu_my_bookmarks",
  "main_menu_my_liked",
  "main_menu_my_playlists",
  "main_menu_authors_cabinet",
  "sep_video_categories",
  "main_menu_for_kids",
  "main_menu_movie",
  "main_menu_musical",
  "main_menu_tvshow",
  "main_menu_sport",
  "main_menu_serial",
  "main_menu_lives",
  "main_menu_cybersport",
  "main_menu_family_values",
  "main_menu_section_toggle",
  "sep_video_subscriptions",
  "main_menu_subscribes",
  "main_menu_video_subscriptions_select",
  "main_menu_authors_list",
  "sep_video_tv",
  "main_menu_tv_install",
  "sep_video_info",
  "main-menu-content-info",
  "main_menu_legal_info"
];

export interface VideoMenuItem {
  readonly id: string;
  readonly name: string;
  readonly group: string;
  readonly selector: string;
  readonly before?: string;
}
export const VIDEO_MENU_ITEMS: readonly VideoMenuItem[] = [
  {
    "id": "main_menu_vk_live",
    "name": "streams",
    "group": "main",
    "selector": "[data-testid=\"main_menu_vk_live\"]"
  },
  {
    "id": "main_menu_trends",
    "name": "home",
    "group": "main",
    "selector": "[data-testid=\"main_menu_trends\"]"
  },
  {
    "id": "main_menu_popular_trends",
    "name": "trends",
    "group": "main",
    "selector": "[data-testid=\"main_menu_popular_trends\"]"
  },
  {
    "id": "main_menu_clips",
    "name": "clips",
    "group": "main",
    "selector": "[data-testid=\"main_menu_clips\"]"
  },
  {
    "id": "sep_video_personal",
    "name": "separator",
    "group": "separator",
    "selector": "hr",
    "before": "main_menu_my_history"
  },
  {
    "id": "main_menu_my_history",
    "name": "history",
    "group": "personal",
    "selector": "[data-testid=\"main_menu_my_history\"]"
  },
  {
    "id": "main_menu_my_bookmarks",
    "name": "later",
    "group": "personal",
    "selector": "[data-testid=\"main_menu_my_bookmarks\"]"
  },
  {
    "id": "main_menu_my_liked",
    "name": "liked",
    "group": "personal",
    "selector": "[data-testid=\"main_menu_my_liked\"]"
  },
  {
    "id": "main_menu_my_playlists",
    "name": "playlists",
    "group": "personal",
    "selector": "[data-testid=\"main_menu_my_playlists\"]"
  },
  {
    "id": "main_menu_authors_cabinet",
    "name": "studio",
    "group": "personal",
    "selector": "[data-testid=\"main_menu_authors_cabinet\"]"
  },
  {
    "id": "sep_video_categories",
    "name": "separator",
    "group": "separator",
    "selector": "hr",
    "before": "main_menu_for_kids"
  },
  {
    "id": "main_menu_for_kids",
    "name": "kids",
    "group": "categories",
    "selector": "[data-testid=\"main_menu_for_kids\"]"
  },
  {
    "id": "main_menu_movie",
    "name": "movies",
    "group": "categories",
    "selector": "[data-testid=\"main_menu_movie\"]"
  },
  {
    "id": "main_menu_musical",
    "name": "music",
    "group": "categories",
    "selector": "[data-testid=\"main_menu_musical\"]"
  },
  {
    "id": "main_menu_tvshow",
    "name": "shows",
    "group": "categories",
    "selector": "[data-testid=\"main_menu_tvshow\"]"
  },
  {
    "id": "main_menu_sport",
    "name": "sport",
    "group": "categories",
    "selector": "[data-testid=\"main_menu_sport\"]"
  },
  {
    "id": "main_menu_serial",
    "name": "series",
    "group": "categories",
    "selector": "[data-testid=\"main_menu_serial\"]"
  },
  {
    "id": "main_menu_lives",
    "name": "broadcasts",
    "group": "categories",
    "selector": "[data-testid=\"main_menu_lives\"]"
  },
  {
    "id": "main_menu_cybersport",
    "name": "gaming",
    "group": "categories",
    "selector": "[data-testid=\"main_menu_cybersport\"]"
  },
  {
    "id": "main_menu_family_values",
    "name": "family",
    "group": "categories",
    "selector": "[data-testid=\"main_menu_family_values\"]"
  },
  {
    "id": "main_menu_section_toggle",
    "name": "expand_categories",
    "group": "categories",
    "selector": "[data-testid=\"main_menu_section_toggle\"]"
  },
  {
    "id": "sep_video_subscriptions",
    "name": "separator",
    "group": "separator",
    "selector": "hr",
    "before": "main_menu_subscribes"
  },
  {
    "id": "main_menu_subscribes",
    "name": "subscriptions",
    "group": "personal",
    "selector": "[data-testid=\"main_menu_subscribes\"]"
  },
  {
    "id": "main_menu_video_subscriptions_select",
    "name": "manage_authors",
    "group": "personal",
    "selector": "[data-testid=\"main_menu_video_subscriptions_select\"]"
  },
  {
    "id": "main_menu_authors_list",
    "name": "authors",
    "group": "personal",
    "selector": "[data-testid^=\"main_menu_block_\"]"
  },
  {
    "id": "sep_video_tv",
    "name": "separator",
    "group": "separator",
    "selector": "hr",
    "before": "main_menu_tv_install"
  },
  {
    "id": "main_menu_tv_install",
    "name": "tv_install",
    "group": "extra",
    "selector": "a[href=\"https://vkvideo.ru/landings/tv_instructions/index.html\"]"
  },
  {
    "id": "sep_video_info",
    "name": "separator",
    "group": "separator",
    "selector": "hr",
    "before": "main-menu-content-info"
  },
  {
    "id": "main-menu-content-info",
    "name": "content_info",
    "group": "extra",
    "selector": "[data-testid=\"main-menu-content-info\"]"
  },
  {
    "id": "main_menu_legal_info",
    "name": "documents",
    "group": "extra",
    "selector": "[data-testid=\"main_menu_legal_info\"]"
  }
];

export function isVideoMenuSelection(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= VIDEO_MENU_IDS.length
    && new Set(value).size === value.length && value.every(id => VIDEO_MENU_IDS.includes(id));
}

export function normalizeVideoMenuOrder(value: unknown): string[] {
  const saved = Array.isArray(value) ? [...new Set(value.filter(id => VIDEO_MENU_IDS.includes(id)))] : [];
  return [...saved, ...VIDEO_MENU_IDS.filter(id => !saved.includes(id))];
}
