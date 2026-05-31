
export interface VKUserRaw {
  id: number;
  first_name: string;
  last_name: string;
  photo_50?: string;
  photo_100?: string;
  photo_200?: string;
  online?: 0 | 1;
  online_mobile?: number;
  online_app?: number;
  last_seen?: { time: number; platform: number };
  city?: { id: number; title: string };
  status?: string;
  followers_count?: number;
  bdate?: string;
  // Возвращается при users.get(fields=counters). Может отсутствовать, если
  // приватность профиля не разрешает показ счётчиков.
  counters?: {
    friends?: number;
    followers?: number;
    photos?: number;
    [key: string]: number | undefined;
  };
}

export interface VKUser {
  id: number;
  firstName: string;
  lastName: string;
  name: string;
  photo50: string | null;
  photo100: string | null;
  photo200: string | null;
  online: boolean;
  lastSeen: { time: number; platform: number } | null;
  city: string | null;
  status: string | null;
  followersCount: number | null;
  bdate: string | null;
}

export interface VKFriendsResponse {
  count: number;
  items: VKUserRaw[];
}

export interface VKConversationsResponse {
  count: number;
  items: unknown[];
}


export const TokenStatus = {
  VALID:     'valid',
  EXPIRED:   'expired',
  NO_TOKEN:  'no_token',
  NO_VK_TAB: 'no_vk_tab',
} as const;

export type TokenStatusValue = typeof TokenStatus[keyof typeof TokenStatus];

export interface TokenData {
  token: string | null;
  userId: string | null;
  expiresAt: number | null;
  status: TokenStatusValue;
}


export interface ExtensionSettings {
  // Appearance
  custom_theme?: string;
  custom_accent?: string;
  block_opacity?: number;
  glass_blur?: number;
  theme_radius?: number;
  custom_font_id?: string;
  custom_font_value?: string;
  custom_font_size?: number;
  custom_line_height?: number;
  custom_letter_spacing?: number;
  custom_font_weight?: number;
  custom_font_style?: string;
  custom_text_decoration?: string;
  custom_text_transform?: string;
  border_radius?: number;
  content_width?: number;
  content_width_enabled?: boolean;
  compact_spacing?: boolean;
  page_offset_enabled?: boolean;
  page_offset_value?: number;   // 0–100: 0=max-left, 50=center, 100=max-right
  // Background
  custom_background?: string;
  background_type?: 'image' | 'video' | 'embed' | 'web';
  background_blur?: number;
  background_dim?: number;
  background_opacity?: number;
  background_brightness?: number;
  background_contrast?: number;
  background_saturation?: number;
  background_scale?: number;
  background_hue_rotate?: number;
  background_sepia?: number;
  background_grayscale?: number;
  background_position?: string;
  background_size?: string;
  background_overlay_color?: string;
  background_overlay_opacity?: number;
  background_vignette?: number;
  background_video_speed?: number;
  background_video_volume?: number;
  // Filters
  filter_grayscale?: boolean;
  filter_sepia?: boolean;
  filter_invert?: boolean;
  filter_dim_images?: boolean;
  filter_high_contrast?: boolean;
  filter_low_brightness?: boolean;
  // Layout
  hide_sidebar?: boolean;
  hide_header?: boolean;
  hide_stories?: boolean;
  hide_recommendations?: boolean;
  hide_friends_suggestions?: boolean;
  hide_music?: boolean;
  hide_games?: boolean;
  // Ads
  block_left_ads?: boolean;
  block_feed_ads_api?: boolean;
  block_feed_ads_dom?: boolean;
  block_trackers?: boolean;
  // Privacy
  prevent_typing?: boolean;
  prevent_read?: boolean;
  hide_dialogs_hotkey?: boolean;
  skeleton_mode?: boolean;
  blur_on_unfocus?: boolean;
  hidden_dialogs?: HiddenDialog[];
  // Message encryption
  message_crypto?: boolean;
  message_crypto_format?: 'COFFEE' | 'VKify';
  message_crypto_key?: string;
  message_crypto_coffee_marker?: 'PP' | 'VK COFFEE' | 'II' | 'AP IDOG';
  // Automation
  auto_add_friends?: boolean;
  bypass_away_links?: boolean;
  keyboard_layout_switch?: boolean;
  keyboard_layout_hotkey?: HotkeyCombo;
  // Hide dialogs hotkey combo (separate from the enable toggle hide_dialogs_hotkey)
  hide_dialogs_hotkey_combo?: HotkeyCombo;
  // Media
  media_player_hotkeys?: boolean;
  video_download?: boolean;
  story_download?: boolean;
  clip_download?: boolean;
  photo_download?: boolean;
  media_hotkey_play_pause?: HotkeyCombo;
  media_hotkey_next?: HotkeyCombo;
  media_hotkey_prev?: HotkeyCombo;
  media_hotkey_seek_forward?: HotkeyCombo;
  media_hotkey_seek_backward?: HotkeyCombo;
  media_hotkey_rate_up?: HotkeyCombo;
  media_hotkey_rate_down?: HotkeyCombo;
  media_hotkey_rate_reset?: HotkeyCombo;
  // Spy (online) — independent tracked-users list, owned by the background
  // online-monitor (spy-tracker.ts). Separate from the activity list below.
  spy_online?: boolean;
  spy_online_interval?: number;
  spy_browser_notify?: boolean;
  spy_save_log?: boolean;
  online_tracked_users?: TrackedUser[];
  // Spy (activity) — independent tracked-users list, owned by the injected
  // message-activity spy (content spy/index.ts), used only in 'selected' mode.
  spy_tracked_users?: TrackedUser[];
  spy_enabled?: boolean;

  // Message templates — быстрые ответы в IM VK с переменными (%first_name% и т.п.).
  // Список редактируется во вкладке «Шаблоны» попапа.
  message_templates_enabled?: boolean;
  message_templates_trigger_slash?: boolean;       // открывать пикер при наборе «/» в начале строки
  message_templates_trigger_hotkey?: boolean;      // открывать пикер по горячей клавише
  message_templates_hotkey?: HotkeyCombo;          // сама клавиша для триггера
  message_templates_trigger_autocomplete?: boolean;// автоподсказка по мере набора (префиксный матч)
  message_templates_auto_send?: boolean;           // отправлять сообщение сразу после выбора шаблона
  message_templates?: MessageTemplate[];
  // Быстрое копирование текста сообщения по кнопке рядом с действиями ВК.
  message_quick_copy?: boolean;
  // Экспорт диалога в файл (JSON/TXT/HTML) — кнопка в шапке чата.
  dialog_export_enabled?: boolean;
  // Закрепление сообщения как локальной заметки (см. PinnedNote).
  message_pin_notes?: boolean;

  // Spy (profile) — independent tracked-users list, owned by the background
  // ProfileTracker. Polls users.get and detects avatar/status/friends changes.
  profile_spy?: boolean;
  profile_spy_interval?: number;
  profile_spy_avatar?: boolean;
  profile_spy_status?: boolean;
  profile_spy_friends?: boolean;
  profile_spy_browser_notify?: boolean;
  profile_spy_save_log?: boolean;
  profile_tracked_users?: TrackedUser[];
  spy_typing?: boolean;
  spy_voice?: boolean;
  spy_uploads?: boolean;        // LongPoll 65/66/67 — загрузка фото/видео/файла
  spy_read?: boolean;
  spy_delete?: boolean;
  spy_friends?: boolean;
  spy_chat_events?: boolean;    // LongPoll 52 — события беседы (вход/выход/исключение)
  spy_invisibility?: boolean;   // LongPoll 81 — изменение состояния невидимки
  spy_mode?: 'all' | 'selected';
  // CSS
  custom_css?: string;
  custom_css_enabled?: boolean;
  // Extension
  extension_theme?: 'light' | 'dark' | 'auto';
  first_run?: boolean;
  // Token
  vk_access_token?: string;
  vk_user_id?: string;
  vk_token_expires_at?: number;
  // Stats
  stats_trackers_blocked?: number;
  stats_ads_blocked?: number;
  stats_block_log?: StatsLogEntry[];
  // Custom keywords
  custom_block_words?: string[];
  custom_allow_words?: string[];
  // Internal
  onboarding_done?: boolean;
  pending_update_version?: string;
  online_spy_stats?: SpyStats;
  user_online_status?: Record<string, UserOnlineStatus>;
  online_spy_log?: SpyLogEntry[];
  activity_spy_log?: ActivityLogEntry[];
  [key: string]: unknown;
}


export interface HotkeyCombo {
  ctrlKey:  boolean;
  shiftKey: boolean;
  altKey:   boolean;
  code:     string;   // KeyboardEvent.code, e.g. 'KeyQ', 'F5'
  label:    string;   // Human-readable, e.g. 'Ctrl+Q', precomputed for display
}


export interface HiddenDialog {
  id: string;
  name: string;
  photo?: string;
}


export interface TrackedUser {
  id: string;
  name: string;
  photo?: string;
  addedAt?: number;
}

export interface SpyStats {
  checks: number;
  isRunning: boolean;
}

export interface UserOnlineStatus {
  online: boolean;
  lastSeen: number | null;
  platform: number | null;
  lastChecked: number;
}

export interface SpyLogEntry {
  userId: string;
  userName: string;
  action: string;
  icon: string;
  timestamp: number;
  userInfo?: { photo50?: string };
}

// Шаблон сообщения. text может содержать переменные %first_name% / %last_name% /
// %my_first_name% / %my_last_name% / %title% / %peer_id% / %time% / %date% / %br%.
export interface MessageTemplate {
  id: string;
  name: string;
  text: string;
  addedAt?: number;
}

/**
 * Закреплённая заметка: пользователь нажал «pin» рядом с сообщением, и
 * расширение сохранило его в локальном архиве. Авторитативного backend'а
 * нет — это чисто локальное хранилище для своих заметок поверх VK.
 */
export interface PinnedNote {
  id: string;
  text: string;
  /** Имя автора сообщения (из DOM, может быть пустым). */
  author?: string;
  /** Время отправки оригинала из DOM (HH:MM или строка из data-title). */
  origTime?: string;
  /** peer_id чата на момент закрепления (для будущей навигации). */
  peerId?: number;
  /** Заголовок чата на момент закрепления. */
  peerTitle?: string;
  /** Unix-ms — когда пользователь закрепил эту заметку. */
  addedAt: number;
}

// ProfileTracker — снимок отслеживаемых полей профиля и журнал изменений.
export interface UserProfileSnapshot {
  photoUrl: string | null;     // photo_100 — меняется при загрузке нового аватара
  status: string | null;       // текст статуса (поле `status` из users.get)
  friendsCount: number | null; // counters.friends — может быть скрыт настройками
  lastChecked: number;
}

export interface ProfileSpyLogEntry {
  userId: string;
  userName: string;
  // Что изменилось: avatar | status | friends_added | friends_removed.
  changeType: 'avatar' | 'status' | 'friends_added' | 'friends_removed';
  // Человекочитаемое описание ("сменил статус на …", "+3 друга", …)
  description: string;
  icon: string;
  timestamp: number;
  userInfo?: { photo50?: string };
  // Опциональные сырые данные изменения для UI (старое/новое значение, delta).
  before?: string | number | null;
  after?: string | number | null;
}

export interface ActivityLogEntry {
  userId: string;
  timestamp: number;
  online: boolean;
  platform: number | null;
}

export interface ActivityDataEntry {
  timestamp: number;
  online: boolean;
  platform: number | null;
}

export interface StatsLogEntry {
  kind: 'tracker' | 'ad';
  domain: string;
  time: number;
  detail?: string;
  method?: 'dom' | 'api';
  /** Short human-readable reason for the block (shown highlighted in the popup log). */
  trigger?: string;
  /**
   * Compact JSON snapshot of the API-blocked feed item.
   * Only set when method === 'api'. Used to render the raw post data
   * in the popup log expanded view.
   */
  payload?: string;
}


export type ExtensionMessage =
  | { type: 'GET_SETTINGS' }
  | { type: 'VK_TOKEN_UPDATE'; token?: string; userId?: string; expiresAt?: number }
  | { type: 'GET_VK_TOKEN' }
  | { type: 'CHECK_VK_TABS' }
  // Popup/embed → background resolves the active VK tab's API method (the embed
  // iframe has no chrome.tabs of its own — see useApiMethod).
  | { type: 'GET_API_METHOD' }
  // Tab operations routed through background so they work in the Firefox embed
  // iframe too (a web-content-framed extension page has no chrome.tabs).
  | { type: 'OPEN_TAB'; url: string }
  | { type: 'RELOAD_VK_TABS' }
  | { type: 'RELOAD_ACTIVE_VK_TAB' }
  | { type: 'QUERY_VK_TABS'; urlPattern?: string }
  // Diagnostics: liveness ping + Firefox optional host-permission status.
  | { type: 'PING' }
  | { type: 'VK_API_CALL'; method: string; params: Record<string, unknown> }
  | { type: 'STORAGE_CHANGED'; key: string; value: unknown }
  | { type: 'ENABLE_FEATURE'; featureId: string; value?: unknown }
  | { type: 'DISABLE_FEATURE'; featureId: string }
  | { type: 'RELOAD_FEATURES' }
  | { type: 'GET_ONLINE_STATS' }
  | { type: 'START_ONLINE_SPY' }
  | { type: 'STOP_ONLINE_SPY' }
  | { type: 'GET_USER_ACTIVITY'; userId: string }
  | { type: 'GET_SPY_LOG' }
  | { type: 'CLEAR_SPY_LOG' }
  | { type: 'START_PROFILE_SPY' }
  | { type: 'STOP_PROFILE_SPY' }
  | { type: 'GET_PROFILE_SPY_LOG' }
  | { type: 'CLEAR_PROFILE_SPY_LOG' }
  | { type: 'GET_PROFILE_SPY_STATS' }
  | { type: 'APPLY_SHARED_THEME'; encoded: string }
  | { type: 'CLEAN_URL'; url: string }
  | { type: 'REQUEST_FRESH_TOKEN' }
  | { type: 'GET_API_METHOD_INFO' }
  // Activity spy → background shows a system notification via chrome.notifications.
  | { type: 'SHOW_NOTIFICATION'; title: string; message: string; notifId?: string }
  // Global Chrome-commands hotkey → background → all VK tabs → injected player.
  | { type: 'PLAYER_ACTION'; action: string }
  // Video download — content script requests background to start chrome.downloads.download().
  | { type: 'DOWNLOAD_VIDEO'; url: string; filename: string };

export type MessageType = ExtensionMessage['type'];

// Named aliases for convenience where a single variant is needed
export type TokenUpdateMessage  = Extract<ExtensionMessage, { type: 'VK_TOKEN_UPDATE' }>;
export type ApiCallMessage      = Extract<ExtensionMessage, { type: 'VK_API_CALL' }>;
export type EnableFeatureMessage  = Extract<ExtensionMessage, { type: 'ENABLE_FEATURE' }>;
export type DisableFeatureMessage = Extract<ExtensionMessage, { type: 'DISABLE_FEATURE' }>;


export interface FeatureHandler {
  enable: (value?: unknown) => void | Promise<void>;
  disable: () => void | Promise<void>;
  reapplyOnNavigate?: boolean;
  /**
   * Если задан — NavigationService активирует фичу только на совпадающих pathname.
   * Позволяет не хардкодить URL-проверки в NavigationService.
   */
  matchPath?: (pathname: string) => boolean;
}

export type FeatureMap = Record<string, FeatureHandler>;


export interface EmbedData {
  platform: 'youtube' | 'vk' | 'vimeo' | 'rutube' | 'twitch' | 'dailymotion' | 'coub';
  embedUrl: string;
  type: string;
  attributes?: Record<string, string | boolean>;
}

export interface RutubeController {
  play: () => void;
  pause: () => void;
  mute: () => void;
  unmute: () => void;
  setVolume: (vol: number) => void;
  seekTo: (time: number) => void;
  destroy: () => void;
}


export interface ThemePalette {
  n15: string; n15Solid: string;
  n22: string; n22Solid: string; n22Alpha: string;
  n29: string; n29Solid: string; n29Alpha: string;
  n33: string; n33Alpha: string;
  n44: string; n77: string; n99: string;
  ccc: string; eee: string;
  black: string; white: string;
  blackAlpha8: string; blackAlpha12: string; blackAlpha24: string;
  blackAlpha36: string; blackAlpha48: string; blackAlpha56: string; blackAlpha72: string;
  whiteAlpha72: string;
  iconSecondaryAlpha: string; iconMediumAlpha: string;
  contrast: string;
  accent: string; accentHover: string;
  g1: string; g2: string; g3: string; g4: string;
  accentAlpha12: string; accentAlpha16: string; accentAlpha20: string;
  accentAlpha24: string; accentAlpha30: string;
  k2: string; k2t: string;
  red: string; redAlpha12: string; redAlpha16: string; redAlpha20: string; redAlpha30: string;
  likeColor: string;
  green: string; greenAlpha20: string; greenAlpha30: string; greenLight: string;
  yellowLight: string; warningAlpha20: string;
  gold200: string; gold250: string; gold400: string; gold500: string;
  lavender100: string; lavender200: string; lavender300: string;
  orange: string; purple: string; violet: string; raspberryPink: string; neonPink: string;
  pinkLight: string;
  blockOpacity: number;
}

export interface AccentPalette {
  accent: string; accentHover: string;
  accentAlpha12: string; accentAlpha24: string; accentAlpha30: string;
}


export interface PopupNotification {
  id: string;
  type: 'warning' | 'info' | 'success';
  icon: string;
  title: string;
  message: string;
  action?: { label: string; url: string };
}