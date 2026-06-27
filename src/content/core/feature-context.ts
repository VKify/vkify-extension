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
 * Контракт фичи разбит на узкие роли (Interface Segregation): плагины и хелперы
 * могут типизироваться на нужный срез (напр. `SettingsContext`), а не на весь
 * фасад. `FeatureContext` — их композиция; именно его реализует FeatureManager и
 * получает ScopedFeatureContext через делегирование.
 */

/** Доступ к настройкам (storage) и подпискам на их изменения. */
export interface SettingsContext {
  getSetting<T = unknown>(key: string): Promise<T | null>;
  setSetting(key: string, value: unknown): Promise<void>;
  getAllSettings(): Promise<Record<string, unknown>>;
  /** Подписка на ЛЮБОЙ изменившийся ключ. */
  onStorageChange(callback: (key: string, value: unknown) => void): () => void;
  /** Подписка на изменение КОНКРЕТНОГО ключа. */
  onSettingChange(key: string, callback: (value: unknown) => void): Unsubscribe;
}

/** CSS: инжект <style> (с зеркалом) и переключение colocated-CSS маркером. */
export interface CssContext {
  /** Инжект <style> с зеркалом в localStorage (мгновенно на след. загрузке). */
  injectCSS(id: string, css: string): void;
  removeCSS(id: string): void;
  /** Включение/выключение статического colocated-CSS через маркер data-vkify-<id>. */
  enableCss(id: string): void;
  disableCss(id: string): void;
}

/** DOM-слой: реестр селекторов + привязанные к фиче подписки (авто-teardown). */
export interface DomContext {
  /** Централизованный реестр селекторов VK (см. selectors/index.ts). */
  readonly selectors: typeof SELECTORS;
  /** Общий MutationObserver/ResizeObserver-слой (прямой доступ к остальному API). */
  readonly domObserver: typeof domObserver;

  /** Подписка на появление элементов по spec, привязанная к id. Снимается на disable(id). */
  observeMatches(
    id: string, spec: SelectorSpec, onMatch: (el: Element) => void, priority?: Priority,
  ): Unsubscribe;
  /** Подписка на изменения DOM/контейнера с debounce/throttle, привязанная к id. */
  observeChanges(id: string, cb: () => void, opt?: ChangeOpt): Unsubscribe;
  /** Подписка на ресайз узла через общий ResizeObserver, привязанная к id. */
  observeResize(id: string, el: Element, cb: () => void, opt?: ResizeOpt): Unsubscribe;
  /** Промис появления элемента по spec (или reject по timeout). */
  waitForElement<T extends Element = Element>(
    spec: SelectorSpec, opts?: { timeoutMs?: number },
  ): Promise<T>;
}

/** Page-world: инъекция скриптов и CustomEvent'ы к ним. */
export interface ScriptContext {
  /** Инъекция page-world скрипта (идемпотентно). */
  injectScript(name: InjectedScriptName, nonce?: string): void;
  /** CustomEvent в page-world к инжектированным скриптам. */
  sendEvent(eventName: string, detail?: Record<string, unknown>): void;
}

/** Общие сервисы (DI-контейнер + частые getter'ы). */
export interface ServicesContext {
  /** DI-контейнер общих сервисов — для редких/динамических случаев. */
  readonly services: ServiceContainer;
  /** Сборщик телеметрии производительности (recordApiCall и пр.). */
  readonly perfCollector: typeof perfCollector;
  /** Внутри-content шина событий (feature:enabled/disabled и будущие). */
  readonly eventBus: EventBus<ContentBusEvents>;
  /** Реестр фич (метадата, категории, impact) — для интроспекции. */
  readonly featureRegistry: FeatureRegistry;
  /** Единый VK API-сервис (call + высокоуровневые методы; native-bridge → token). */
  readonly vkApi: VKApiService;
}

/** Рантайм-состояние фич. */
export interface FeatureStateContext {
  /** Активна ли фича сейчас (рантайм-состояние FeatureManager). */
  isActive(id: string): boolean;
  /** Псевдоним isActive — единый «человеческий» нейминг для декларативного API. */
  isEnabled(id: string): boolean;
}

/**
 * Полный контракт, который фича/плагин получает от FeatureManager — композиция
 * узких ролей выше. Типизируйтесь на него (`createXFeature(ctx: FeatureContext)`),
 * а не на весь FeatureManager: наружу не торчат регистрационные методы и кухня
 * менеджера. FeatureManager реализует этот интерфейс (`implements FeatureContext`).
 */
export interface FeatureContext extends
  SettingsContext, CssContext, DomContext, ScriptContext, ServicesContext, FeatureStateContext {}
