import type { FeatureHandler } from '../../types/index.js';
import type { StorageManager } from './storage.js';
import type { InjectedScriptName } from './injected-scripts.js';
import { CssManager } from './css-manager.js';
import { ScriptInjector } from './script-injector.js';
import { CssMarkerManager } from './css-marker-manager.js';
import { DomSubscriptionRegistry } from './dom-subscriptions.js';
import { ContentTelemetry, type TelemetryProvider } from './content-telemetry.js';
import { shouldEnable } from './should-enable.js';
import { recordInjectedCss, recordRemovedCss, reconcileInjectedCss } from './injected-css-mirror.js';
import { dispatchPageEvent } from '../utils/page-event.js';
import { domObserver as defaultDomObserver, SELECTORS, type Unsubscribe, type Priority, type ChangeOpt, type ResizeOpt } from './dom/index.js';
import { perfCollector as defaultPerfCollector } from './perf/collector.js';
import type { FeatureContext } from './feature-context.js';
import type { SelectorSpec } from '../selectors/types.js';
import {
  FeatureRegistry,
  compileFeatureDefinition,
  type FeatureDefinition,
} from './features/index.js';
import { serviceContainer, SERVICES, EventBus, type ServiceContainer, type ServiceTypeMap, type ContentBusEvents } from './services/index.js';
import { findConflict } from '@/shared/constants/feature-conflicts.js';
import { migrator as defaultMigrator, type Migrator } from '@/shared/storage/Migrator.js';
import { vkApiService as defaultVkApi, type VKApiService } from './api/index.js';

/** Сведения о фиче, упавшей при активации (для surfacing'а в дашборд). */
export interface FailedFeature {
  readonly id: string;
  readonly error: string;
}

/**
 * Внедряемые зависимости менеджера. Все — общие синглтоны по умолчанию; параметр
 * нужен ради DIP и подмены в тестах (раньше менеджер импортировал синглтоны
 * напрямую и дёргал их в обход собственного DI-контейнера).
 */
export interface FeatureManagerDeps {
  perfCollector?: typeof defaultPerfCollector;
  domObserver?: typeof defaultDomObserver;
  vkApi?: VKApiService;
  migrator?: Migrator;
}

export class FeatureManager implements FeatureContext {
  /** Централизованный реестр селекторов — часть FeatureContext. */
  readonly selectors = SELECTORS;

  /** DI-контейнер общих сервисов — часть FeatureContext (см. core/services). */
  readonly services: ServiceContainer = serviceContainer;

  private readonly storage: StorageManager;
  private readonly cssManager = new CssManager();
  private readonly scriptInjector = new ScriptInjector();

  // Внедрённые синглтоны (DIP): храним ссылки, а не импортируем точечно в методах.
  private readonly perf: typeof defaultPerfCollector;
  private readonly observer: typeof defaultDomObserver;
  private readonly vkApiService: VKApiService;
  private readonly migrator: Migrator;

  /** Реестр фич (метадата + обработчики) — источник истины о зарегистрированных фичах. */
  private readonly registry = new FeatureRegistry();
  private readonly activeFeatures = new Set<string>();

  /** Фичи, упавшие на последней попытке активации: id → текст ошибки. */
  private readonly failed = new Map<string, string>();

  // Владелец per-id DOM-подписок (observer + perf-тайминг). Снимаются в disable().
  private readonly domSubs: DomSubscriptionRegistry;

  // Владелец статических CSS-маркеров data-vkify-<id> и их localStorage-зеркала.
  private readonly cssMarkers = new CssMarkerManager();

  /** Узкий провайдер ресурсной телеметрии (для GET_PERF_TELEMETRY). */
  readonly telemetry: TelemetryProvider;

  /** Снятие предыдущего storage.onChange — чтобы init() не накапливал слушателей. */
  private _offStorageChange: (() => void) | null = null;

  constructor(storage: StorageManager, deps: FeatureManagerDeps = {}) {
    this.storage = storage;
    this.perf = deps.perfCollector ?? defaultPerfCollector;
    this.observer = deps.domObserver ?? defaultDomObserver;
    this.vkApiService = deps.vkApi ?? defaultVkApi;
    this.migrator = deps.migrator ?? defaultMigrator;

    this.domSubs = new DomSubscriptionRegistry(this.observer, this.perf);
    this.telemetry = new ContentTelemetry(this.cssManager, this.scriptInjector, this.cssMarkers);

    this.registerCoreServices();
  }

  /**
   * Регистрирует общие сервисы в глобальном контейнере. Идемпотентно
   * (registerValue перетирает) — безопасно при пересоздании менеджера.
   */
  private registerCoreServices(): void {
    serviceContainer
      .registerValue(SERVICES.storage, this.storage)
      .registerValue(SERVICES.cssManager, this.cssManager)
      .registerValue(SERVICES.scriptInjector, this.scriptInjector)
      .registerValue(SERVICES.featureRegistry, this.registry)
      .registerValue(SERVICES.domObserver, this.observer)
      .registerValue(SERVICES.perfCollector, this.perf)
      // Migrator — общий singleton (shared/storage). Прогон миграций инициирует
      // background (он стартует раньше вкладок); здесь регистрируем сервис, чтобы
      // фичи могли получить его через getService(SERVICES.migrator).
      .registerValue(SERVICES.migrator, this.migrator)
      // VK API-сервис — общий singleton (владеет токеном/мостом/очередью).
      // Тот же инстанс получает VKifyApp (setChannelNonce) и фичи (ctx.vkApi).
      .registerValue(SERVICES.vkApi, this.vkApiService)
      // event-bus — lazy: создаётся при первом обращении (emit на enable/disable).
      .registerFactory(SERVICES.eventBus, () => new EventBus<ContentBusEvents>());
  }

  // Прямые getter'ы поверх сервис-контейнера — удобный доступ для фич
  // (ctx.perfCollector.recordApiCall() вместо getService(SERVICES.perfCollector)).
  // Часть контракта FeatureContext.
  get domObserver(): ServiceTypeMap['dom-observer'] {
    return this.observer;
  }

  get perfCollector(): ServiceTypeMap['perf-collector'] {
    return this.perf;
  }

  get eventBus(): EventBus<ContentBusEvents> {
    return serviceContainer.get<EventBus<ContentBusEvents>>(SERVICES.eventBus);
  }

  get featureRegistry(): FeatureRegistry {
    return this.registry;
  }

  get vkApi(): VKApiService {
    return this.vkApiService;
  }

  /**
   * Регистрирует декларативную фичу (см. core/features/feature-definition.ts).
   * Компилирует описание в handler+meta, замыкая жизненный цикл на этот менеджер
   * как FeatureContext. Предпочтительный способ для новых фич.
   */
  registerDefinition(def: FeatureDefinition): void {
    const compiled = compileFeatureDefinition(def, this);
    this.registry.register(compiled.id, compiled.handler, compiled.meta);
  }

  /** Пакетная регистрация декларативных фич. */
  registerDefinitions(defs: readonly FeatureDefinition[]): void {
    for (const def of defs) this.registerDefinition(def);
  }

  getFeatureHandler(id: string): FeatureHandler | undefined {
    return this.registry.getHandler(id);
  }

  hasFeature(id: string): boolean {
    return this.registry.has(id);
  }

  /** Итерирует все зарегистрированные фичи — вместо прямого доступа к Map. */
  forEachFeature(cb: (id: string, handler: FeatureHandler) => void): void {
    this.registry.forEach((d) => cb(d.meta.id, d.handler));
  }

  /** Возвращает ID фич с флагом reapplyOnNavigate для правильного async-перебора. */
  getReapplyFeatureIds(): string[] {
    const ids: string[] = [];
    this.registry.forEach((d) => {
      if (d.handler.reapplyOnNavigate) ids.push(d.meta.id);
    });
    return ids;
  }

  async init(): Promise<void> {
    // Снимаем предыдущий слушатель: каждый вызов init() (напр. через RELOAD_FEATURES)
    // создаёт новый коллбэк — без очистки они накапливались бы и
    // активировали фичу несколько раз при каждом изменении storage.
    this._offStorageChange?.();
    this._offStorageChange = null;

    const settings = await this.storage.getAll();

    // Активируем фичи в порядке, разрешённом реестром (зависимости раньше
    // зависящих, тай-брейк по initOrder), сгруппированном по фазам. Раньше
    // порядок диктовался порядком ключей storage — недетерминированным; теперь
    // он явный, управляемый метадатой (phase + dependencies + initOrder).
    const toEnable = Object.keys(settings).filter(
      (key) => this.registry.has(key) && this.shouldEnable(settings[key]),
    );
    const byPhase = this.registry.resolveByPhase(toEnable);

    // early-css и dom-ready активируем сразу: init() уже вызывается из app.init на
    // DOMContentLoaded, поэтому DOM к этому моменту готов.
    await this.enablePhase(byPhase['early-css'], settings);
    await this.enablePhase(byPhase['dom-ready'], settings);

    // late активируем отложенно — в idle-колбэке, чтобы не задерживать первый
    // интерактив страницы фичами, опирающимися на API/LongPoll/тяжёлые подсистемы.
    this.scheduleLatePhase(byPhase['late']);

    this._offStorageChange = this.storage.onChange((key, value) => {
      if (!this.registry.has(key)) return;

      if (this.shouldEnable(value)) {
        this.enable(key, value);
      } else {
        this.disable(key);
      }
    });

    // The markers/CSS stamped synchronously at document_start came from the
    // (possibly stale) mirrors. Now that storage is the source of truth, drop any
    // that aren't actually active and persist the real set for the next load.
    this.cssMarkers.reconcile();
    reconcileInjectedCss();

    console.log('[VKify] Features active:', this.activeFeatures.size);
  }

  /**
   * Пересобирает активные фичи с флагом `reapplyOnLanguageChange` — при смене
   * языка контента, чтобы их инжектированный UI (кнопки, тултипы, панели)
   * перерисовался на новом языке.
   *
   * Полный `disable()`+`enable()` (не идемпотентный reapply): текстовые кнопки
   * идемпотентно пропускают уже существующие, поэтому нужен именно teardown —
   * он же чисто снимает DOM-подписки. Кнопки исчезают и пересоздаются в пределах
   * микротасок. Долгоживущие панели восстанавливают состояние в enable() из
   * storage (эквалайзер переоткрывает панель), поэтому переживают ре-рендер.
   *
   * Флаг — opt-in ТОЛЬКО у фич с переводимым UI: скрывающие/CSS-фичи не трогаем
   * (текста нет, а их teardown мигнул бы скрытым контентом обратно).
   */
  async reapplyActiveForLanguage(): Promise<void> {
    // Снимок id: enable/disable мутируют activeFeatures, нельзя итерировать по нему.
    const ids = [...this.activeFeatures].filter(
      (id) => this.registry.getHandler(id)?.reapplyOnLanguageChange,
    );
    for (const id of ids) {
      const value = await this.storage.get(id);
      if (!this.shouldEnable(value)) continue;
      await this.disable(id);
      await this.enable(id, value);
    }
  }

  /** Активирует один уже упорядоченный набор фич (одна фаза). */
  private async enablePhase(ids: string[], settings: Record<string, unknown>): Promise<void> {
    for (const id of ids) {
      await this.enable(id, settings[id]);
    }
  }

  /**
   * Откладывает активацию late-фаз до простоя браузера (requestIdleCallback с
   * фолбэком на setTimeout). Не блокирует init() и первый интерактив страницы.
   *
   * Значение НЕ берём из снимка settings, захваченного в init(): между init() и
   * idle-колбэком (до 2 с) пользователь мог переключить настройку из попапа.
   * Перечитываем актуальное значение из storage в момент активации.
   */
  private scheduleLatePhase(ids: string[]): void {
    if (ids.length === 0) return;
    const run = (): void => {
      void (async () => {
        for (const id of ids) {
          const value = await this.storage.get(id);
          // Перепроверяем: настройку могли успеть выключить за время ожидания.
          if (this.shouldEnable(value)) await this.enable(id, value);
        }
      })().catch((err) => console.error('[VKify] late-phase init error:', err));
    };
    const ric = (window as typeof window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }).requestIdleCallback;
    if (ric) ric(run, { timeout: 2000 });
    else setTimeout(run, 0);
  }

  shouldEnable(value: unknown): boolean {
    return shouldEnable(value);
  }

  async enable(id: string, value: unknown = true): Promise<void> {
    const handler = this.registry.getHandler(id);
    if (!handler?.enable) return;

    // Жёсткий re-enable активной фичи: сначала полный teardown, затем сборка.
    // (reapply() ниже этот шаг сознательно пропускает — см. его доку.)
    // Исключение — idempotent-фичи (reapplyOnUpdate): их enable перезаписывает
    // состояние на месте, а disable между кадрами дал бы кадр-сброс/мерцание
    // (напр. смена акцентного цвета: disable снимает переменные → синяя вспышка).
    if (this.activeFeatures.has(id) && handler.disable && !handler.reapplyOnUpdate) {
      await handler.disable();
    }

    await this.runEnable(id, handler, value);
  }

  /**
   * Переактивирует УЖЕ активную фичу (SPA-навигация) без жёсткого
   * disable-перед-enable: плагинный apply-цикл идемпотентен и пересобирает
   * состояние на месте (без «пустого кадра»/мерцания). В отличие от прямого
   * `handler.enable()`, проходит штатным путём — с perf-таймингом, учётом
   * failed-состояния и эмитом feature:enabled. Используется NavigationService.
   */
  async reapply(id: string, value: unknown = true): Promise<void> {
    const handler = this.registry.getHandler(id);
    if (!handler?.enable) return;
    await this.runEnable(id, handler, value);
  }

  /**
   * Единый путь активации: тайминг + учёт активных/упавших фич + событие. Ошибку
   * НЕ пробрасывает (одна сломанная фича не должна валить остальные), но и не
   * «глотает» молча — фиксирует в failed и сообщает наверх через getFailedFeatures()
   * (дашборд показывает, сколько фич не запустилось).
   */
  private async runEnable(id: string, handler: FeatureHandler, value: unknown): Promise<void> {
    try {
      // Время в enable() — компонент execution-time прокси «нагрузки» фичи
      // для Performance Dashboard (нет браузерного per-feature CPU).
      const startedAt = performance.now();
      await handler.enable!(value);
      this.perf.recordFeatureInit(id, performance.now() - startedAt);
      this.activeFeatures.add(id);
      this.failed.delete(id);
      this.eventBus.emit('feature:enabled', { id, value });
      this.warnConflicts(id);
      console.log(`[VKify] ✓ ${id}`);
    } catch (error) {
      this.failed.set(id, (error as Error)?.message ?? String(error));
      console.error(`[VKify] ✗ ${id}:`, error);
    }
  }

  /**
   * Информирует о конфликте только что активированной фичи с уже активными
   * (единый источник пар — shared/constants/feature-conflicts.ts; попап
   * предупреждает по нему же в момент включения тумблера). Обе фичи продолжают
   * работать: конфликт — это «вместе бессмысленно», а не «нельзя».
   */
  private warnConflicts(id: string): void {
    const meta = this.registry.getMeta(id);
    if (!meta || meta.conflictsWith.length === 0) return;

    for (const other of meta.conflictsWith) {
      if (!this.activeFeatures.has(other)) continue;
      const reason = findConflict(id, other)?.reason ?? '';
      console.warn(
        `[VKify] ⚠ «${id}» конфликтует с активной «${other}»${reason ? `: ${reason}` : ''}`,
      );
      this.eventBus.emit('feature:conflict', { id, with: other, reason });
    }
  }

  async disable(id: string): Promise<void> {
    this.failed.delete(id);
    if (!this.activeFeatures.has(id)) return;

    const handler = this.registry.getHandler(id);
    if (!handler?.disable) return;

    try {
      await handler.disable();
      this.activeFeatures.delete(id);
      this.domSubs.teardown(id);
      this.perf.clearFeature(id);
      this.eventBus.emit('feature:disabled', { id });
      console.log(`[VKify] ○ ${id}`);
    } catch (error) {
      console.error(`[VKify] ✗ disable ${id}:`, error);
    }
  }

  /** Фичи, упавшие на последней активации (для дашборда/диагностики). */
  getFailedFeatures(): FailedFeature[] {
    return [...this.failed].map(([id, error]) => ({ id, error }));
  }

  /**
   * Подписка на появление элементов, привязанная к фиче: при disable(id) она
   * снимается автоматически. Фичам больше не нужно держать свой MutationObserver.
   */
  observeMatches(id: string, spec: SelectorSpec, onMatch: (el: Element) => void, priority?: Priority): Unsubscribe {
    return this.domSubs.observeMatches(id, spec, onMatch, priority);
  }

  observeChanges(id: string, cb: () => void, opt?: ChangeOpt): Unsubscribe {
    return this.domSubs.observeChanges(id, cb, opt);
  }

  /**
   * Подписка на ресайз узла через общий ResizeObserver, привязанная к фиче:
   * снимается на disable(id), как и match/change-подписки.
   */
  observeResize(id: string, el: Element, cb: () => void, opt?: ResizeOpt): Unsubscribe {
    return this.domSubs.observeResize(id, el, cb, opt);
  }

  /** Промис появления элемента по spec — реэкспорт domObserver для FeatureContext. */
  waitForElement<T extends Element = Element>(
    spec: SelectorSpec, opts?: { timeoutMs?: number },
  ): Promise<T> {
    return this.observer.waitForElement<T>(spec, opts);
  }


  injectCSS(id: string, css: string): void {
    this.cssManager.inject(id, css);
    // Зеркалим в localStorage, чтобы CSS применился мгновенно на следующей
    // загрузке (см. injected-css-mirror.ts).
    recordInjectedCss(id, css);
  }

  removeCSS(id: string): void {
    this.cssManager.remove(id);
    recordRemovedCss(id);
  }


  // Статические CSS-фичи: правила лежат в colocated .css рядом с фичей, а здесь
  // лишь ставится/снимается маркер data-vkify-<id> на <html>. Владелец маркеров и
  // их localStorage-зеркала — CssMarkerManager (см. core/css-marker-manager.ts).
  enableCss(id: string): void {
    this.cssMarkers.enable(id);
  }

  disableCss(id: string): void {
    this.cssMarkers.disable(id);
  }


  injectScript(name: InjectedScriptName, nonce?: string): void {
    this.scriptInjector.inject(name, nonce);
  }


  sendEvent(eventName: string, detail: Record<string, unknown> = {}): void {
    dispatchPageEvent(eventName, detail);
  }


  isActive(id: string): boolean {
    return this.activeFeatures.has(id);
  }

  /** Псевдоним isActive — единый нейминг для декларативного API (ctx.isEnabled). */
  isEnabled(id: string): boolean {
    return this.isActive(id);
  }


  getActiveFeatureIds(): string[] {
    return [...this.activeFeatures];
  }


  async getSetting<T = unknown>(key: string): Promise<T | null> {
    return this.storage.get<T>(key);
  }

  async setSetting(key: string, value: unknown): Promise<void> {
    await this.storage.set(key, value);
  }

  onStorageChange(callback: (key: string, value: unknown) => void): () => void {
    return this.storage.onChange(callback);
  }

  /** Подписка на изменение конкретного ключа (фильтр поверх storage.onChange). */
  onSettingChange(key: string, callback: (value: unknown) => void): () => void {
    return this.storage.onChange((changedKey, value) => {
      if (changedKey === key) callback(value);
    });
  }

  async getAllSettings(): Promise<Record<string, unknown>> {
    return this.storage.getAll();
  }
}
