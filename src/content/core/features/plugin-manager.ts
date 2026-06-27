/**
 * PluginManager — отдельная сущность, управляющая жизненным циклом НАБОРА
 * плагинов одной фичи. Раньше эта логика жила closure'ом внутри
 * compileFeatureDefinition; вынесена сюда, чтобы:
 *   • compile стал тонким (только scope + handler + meta);
 *   • порядок/зависимости/приоритеты плагинов имели явного владельца;
 *   • lifecycle можно было тестировать изолированно.
 *
 * Менеджер ничего не знает о CSS/настройках/DOM — он лишь прогоняет плагины
 * через единый контракт setup/onEnable/onDisable в разрешённом порядке и зовёт
 * init/destroy фичи. Один экземпляр = одна фича.
 *
 * Порядок: enable/setup — топологический по `dependsOn`, тай-брейк по `priority`
 * (меньше раньше), затем по исходному индексу; onDisable — обратный (LIFO).
 */

import type { FeatureScope } from './scoped-context.js';
import type { FeaturePlugin } from './feature-plugin.js';
import { topoSort } from '../util/topo-sort.js';

const DEFAULT_PRIORITY = 100;

/** Хуки самой фичи — выполняются после/до плагинов (init после onEnable; destroy до onDisable). */
export interface FeatureLifecycleHooks {
  init?(ctx: FeatureScope): void | Promise<void>;
  destroy?(ctx: FeatureScope): void | Promise<void>;
}

/**
 * Упорядочивает плагины: зависимости (`dependsOn` по `name`) раньше зависящих,
 * тай-брейк по `priority`, затем по исходному индексу. Толерантен к ссылкам на
 * несуществующие плагины и к циклам (предупреждение, связь игнорируется).
 */
export function orderPlugins(plugins: readonly FeaturePlugin[]): FeaturePlugin[] {
  const byName = new Map<string, FeaturePlugin>();
  for (const p of plugins) if (p.name) byName.set(p.name, p);

  const index = new Map<FeaturePlugin, number>();
  plugins.forEach((p, i) => index.set(p, i));

  const rank = (p: FeaturePlugin): number => p.priority ?? DEFAULT_PRIORITY;

  // Топология — общий toposort (core/util); здесь лишь стратегия: identity по
  // ссылке/имени, тай-брейк по priority → исходному индексу, доменные warning'и.
  return topoSort(plugins, {
    deps: (p) => p.dependsOn ?? [],
    resolveDep: (name) => byName.get(name),
    compare: (a, b) => rank(a) - rank(b) || index.get(a)! - index.get(b)!,
    key: (p) => p.name,
    onSkippedDep: (name, dep) =>
      console.warn(`[VKify] Плагин "${name ?? '?'}" зависит от неизвестного "${dep}"`),
    onCycle: (name) =>
      console.warn(`[VKify] Цикл зависимостей плагинов на "${name ?? '?'}" — связь проигнорирована`),
  });
}

export class PluginManager {
  private readonly plugins: FeaturePlugin[];
  /** Функции очистки, возвращённые setup() в текущем apply-цикле. */
  private setupCleanups: Array<() => void> = [];
  /** Применена ли фича сейчас (для teardown на disable). */
  private applied = false;
  /** Запланирован ли отложенный reapply — коалесинг нескольких вызовов в один. */
  private reapplyScheduled = false;

  constructor(
    private readonly scope: FeatureScope,
    plugins: readonly FeaturePlugin[],
    private readonly hooks: FeatureLifecycleHooks = {},
  ) {
    this.plugins = orderPlugins(plugins);
    // Плагины (напр. settingsPlugin) дёргают reapply через scope. ОТКЛАДЫВАЕМ его
    // на микротаск (и коалесим): иначе reapply, вызванный из обработчика
    // изменения настройки, синхронно перерегистрировал бы свои же подписки прямо
    // во время обхода списка слушателей storage — ре-энтрантный шторм. На
    // микротаске обход уже завершён. Значение перечитывается из storage.
    this.scope.bindReapply(() => {
      if (this.reapplyScheduled) return;
      this.reapplyScheduled = true;
      queueMicrotask(() => {
        this.reapplyScheduled = false;
        this.apply().catch((err) => console.error(`[VKify] reapply ${this.scope.id}:`, err));
      });
    });
  }

  /** Включить/(пере)собрать фичу. `value` — «сырое» значение триггера (см. scope.value). */
  enable(value?: unknown): Promise<void> {
    return this.apply(value);
  }

  /** Выключить фичу: teardown плагинов + полная очистка scope. */
  async disable(): Promise<void> {
    await this.teardown();
    this.clearSetup();
    this.scope.disposeAll();
  }

  /**
   * apply-цикл: МЯГКАЯ (пере)сборка на месте. НЕ делает teardown/onDisable перед
   * onEnable — иначе между «снято» и «навешено» возникает пустой кадр (мерцание;
   * напр. фон-обои: onDisable чистит DOM, onEnable пересобирает — с зазором это
   * видимый flash). Плагины идемпотентны: onEnable заменяет состояние на месте.
   *
   * Полный teardown нужен только при настоящем выключении (disable). «Жёсткий»
   * re-enable (смена значения ключа фичи) тоже корректен: FeatureManager сам
   * вызывает disable() перед enable() для активной фичи.
   *
   * Снимаем лишь то, что обязано пересоздаться без дублей: setup-cleanup'ы
   * (напр. settingsPlugin-watchers) и scope-ресурсы (addCSS/observers).
   */
  private async apply(value?: unknown): Promise<void> {
    this.scope.setValue(value);
    this.clearSetup();
    this.scope.resetInit();

    for (const plugin of this.plugins) {
      const cleanup = plugin.setup?.(this.scope);
      if (typeof cleanup === 'function') this.setupCleanups.push(cleanup);
    }
    for (const plugin of this.plugins) await plugin.onEnable?.(this.scope);
    await this.hooks.init?.(this.scope);
    this.applied = true;
  }

  /** destroy фичи → onDisable плагинов в ОБРАТНОМ порядке (LIFO). */
  private async teardown(): Promise<void> {
    if (!this.applied) return;
    await this.hooks.destroy?.(this.scope);
    for (let i = this.plugins.length - 1; i >= 0; i--) {
      await this.plugins[i].onDisable?.(this.scope);
    }
    this.applied = false;
  }

  private clearSetup(): void {
    for (const off of this.setupCleanups.splice(0)) off();
  }
}
