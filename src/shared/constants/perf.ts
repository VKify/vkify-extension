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
  /**
   * Фичи, упавшие при активации (handler.enable бросил). Surfacing вместо
   * «молчаливого» проглатывания ошибки — дашборд может показать «N не запустилось».
   */
  featuresFailed?: Array<{ id: string; error: string }>;
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

// ── Сводка реестра фич (FeatureRegistry) ─────────────────────────────────────
//
// Раньше метадата фич (label + impact) жила здесь хардкодом (PERF_FEATURE_CATALOG).
// Теперь единый источник истины — FeatureRegistry в content-скрипте: дашборд
// получает срез его метадаты через GET_FEATURE_REGISTRY_SUMMARY (однократно при
// открытии — поллинг GET_PERF_TELEMETRY остаётся лёгким). См.
// content/core/features/feature-registry.ts.
//
// impact классифицируется по РЕАЛЬНОМУ механизму фичи (задаётся в describeFeatures):
//   • light  — статический CSS-маркер / inject-CSS, разовый DOM-твик или
//              пассивный keydown/click-слушатель (runtime ≈ 0 мс).
//   • medium — инжектированный page-скрипт (перехват сети), DOM-обсервер,
//              точечно добавляющий кнопки, или периодическая задача низкой частоты.
//   • heavy  — непрерывное сканирование крупного поддерева (лента) обсервером +
//              интервалом, LongPoll или фоновый поллер VK API.

/** Одна фича в сводке реестра — чистая метадата (без рантайм-метрик). */
export interface FeatureRegistryEntry {
  id: string;
  name: string;
  /** Категория фичи (FeatureCategory из реестра; в shared — строка). */
  category: string;
  impact: FeatureImpact;
  dependencies: string[];
  initOrder: number;
  requiresDomLayer: boolean;
  enabledByDefault: boolean;
  tags: string[];
}

/**
 * Снимок метадаты всех зарегистрированных фич активной VK-вкладки. Статичен в
 * пределах загрузки страницы (фичи регистрируются один раз), поэтому дашборд
 * запрашивает его один раз при открытии, а не на каждом тике поллинга.
 */
export interface FeatureRegistrySummary {
  available: boolean;
  collectedAt: number;
  total: number;
  features: FeatureRegistryEntry[];
}

/** Пустая сводка для случая «нет активной VK-вкладки». */
export function emptyFeatureRegistrySummary(): FeatureRegistrySummary {
  return { available: false, collectedAt: Date.now(), total: 0, features: [] };
}
