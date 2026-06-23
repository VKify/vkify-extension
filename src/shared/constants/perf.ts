/**
 * Единый источник истины для телеметрии производительности (Performance
 * Dashboard в popup → «Ещё»).
 *
 * Здесь живут: типы снимка метрик (`PerfSnapshot`), который собирает
 * content-скрипт + background и читает popup, а также каталог фич
 * (`PERF_FEATURE_CATALOG`) — человекочитаемые названия и «impact» (light/medium/
 * heavy) по ключу настройки. id фичи в FeatureManager совпадает с ключом
 * настройки, поэтому каталог индексируется ровно этими ключами.
 *
 * Браузер не даёт per-feature CPU API, поэтому «нагрузка» фичи измеряется как
 * execution-time прокси: время в её `enable()` (`initMs`) плюс суммарное время
 * её DOM-колбэков (`runtimeMs`) через `performance.now()`.
 */

export type FeatureImpact = 'light' | 'medium' | 'heavy';

export interface FeatureMeta {
  /** Человекочитаемое название для списка фич. */
  label: string;
  /** Ожидаемое влияние на производительность. */
  impact: FeatureImpact;
}

/** Метрики одной активной фичи в снимке. */
export interface FeaturePerf {
  /** id фичи = ключ настройки. */
  id: string;
  label: string;
  impact: FeatureImpact;
  /** Время, проведённое в `enable()` фичи, мс. */
  initMs: number;
  /** Накопленное время DOM-колбэков фичи (CPU-прокси), мс. */
  runtimeMs: number;
}

/** Разбивка времени загрузки страницы по фазам Navigation Timing, мс. */
export interface PageLoadTiming {
  dns: number;
  connect: number;
  response: number;
  domInteractive: number;
  domComplete: number;
  load: number;
  total: number;
}

/**
 * Метрики со стороны активной VK-вкладки (content-скрипт). `available=false`,
 * если открытой VK-вкладки нет — тогда popup показывает только background/popup
 * метрики и подсказку открыть VK.
 */
export interface PerfContext {
  available: boolean;
  url?: string;
  /** performance.memory — только Chromium; undefined в Firefox. */
  heapUsedBytes?: number;
  heapTotalBytes?: number;
  heapLimitBytes?: number;
  /** Число инжектированных <style> (CssManager). */
  injectedStyles: number;
  /** Суммарный размер инжектированного CSS, байт. */
  injectedCssBytes: number;
  /** Число активных статических CSS-маркеров data-vkify-*. */
  cssMarkers: number;
  /** Число инжектированных page-world скриптов (ScriptInjector). */
  injectedScripts: number;
  /** Число подписок на общий MutationObserver (match + change). */
  observerSubs: number;
  /** Накопленное число флашей общего observer'а (прокси «мутаций»). */
  mutationFlushes: number;
  /** Накопленное число VK API-вызовов. */
  apiCalls: number;
  /** API-вызовов за последние 60 секунд (rate). */
  apiCallsLastMin: number;
  /** Суммарное время инициализации всех фич, мс. */
  initTotalMs: number;
  pageLoad: PageLoadTiming | null;
  features: FeaturePerf[];
}

/** Метрики со стороны service worker'а. */
export interface PerfBackground {
  heapUsedBytes?: number;
  /** Число запланированных chrome.alarms. */
  alarms: number;
  onlineSpyRunning: boolean;
  profileSpyRunning: boolean;
  /** VK API-вызовы из background (спай/профиль-поллеры, запросы попапа). */
  apiCalls: number;
  apiCallsLastMin: number;
}

/** Метрики самого popup-контекста (заполняются в popup после ответа). */
export interface PerfPopup {
  heapUsedBytes?: number;
}

export interface PerfSnapshot {
  collectedAt: number;
  context: PerfContext;
  background: PerfBackground;
  popup: PerfPopup;
}

/**
 * Сохранённая позиция плавающего мини-виджета (PerfWidget). Живёт в настройках
 * под ключом `perfWidgetPosition`, поэтому дашборд может её сбросить (= null).
 */
export interface PerfWidgetPosition {
  left: number;
  top: number;
}

/** Живые метрики, которые PerfWidget показывает в компактном виде. */
export interface PerfWidgetMetrics {
  /** Текущий FPS (rAF-счётчик). */
  fps: number;
  /** Полное время загрузки страницы, мс (Navigation Timing). */
  pageLoadMs: number;
  activeFeatures: number;
  apiCallsLastMin: number;
  mutationFlushes: number;
  heapUsedBytes?: number;
}

/** Пустой context для случая «нет активной VK-вкладки». */
export function emptyPerfContext(): PerfContext {
  return {
    available: false,
    injectedStyles: 0,
    injectedCssBytes: 0,
    cssMarkers: 0,
    injectedScripts: 0,
    observerSubs: 0,
    mutationFlushes: 0,
    apiCalls: 0,
    apiCallsLastMin: 0,
    initTotalMs: 0,
    pageLoad: null,
    features: [],
  };
}

/**
 * Каталог фич: ключ настройки → название + impact. Используется для подписей в
 * списке активных фич, бейджей impact и выбора «тяжёлых» фич для «Reset heavy
 * features». Фичи, которых здесь нет, показываются с дефолтом (см. `getFeatureMeta`).
 *
 * impact назначается по РЕАЛЬНОМУ механизму фичи (не «на глаз»):
 *   • light  — статический CSS-маркер / inject-CSS, разовый DOM-твик или
 *              пассивный keydown/click-слушатель. Стоимость в рантайме ≈ 0
 *              (поэтому у таких фич runtime в дашборде честно показывает 0 мс).
 *   • medium — инжектированный page-скрипт (перехват сети), DOM-обсервер,
 *              точечно добавляющий кнопки, или периодическая задача низкой частоты.
 *   • heavy  — непрерывное сканирование крупного поддерева (лента) обсервером +
 *              интервалом, LongPoll или фоновый поллер VK API.
 *
 * Источник классификации — модуль фичи в src/content/features/* и
 * src/background/services/*; при изменении механизма обнови impact здесь.
 */
export const PERF_FEATURE_CATALOG: Record<string, FeatureMeta> = {
  // ── heavy ──────────────────────────────────────────────────────────────
  // LongPoll-инжект (spy/index → injected SPY).
  spy_enabled:         { label: 'Слежка за сообщениями (LongPoll)', impact: 'heavy' },
  // Фоновый поллер users.get (background/services/profile-tracker).
  profile_spy:         { label: 'Слежка за профилями',              impact: 'heavy' },
  // observeChanges(scanAndBlock) + setInterval по всей ленте (feed-dom.ts).
  block_feed_ads_dom:  { label: 'Блокировка рекламы в ленте (DOM)', impact: 'heavy' },

  // ── medium ─────────────────────────────────────────────────────────────
  // Инжектированный перехватчик fetch (feed-api.ts → AD_FEED_BLOCKER).
  block_feed_ads_api:  { label: 'Блокировка рекламы в ленте (API)', impact: 'medium' },
  // Инжект TRACKER_BLOCKER + setInterval DOM-чистки (trackers.ts).
  block_trackers:      { label: 'Блокировка трекеров',              impact: 'medium' },
  // observer + setInterval в мессенджере (crypto/message-crypto.ts).
  message_crypto:      { label: 'Шифрование сообщений',             impact: 'medium' },
  // Батч API-вызовов при запуске пользователем.
  auto_add_friends:    { label: 'Автодобавление друзей',            impact: 'medium' },
  // observeMatches добавляет кнопку загрузки/экспорта (button-feature / center/*).
  dialog_export_enabled: { label: 'Экспорт диалогов',              impact: 'medium' },
  audio_download:      { label: 'Скачивание музыки',                impact: 'medium' },
  audio_multi_upload:  { label: 'Мультизагрузка музыки',            impact: 'medium' },
  video_download:      { label: 'Скачивание видео',                 impact: 'medium' },
  clip_download:       { label: 'Скачивание клипов',                impact: 'medium' },
  photo_download:      { label: 'Скачивание фото',                  impact: 'medium' },
  story_download:      { label: 'Скачивание историй',               impact: 'medium' },
  message_pin_notes:   { label: 'Закрепление заметок',              impact: 'medium' },
  message_quick_copy:  { label: 'Быстрое копирование сообщений',    impact: 'medium' },

  // ── light ──────────────────────────────────────────────────────────────
  // Статический CSS-маркер (block-left-ads.css) — только data-атрибут на <html>.
  block_left_ads:      { label: 'Блокировка боковой рекламы',       impact: 'light' },
  // Статический CSS (expand-post-text.css → enableCss).
  expand_post_text:    { label: 'Разворачивание текста постов',     impact: 'light' },
  // Статический CSS-маркер.
  compact_spacing:     { label: 'Компактные отступы',               impact: 'light' },
  messenger_swap_panels: { label: 'Зеркальный мессенджер',         impact: 'light' },
  hide_sidebar:        { label: 'Скрыть сайдбар',                   impact: 'light' },
  hide_header:         { label: 'Скрыть шапку',                     impact: 'light' },
  hide_stories:        { label: 'Скрыть истории',                   impact: 'light' },
  hide_audio_ads:      { label: 'Скрыть аудиорекламу',              impact: 'light' },
  // Пассивные слушатели клавиш/кликов — без обсерверов.
  media_player_hotkeys: { label: 'Хоткеи плеера',                   impact: 'light' },
  keyboard_layout_switch: { label: 'Переключение раскладки',       impact: 'light' },
  bypass_away_links:   { label: 'Прямые внешние ссылки',            impact: 'light' },
  message_templates_enabled: { label: 'Шаблоны сообщений',         impact: 'light' },
  // inject-CSS из пользовательского текста — статичен после применения.
  custom_css_enabled:  { label: 'Пользовательский CSS',             impact: 'light' },
  // rAF+интервал, но паузятся на скрытой вкладке — стоимость мизерна.
  perf_widget:         { label: 'Мини-монитор производительности',  impact: 'light' },
};

/** Метаданные фичи с дефолтом для не описанных в каталоге id. */
export function getFeatureMeta(id: string): FeatureMeta {
  return PERF_FEATURE_CATALOG[id] ?? { label: id, impact: 'light' };
}

/** Ключи фич с impact='heavy' — для кнопки «Reset heavy features». */
export function heavyFeatureKeys(): string[] {
  return Object.keys(PERF_FEATURE_CATALOG).filter(
    (key) => PERF_FEATURE_CATALOG[key]?.impact === 'heavy',
  );
}
