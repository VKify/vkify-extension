import type { FeatureHandler, FeatureMap } from '../../types/index.js';
import type { StorageManager } from './storage.js';
import type { InjectedScriptName } from './injected-scripts.js';
import { CssManager } from './css-manager.js';
import { ScriptInjector } from './script-injector.js';
import { shouldEnable } from './should-enable.js';
import { reconcileCssMarkers, syncCssMarkerMirror } from './css-marker-mirror.js';
import { recordInjectedCss, recordRemovedCss, reconcileInjectedCss } from './injected-css-mirror.js';
import { dispatchPageEvent } from '../utils/page-event.js';
import { domObserver, SELECTORS, type Unsubscribe, type Priority, type ChangeOpt, type ResizeOpt } from './dom/index.js';
import { perfCollector } from './perf/collector.js';
import type { FeatureContext } from './feature-context.js';
import type { SelectorSpec } from '../selectors/types.js';
import { FeatureRegistry, type FeatureMetadataInput } from './features/index.js';
import { serviceContainer, SERVICES, EventBus, type ServiceContainer, type ServiceTypeMap, type ContentBusEvents } from './services/index.js';

export class FeatureManager implements FeatureContext {
  /** Централизованный реестр селекторов — часть FeatureContext. */
  readonly selectors = SELECTORS;

  /** DI-контейнер общих сервисов — часть FeatureContext (см. core/services). */
  readonly services: ServiceContainer = serviceContainer;

  private readonly storage: StorageManager;
  private readonly cssManager = new CssManager();
  private readonly scriptInjector = new ScriptInjector();

  /** Реестр фич (метадата + обработчики) — источник истины о зарегистрированных фичах. */
  private readonly registry = new FeatureRegistry();
  private readonly activeFeatures = new Set<string>();

  // DOM-подписки, заведённые фичей. Снимаются в disable(), гарантируя, что
  // ни один observer не переживёт выключение фичи (страховка от утечек).
  private readonly domSubs = new Map<string, Set<Unsubscribe>>();

  // Static CSS features whose data-vkify-<id> marker is currently set. Mirrored
  // to localStorage so the next page load can apply them synchronously, before
  // first paint (see core/css-marker-mirror.ts).
  private readonly activeCssMarkers = new Set<string>();

  /** Снятие предыдущего storage.onChange — чтобы init() не накапливал слушателей. */
  private _offStorageChange: (() => void) | null = null;

  constructor(storage: StorageManager) {
    this.storage = storage;
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
      .registerValue(SERVICES.domObserver, domObserver)
      .registerValue(SERVICES.perfCollector, perfCollector)
      // event-bus — lazy: создаётся при первом обращении (emit на enable/disable).
      .registerFactory(SERVICES.eventBus, () => new EventBus<ContentBusEvents>());
  }

  // Прямые getter'ы поверх сервис-контейнера — удобный доступ для фич
  // (ctx.perfCollector.recordApiCall() вместо getService(SERVICES.perfCollector)).
  // Часть контракта FeatureContext.
  get domObserver(): ServiceTypeMap['dom-observer'] {
    return serviceContainer.get(SERVICES.domObserver);
  }

  get perfCollector(): ServiceTypeMap['perf-collector'] {
    return serviceContainer.get(SERVICES.perfCollector);
  }

  get eventBus(): EventBus<ContentBusEvents> {
    return serviceContainer.get<EventBus<ContentBusEvents>>(SERVICES.eventBus);
  }

  get featureRegistry(): FeatureRegistry {
    return this.registry;
  }

  register(id: string, handler: FeatureHandler, meta?: FeatureMetadataInput): void {
    this.registry.register(id, handler, meta);
  }

  registerMultiple(features: FeatureMap): void {
    for (const [id, handler] of Object.entries(features)) {
      this.register(id, handler);
    }
  }

  /**
   * Богатая регистрация одной фичи с метадатой реестра (категория, impact,
   * зависимости, initOrder, теги). Предпочтительный способ для новых фич.
   */
  registerFeature(id: string, handler: FeatureHandler, meta: FeatureMetadataInput): void {
    this.registry.register(id, handler, meta);
  }

  /**
   * Навешивает/обновляет метадату уже зарегистрированных фич. Удобно для
   * доменных регистраторов, которые регистрируют фичи через registerMultiple,
   * а метадату описывают одним блоком.
   */
  describeFeatures(meta: Record<string, FeatureMetadataInput>): void {
    for (const [id, m] of Object.entries(meta)) {
      this.registry.describe(id, m);
    }
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
    // зависящих, тай-брейк по initOrder). Раньше порядок диктовался порядком
    // ключей storage — недетерминированным; теперь он явный и управляемый метадатой.
    const toEnable = Object.keys(settings).filter(
      (key) => this.registry.has(key) && this.shouldEnable(settings[key]),
    );
    for (const id of this.registry.resolveDependencies(toEnable)) {
      await this.enable(id, settings[id]);
    }

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
    reconcileCssMarkers(this.activeCssMarkers);
    reconcileInjectedCss();

    console.log('[VKify] Features active:', this.activeFeatures.size);
  }

  shouldEnable(value: unknown): boolean {
    return shouldEnable(value);
  }

  async enable(id: string, value: unknown = true): Promise<void> {
    const handler = this.registry.getHandler(id);
    if (!handler?.enable) return;

    try {
      if (this.activeFeatures.has(id) && handler.disable) {
        await handler.disable();
      }

      // Время в enable() — компонент execution-time прокси «нагрузки» фичи
      // для Performance Dashboard (нет браузерного per-feature CPU).
      const startedAt = performance.now();
      await handler.enable(value);
      perfCollector.recordFeatureInit(id, performance.now() - startedAt);
      this.activeFeatures.add(id);
      this.eventBus.emit('feature:enabled', { id, value });
      console.log(`[VKify] ✓ ${id}`);
    } catch (error) {
      console.error(`[VKify] ✗ ${id}:`, error);
    }
  }

  async disable(id: string): Promise<void> {
    if (!this.activeFeatures.has(id)) return;

    const handler = this.registry.getHandler(id);
    if (!handler?.disable) return;

    try {
      await handler.disable();
      this.activeFeatures.delete(id);
      this.teardownDomSubs(id);
      perfCollector.clearFeature(id);
      this.eventBus.emit('feature:disabled', { id });
      console.log(`[VKify] ○ ${id}`);
    } catch (error) {
      console.error(`[VKify] ✗ disable ${id}:`, error);
    }
  }

  /**
   * Подписка на появление элементов, привязанная к фиче: при disable(id) она
   * снимается автоматически. Фичам больше не нужно держать свой MutationObserver.
   */
  observeMatches(id: string, spec: SelectorSpec, onMatch: (el: Element) => void, priority?: Priority): Unsubscribe {
    const timed = (el: Element) => this.timeFeature(id, () => onMatch(el));
    return this.trackSub(id, domObserver.observeMatches(spec, timed, priority));
  }

  observeChanges(id: string, cb: () => void, opt?: ChangeOpt): Unsubscribe {
    const timed = () => this.timeFeature(id, cb);
    return this.trackSub(id, domObserver.observeChanges(timed, opt));
  }

  /**
   * Подписка на ресайз узла через общий ResizeObserver, привязанная к фиче:
   * снимается на disable(id), как и match/change-подписки.
   */
  observeResize(id: string, el: Element, cb: () => void, opt?: ResizeOpt): Unsubscribe {
    const timed = () => this.timeFeature(id, cb);
    return this.trackSub(id, domObserver.observeResize(el, timed, opt));
  }

  /** Промис появления элемента по spec — реэкспорт domObserver для FeatureContext. */
  waitForElement<T extends Element = Element>(
    spec: SelectorSpec, opts?: { timeoutMs?: number },
  ): Promise<T> {
    return domObserver.waitForElement<T>(spec, opts);
  }

  /** Замеряет время одного DOM-колбэка фичи и относит его на её runtime-бюджет
   *  (execution-time прокси «нагрузки»). Ошибки не глотает — их ловит сам
   *  observer (safeCall). */
  private timeFeature(id: string, fn: () => void): void {
    const startedAt = performance.now();
    try {
      fn();
    } finally {
      perfCollector.addFeatureRuntime(id, performance.now() - startedAt);
    }
  }

  private trackSub(id: string, off: Unsubscribe): Unsubscribe {
    let set = this.domSubs.get(id);
    if (!set) { set = new Set(); this.domSubs.set(id, set); }
    const wrapped: Unsubscribe = () => { off(); set!.delete(wrapped); };
    set.add(wrapped);
    return wrapped;
  }

  private teardownDomSubs(id: string): void {
    const set = this.domSubs.get(id);
    if (!set) return;
    for (const off of set) off();
    this.domSubs.delete(id);
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


  // Статические CSS-фичи: вместо инжекта <style> из JS правила лежат в
  // colocated .css рядом с фичей (собираются в styles/features.css и грузятся
  // манифестом, как theme.css/content.css). Здесь мы лишь ставим/снимаем маркер
  // data-vkify-<id> на <html>, по которому эти правила и срабатывают — ровно как
  // тема переключает data-vkify-theme-radius и т.п. (см. features/appearance/theme.ts).
  enableCss(id: string): void {
    document.documentElement.setAttribute(`data-vkify-${id}`, 'true');
    this.activeCssMarkers.add(id);
    syncCssMarkerMirror(this.activeCssMarkers);
  }

  disableCss(id: string): void {
    document.documentElement.removeAttribute(`data-vkify-${id}`);
    this.activeCssMarkers.delete(id);
    syncCssMarkerMirror(this.activeCssMarkers);
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


  // ── Телеметрия производительности (Performance Dashboard) ─────────────────
  // Делегируем во внутренние менеджеры, не раскрывая их наружу.

  getActiveFeatureIds(): string[] {
    return [...this.activeFeatures];
  }

  getInjectedStyleCount(): number {
    return this.cssManager.count();
  }

  getInjectedCssBytes(): number {
    return this.cssManager.totalBytes();
  }

  getCssMarkerCount(): number {
    return this.activeCssMarkers.size;
  }

  getInjectedScriptCount(): number {
    return this.scriptInjector.count();
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

  async getAllSettings(): Promise<Record<string, unknown>> {
    return this.storage.getAll();
  }
}