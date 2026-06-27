/**
 * Плагинная модель поведения фичи.
 *
 * Фича (FeatureDefinition) — это декларативная метадата + НАБОР ПЛАГИНОВ. Каждый
 * плагин инкапсулирует один аспект поведения (CSS-маркер, реактивность настроек,
 * DOM-подписки, …) и сам управляет своим жизненным циклом. Ядро
 * (compileFeatureDefinition + FeatureManager) НЕ знает о конкретных аспектах — оно
 * лишь прогоняет плагины через единый контракт. Новый вид поведения = новый
 * плагин, без единой правки ядра.
 *
 * Жизненный цикл (вызывает compileFeatureDefinition):
 *   setup     — один раз на каждый apply-цикл; регистрирует подписки и ВОЗВРАЩАЕТ
 *               функцию очистки (как useEffect). Снимается перед следующим setup
 *               и на disable.
 *   onEnable  — применить эффект (поставить маркер, навесить DOM и т.п.).
 *   onDisable — снять эффект. Парный к onEnable.
 *
 * Порядок: setup(все) → onEnable(все) → init фичи; на выключении —
 * destroy фичи → onDisable(все) → cleanup setup.
 */

import type { ScopedFeatureContext } from './scoped-context.js';
import type { InjectedScriptName } from '../injected-scripts.js';

export interface FeaturePlugin {
  /**
   * Имя плагина — для отладки/интроспекции И как идентификатор для `dependsOn`
   * других плагинов. Нужно только если на плагин кто-то ссылается.
   */
  readonly name?: string;

  /**
   * Приоритет (порядок выполнения внутри фичи): меньше — раньше на enable/setup.
   * По умолчанию 100. На onDisable порядок обратный (LIFO-teardown).
   */
  readonly priority?: number;

  /**
   * Имена плагинов этой же фичи, которые должны отработать РАНЬШЕ (setup/onEnable).
   * PluginManager строит порядок топологически; приоритет — вторичный тай-брейк.
   */
  readonly dependsOn?: readonly string[];

  /**
   * Регистрация подписок/слушателей. Может вернуть функцию очистки, которую
   * фреймворк вызовет при teardown (перед reapply и на disable).
   */
  setup?(ctx: ScopedFeatureContext): void | (() => void);

  /** Применить эффект плагина (идемпотентно относительно onDisable). */
  onEnable?(ctx: ScopedFeatureContext): void | Promise<void>;

  /** Снять эффект плагина. */
  onDisable?(ctx: ScopedFeatureContext): void | Promise<void>;
}

/**
 * Плагин статического CSS: переключает маркер `data-vkify-<id>` на <html>, по
 * которому срабатывают colocated-стили фичи (агрегируются в styles/features.css).
 *
 * `files` влияют только на отладочное имя и используются хелпером cssFeature для
 * метадаты/аудита — само поведение зависит лишь от маркера (имя = id фичи).
 */
export function cssPlugin(files: readonly string[] = []): FeaturePlugin {
  return {
    name: files.length ? `css(${files.length})` : 'css',
    onEnable: (ctx) => ctx.enableCss(),
    onDisable: (ctx) => ctx.disableCss(),
  };
}

/**
 * Плагин реактивности настроек: при изменении любого из `keys` переинициализирует
 * фичу через `ctx.reapply()`.
 *
 * Собственный id фичи из списка ИСКЛЮЧАЕТСЯ: FeatureManager уже перезапускает
 * фичу при изменении её id-ключа (его значение и есть on/off-переключатель), и
 * повторное отслеживание здесь привело бы к двойному применению.
 */
export function settingsPlugin(keys: readonly string[]): FeaturePlugin {
  return {
    name: 'settings',
    setup(ctx) {
      const watched = keys.filter((key) => key !== ctx.id);
      const offs = watched.map((key) => ctx.onSettingChange(key, () => ctx.reapply()));
      return () => offs.forEach((off) => off());
    },
  };
}

/**
 * Плагин инъекции page-world скрипта: на onEnable инжектирует скрипт (идемпотентно
 * — ScriptInjector не дублирует). onDisable намеренно no-op: уже инъектированный в
 * page-world скрипт нельзя «раз-инъектировать», поэтому фичи глушат его эффект
 * иначе (напр. anti-tracking шлёт sendEvent с выключенной настройкой в destroy).
 */
export function scriptPlugin(name: InjectedScriptName, nonce?: string): FeaturePlugin {
  return {
    name: `script:${name}`,
    onEnable: (ctx) => ctx.injectScript(name, nonce),
  };
}

/** «Старый» обработчик фичи: enable(value)/disable, как в FeatureHandler. */
export interface HandlerLike {
  enable?(value?: unknown): void | Promise<void>;
  disable?(): void | Promise<void>;
}

/**
 * Адаптер: оборачивает существующий императивный обработчик (enable/disable) в
 * плагин — без переписывания его внутренностей. Рабочая лошадка гибридной
 * миграции: тяжёлые stateful-фичи (тема, шрифты, фон, загрузки, crypto, spy)
 * становятся плагинными, сохраняя боевую, проверенную логику.
 *
 * Значение прокидывается из триггера (`ctx.value` — напр. live-превью из
 * ENABLE_FEATURE); если его нет (reapply), берётся из storage (getOwnSetting) —
 * это в точности повторяет прежний контракт `manager.enable(id, value)`.
 */
export function handlerPlugin(handler: HandlerLike): FeaturePlugin {
  return {
    name: 'handler',
    async onEnable(ctx) {
      const value = ctx.value !== undefined ? ctx.value : await ctx.getOwnSetting();
      await handler.enable?.(value ?? undefined);
    },
    async onDisable() {
      await handler.disable?.();
    },
  };
}
