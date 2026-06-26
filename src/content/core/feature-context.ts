import type { SelectorSpec } from '@/content/selectors/types.js';
import type { SELECTORS } from '@/content/selectors/index.js';
import type { Priority, ChangeOpt, ResizeOpt, Unsubscribe, domObserver } from './dom/index.js';
import type { perfCollector } from './perf/collector.js';
import type { ServiceContainer, ContentBusEvents } from './services/index.js';
import type { EventBus } from './services/event-bus.js';
import type { FeatureRegistry } from './features/index.js';
import type { InjectedScriptName } from './injected-scripts.js';
import type { VKApiService } from './api/index.js';

/**
 * Полный контракт, который фича получает от FeatureManager. Это THE interface, на
 * который должны типизироваться фичи (`createXFeature(ctx: FeatureContext)`), а не
 * на весь FeatureManager — наружу для фич не торчат регистрационные методы
 * (registerMultiple / describeFeatures) и внутренняя кухня менеджера.
 *
 * Даёт три вещи:
 *   1. Реестр селекторов + DOM-подписки, привязанные к фиче (снимаются на
 *      disable() автоматически — фиче не нужен свой MutationObserver/teardown).
 *   2. Удобный прямой доступ к общим сервисам (domObserver, perfCollector,
 *      eventBus, featureRegistry) — getter'ы поверх сервис-контейнера, плюс сам
 *      `services` для редких/динамических случаев.
 *   3. Сахар над storage/CSS/скриптами/событиями (injectCSS, getSetting, …),
 *      который мирорит данные и относит время на perf-бюджет фичи.
 *
 * FeatureManager реализует этот интерфейс (`implements FeatureContext`).
 */
export interface FeatureContext {
  /** Централизованный реестр селекторов VK (см. selectors/index.ts). */
  readonly selectors: typeof SELECTORS;

  // ── Сервисы ────────────────────────────────────────────────────────────────

  /**
   * DI-контейнер общих сервисов. Нужен для редких/динамических случаев; для
   * частых сервисов используйте прямые getter'ы ниже (ctx.perfCollector и т.п.).
   */
  readonly services: ServiceContainer;

  /**
   * Общий MutationObserver/ResizeObserver-слой. Для подписок, привязанных к
   * фиче, предпочитайте observeMatches/observeChanges/observeResize (они сами
   * снимаются на disable и относятся на perf-бюджет). Прямой доступ — для
   * остального API (whenRemoved, waitForElement и т.п.).
   */
  readonly domObserver: typeof domObserver;

  /** Сборщик телеметрии производительности (recordApiCall и пр.). */
  readonly perfCollector: typeof perfCollector;

  /** Внутри-content шина событий (feature:enabled/disabled и будущие). */
  readonly eventBus: EventBus<ContentBusEvents>;

  /** Реестр фич (метадата, категории, impact) — для интроспекции. */
  readonly featureRegistry: FeatureRegistry;

  /**
   * Единый VK API-сервис: low-level `call(method, params)` + высокоуровневые
   * методы (getCurrentUser/getUser/sendMessage/uploadAudio/…). Внутри —
   * native-bridge → token-fallback, очередь и retry. Хелперы без ctx берут тот
   * же singleton через getService(SERVICES.vkApi).
   */
  readonly vkApi: VKApiService;

  // ── DOM-подписки, привязанные к фиче ────────────────────────────────────────

  /**
   * Подписка на появление элементов по spec (initial-скан + будущие вставки),
   * привязанная к фиче id. Снимается на disable(id).
   */
  observeMatches(
    id: string,
    spec: SelectorSpec,
    onMatch: (el: Element) => void,
    priority?: Priority,
  ): Unsubscribe;

  /** Подписка на изменения DOM/контейнера с debounce/throttle, привязанная к id. */
  observeChanges(id: string, cb: () => void, opt?: ChangeOpt): Unsubscribe;

  /** Подписка на ресайз узла через общий ResizeObserver, привязанная к id. */
  observeResize(id: string, el: Element, cb: () => void, opt?: ResizeOpt): Unsubscribe;

  /** Промис появления элемента по spec (или reject по timeout). */
  waitForElement<T extends Element = Element>(
    spec: SelectorSpec, opts?: { timeoutMs?: number },
  ): Promise<T>;

  // ── CSS / скрипты / события ─────────────────────────────────────────────────

  /** Инжект <style> с зеркалом в localStorage (мгновенное применение на след. загрузке). */
  injectCSS(id: string, css: string): void;
  removeCSS(id: string): void;

  /** Включение/выключение статического colocated-CSS через маркер data-vkify-<id>. */
  enableCss(id: string): void;
  disableCss(id: string): void;

  /** Инъекция page-world скрипта (идемпотентно). */
  injectScript(name: InjectedScriptName, nonce?: string): void;

  /** CustomEvent в page-world к инжектированным скриптам. */
  sendEvent(eventName: string, detail?: Record<string, unknown>): void;

  // ── Настройки ───────────────────────────────────────────────────────────────

  getSetting<T = unknown>(key: string): Promise<T | null>;
  setSetting(key: string, value: unknown): Promise<void>;
  onStorageChange(callback: (key: string, value: unknown) => void): () => void;
  getAllSettings(): Promise<Record<string, unknown>>;

  /** Активна ли фича сейчас (рантайм-состояние FeatureManager). */
  isActive(id: string): boolean;
}
