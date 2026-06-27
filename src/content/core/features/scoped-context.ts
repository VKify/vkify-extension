/**
 * Контекст одной фичи, привязанный к её id.
 *
 * Декларативные фичи (см. feature-definition.ts) получают в `init(ctx)` именно
 * этот scope, а не «сырой» FeatureContext. Все ресурсо-создающие методы
 * (`addCSS`, `registerMutationObserver`, `onSettingChange`, …) здесь:
 *
 *   1. уже знают id фичи — его не нужно передавать вручную;
 *   2. автоматически снимаются при выключении/переинициализации фичи — фиче не
 *      нужно вручную хранить и вызывать unsubscribe в `destroy()`.
 *
 * Это убирает целый класс утечек (забытый observer/слушатель storage переживает
 * disable) и делает фичи короче и декларативнее.
 */

import type { FeatureContext } from '../feature-context.js';
import type { SelectorSpec } from '@/content/selectors/types.js';
import type {
  Priority, ChangeOpt, ResizeOpt, Unsubscribe, domObserver,
} from '../dom/index.js';
import type { perfCollector } from '../perf/collector.js';
import type { ServiceContainer, ContentBusEvents } from '../services/index.js';
import type { EventBus } from '../services/event-bus.js';
import type { InjectedScriptName } from '../injected-scripts.js';
import type { VKApiService } from '../api/index.js';
import type { SELECTORS } from '@/content/selectors/index.js';

/**
 * Привязанный к фиче фасад над FeatureContext. Контракт, на который
 * типизируются декларативные `init/destroy`.
 */
export interface ScopedFeatureContext {
  /** id фичи, которой принадлежит этот scope. */
  readonly id: string;

  /**
   * «Сырое» значение из текущего триггера enable() — например, value из
   * ENABLE_FEATURE (live-превью цвета/слайдера ДО записи в storage). Обычно
   * совпадает с getOwnSetting(), но может опережать его при дебаунс-записи.
   * При reapply (изменение настройки) — undefined: значение читается из storage.
   */
  readonly value: unknown;

  // ── Привязанные к фиче ресурсы (снимаются автоматически) ────────────────────

  /**
   * Инжектирует CSS под id фичи. Повторные вызовы накапливаются в один <style>
   * (а не перетирают друг друга, как «сырой» injectCSS). Снимается на disable/reapply.
   */
  addCSS(css: string): void;

  /** Ставит маркер `data-vkify-<id>` на <html> (включает colocated-CSS фичи). */
  enableCss(): void;

  /** Снимает маркер `data-vkify-<id>` (выключает colocated-CSS фичи). */
  disableCss(): void;

  /**
   * Подписка на появление элементов по селектору (initial-скан + будущие вставки).
   * Колбэк получает каждый совпавший элемент. Снимается на disable/reapply.
   * @param selector строка или список кандидатов (SelectorSpec).
   */
  registerMutationObserver(
    selector: SelectorSpec,
    onMatch: (el: Element) => void,
    priority?: Priority,
  ): Unsubscribe;

  /** Подписка на изменения DOM с debounce/throttle. Снимается на disable/reapply. */
  observeChanges(cb: () => void, opt?: ChangeOpt): Unsubscribe;

  /** Подписка на ресайз узла через общий ResizeObserver. Снимается на disable/reapply. */
  observeResize(el: Element, cb: () => void, opt?: ResizeOpt): Unsubscribe;

  /** Промис появления элемента по селектору (или reject по timeout). */
  waitForElement<T extends Element = Element>(
    selector: SelectorSpec, opts?: { timeoutMs?: number },
  ): Promise<T>;

  /**
   * Подписка на изменение конкретного ключа настроек. Снимается на disable/reapply.
   * Для ключей из `settingsKeys` фреймворк подписывается сам (reactivity) — этот
   * метод нужен для дополнительных, не описанных в definition, ключей.
   */
  onSettingChange(key: string, callback: (value: unknown) => void): Unsubscribe;

  // ── Настройки ────────────────────────────────────────────────────────────────

  /** Значение «своего» ключа фичи (settings[id]) — частый случай. */
  getOwnSetting<T = unknown>(): Promise<T | null>;
  getSetting<T = unknown>(key: string): Promise<T | null>;
  setSetting(key: string, value: unknown): Promise<void>;
  getAllSettings(): Promise<Record<string, unknown>>;

  /** Активна ли фича (по умолчанию — эта же). */
  isEnabled(id?: string): boolean;

  /**
   * Переинициализировать фичу: полный цикл teardown → setup плагинов + init.
   * Используется плагинами (напр. settingsPlugin при изменении настройки), чтобы
   * фича пересобралась без участия ядра. Привязывается compileFeatureDefinition.
   */
  reapply(): void;

  // ── Прочее (passthrough к page-world) ────────────────────────────────────────

  injectScript(name: InjectedScriptName, nonce?: string): void;
  sendEvent(eventName: string, detail?: Record<string, unknown>): void;

  // ── Сервисы / реестры (passthrough) ─────────────────────────────────────────

  readonly selectors: typeof SELECTORS;
  readonly services: ServiceContainer;
  readonly domObserver: typeof domObserver;
  readonly perfCollector: typeof perfCollector;
  readonly eventBus: EventBus<ContentBusEvents>;
  readonly vkApi: VKApiService;

  /** Полный «сырой» FeatureContext для редких сценариев вне обёрнутого API. */
  readonly raw: FeatureContext;
}

/** Оборачивает unsubscribe в идемпотентный — повторные вызовы безвредны. */
function once(fn: Unsubscribe): Unsubscribe {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    fn();
  };
}

/**
 * Конкретная реализация ScopedFeatureContext. Помимо публичного контракта несёт
 * методы жизненного цикла (`resetInit`/`disposeAll`), которыми управляет
 * compileFeatureDefinition — фичам они не видны (тип сужается до интерфейса).
 */
export class FeatureScope implements ScopedFeatureContext {
  /** Ресурсы текущего init() — снимаются на reapply и на disable. */
  private readonly initDisposables: Unsubscribe[] = [];
  /** Накопленный через addCSS CSS — инжектируется одним <style> под id. */
  private cssBuffer = '';
  /** Реализация reapply, внедряемая compileFeatureDefinition (apply-цикл фичи). */
  private reapplyImpl: (() => void) | null = null;
  /** Значение текущего триггера enable() — см. геттер value. */
  private _value: unknown = undefined;

  constructor(
    readonly id: string,
    private readonly ctx: FeatureContext,
  ) {}

  get value(): unknown { return this._value; }

  get raw(): FeatureContext { return this.ctx; }
  get selectors(): typeof SELECTORS { return this.ctx.selectors; }
  get services(): ServiceContainer { return this.ctx.services; }
  get domObserver(): typeof domObserver { return this.ctx.domObserver; }
  get perfCollector(): typeof perfCollector { return this.ctx.perfCollector; }
  get eventBus(): EventBus<ContentBusEvents> { return this.ctx.eventBus; }
  get vkApi(): VKApiService { return this.ctx.vkApi; }

  addCSS(css: string): void {
    this.cssBuffer += (this.cssBuffer ? '\n' : '') + css;
    this.ctx.injectCSS(this.id, this.cssBuffer);
  }

  enableCss(): void {
    this.ctx.enableCss(this.id);
  }

  disableCss(): void {
    this.ctx.disableCss(this.id);
  }

  registerMutationObserver(
    selector: SelectorSpec,
    onMatch: (el: Element) => void,
    priority?: Priority,
  ): Unsubscribe {
    return this.track(this.ctx.observeMatches(this.id, selector, onMatch, priority));
  }

  observeChanges(cb: () => void, opt?: ChangeOpt): Unsubscribe {
    return this.track(this.ctx.observeChanges(this.id, cb, opt));
  }

  observeResize(el: Element, cb: () => void, opt?: ResizeOpt): Unsubscribe {
    return this.track(this.ctx.observeResize(this.id, el, cb, opt));
  }

  waitForElement<T extends Element = Element>(
    selector: SelectorSpec, opts?: { timeoutMs?: number },
  ): Promise<T> {
    return this.ctx.waitForElement<T>(selector, opts);
  }

  onSettingChange(key: string, callback: (value: unknown) => void): Unsubscribe {
    return this.track(this.ctx.onSettingChange(key, callback));
  }

  getOwnSetting<T = unknown>(): Promise<T | null> {
    return this.ctx.getSetting<T>(this.id);
  }
  getSetting<T = unknown>(key: string): Promise<T | null> {
    return this.ctx.getSetting<T>(key);
  }
  setSetting(key: string, value: unknown): Promise<void> {
    return this.ctx.setSetting(key, value);
  }
  getAllSettings(): Promise<Record<string, unknown>> {
    return this.ctx.getAllSettings();
  }

  isEnabled(id?: string): boolean {
    return this.ctx.isActive(id ?? this.id);
  }

  reapply(): void {
    if (!this.reapplyImpl) {
      console.warn(`[VKify] reapply() для "${this.id}" вызван до привязки — игнорирую`);
      return;
    }
    this.reapplyImpl();
  }

  injectScript(name: InjectedScriptName, nonce?: string): void {
    this.ctx.injectScript(name, nonce);
  }
  sendEvent(eventName: string, detail?: Record<string, unknown>): void {
    this.ctx.sendEvent(eventName, detail);
  }

  // ── Жизненный цикл (для compileFeatureDefinition, не для фич) ────────────────

  /** Снимает все ресурсы текущего init() (observers, слушатели, addCSS). */
  resetInit(): void {
    for (const off of this.initDisposables.splice(0)) off();
    if (this.cssBuffer) {
      this.cssBuffer = '';
      this.ctx.removeCSS(this.id);
    }
  }

  /** Полная очистка scope (сейчас совпадает с resetInit — задел на будущее). */
  disposeAll(): void {
    this.resetInit();
  }

  /** Внедряет реализацию reapply (apply-цикл из compileFeatureDefinition). */
  bindReapply(fn: () => void): void {
    this.reapplyImpl = fn;
  }

  /** Обновляет value текущего триггера (вызывает compileFeatureDefinition). */
  setValue(value: unknown): void {
    this._value = value;
  }

  private track(off: Unsubscribe): Unsubscribe {
    const wrapped = once(off);
    this.initDisposables.push(wrapped);
    return wrapped;
  }
}

/** Фабрика scope (тип сужен до публичного контракта). */
export function createFeatureScope(id: string, ctx: FeatureContext): FeatureScope {
  return new FeatureScope(id, ctx);
}
