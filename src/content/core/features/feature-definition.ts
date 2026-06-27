/**
 * Декларативное описание фичи (плагинная модель).
 *
 * Фича = декларативная МЕТАДАТА (id, имя, категория, фаза, зависимости…) + НАБОР
 * ПЛАГИНОВ, описывающих поведение (см. feature-plugin.ts), плюс необязательные
 * `init`/`destroy` для специфичной логики. `compileFeatureDefinition` приводит
 * описание к паре `FeatureHandler` + `FeatureMetadataInput`, поэтому плагинные и
 * старые (registerMultiple/describeFeatures) фичи живут в одном реестре.
 *
 * Ключевой принцип: ядро (этот compile + FeatureManager) НЕ знает о CSS,
 * настройках, DOM и прочих аспектах — всё это плагины. Новый аспект поведения =
 * новый плагин, без правки ядра.
 *
 * @example
 * // Через хелпер cssFeature (под капотом — [cssPlugin(...)]):
 * export const fixedSidebar = cssFeature({
 *   id: 'fixed_sidebar', name: 'Фиксированный сайдбар', category: 'appearance',
 *   cssFiles: 'appearance/sidebar/fixed-sidebar.css',
 * });
 *
 * // Явно, плагинами:
 * export const widescreenFeature: FeatureDefinition = {
 *   id: 'widescreen',
 *   category: 'appearance',
 *   phase: 'early-css',
 *   plugins: [
 *     cssPlugin(['appearance/layout/widescreen.css']),
 *     settingsPlugin(['widescreen']),
 *   ],
 * };
 */

import type { FeatureHandler } from '@/types/index.js';
import type { FeatureContext } from '../feature-context.js';
import type {
  FeatureCategory, FeatureImpact, FeaturePhase, FeatureMetadataInput,
} from './feature-registry.js';
import type { FeaturePlugin } from './feature-plugin.js';
import { createFeatureScope, type ScopedFeatureContext } from './scoped-context.js';
import { PluginManager } from './plugin-manager.js';

export interface FeatureDefinition {
  /** Уникальный id — он же основной ключ настроек (settings[id] вкл/выкл фичу). */
  readonly id: string;
  /** Человекочитаемое имя (для интроспекции/логов). По умолчанию = id. */
  readonly name?: string;
  readonly category?: FeatureCategory;
  readonly impact?: FeatureImpact;
  /** Фаза инициализации (early-css → dom-ready → late). По умолчанию 'dom-ready'. */
  readonly phase?: FeaturePhase;
  /** Включена ли по умолчанию (метадата; реальное состояние — в storage). */
  readonly enabledByDefault?: boolean;
  /** id других фич, которые должны активироваться раньше этой. */
  readonly dependencies?: readonly string[];
  /** Тай-брейк порядка внутри фазы (меньше — раньше). По умолчанию 100. */
  readonly initOrder?: number;
  readonly requiresDomLayer?: boolean;
  /** Переактивировать фичу при SPA-навигации (см. NavigationService). */
  readonly reapplyOnNavigate?: boolean;
  /** Активировать только на совпадающих pathname (см. NavigationService). */
  readonly matchPath?: (pathname: string) => boolean;
  readonly tags?: readonly string[];

  /**
   * Пути к colocated `.css` фичи — ТОЛЬКО метадата (интроспекция/аудит «какой CSS
   * чья фича»). Поведение задаёт cssPlugin, а не это поле. Хелпер cssFeature
   * заполняет оба согласованно.
   */
  readonly cssFiles?: readonly string[];
  /** Ключи настроек фичи — метадата для интроспекции (реактивность — settingsPlugin). */
  readonly settingsKeys?: readonly string[];

  /**
   * Плагины поведения (CSS-маркер, реактивность настроек, DOM-подписки…).
   * Прогоняются ядром через единый контракт setup/onEnable/onDisable.
   */
  readonly plugins?: readonly FeaturePlugin[];

  /**
   * Специфичная инициализация фичи (после onEnable всех плагинов). Значение
   * настройки берётся через `ctx.getOwnSetting()`. Ресурсы, созданные через
   * `ctx`, снимаются автоматически. Необязательна — поведение может быть целиком
   * в плагинах.
   */
  init?(ctx: ScopedFeatureContext): void | Promise<void>;

  /** Парный к init teardown (до onDisable плагинов). Необязателен. */
  destroy?(ctx: ScopedFeatureContext): void | Promise<void>;
}

/** Результат компиляции — то, что кладётся в реестр. */
export interface CompiledFeature {
  readonly id: string;
  readonly handler: FeatureHandler;
  readonly meta: FeatureMetadataInput;
}

/**
 * Приводит декларативное описание к паре handler + meta. Ядро «тупое»: оно лишь
 * прогоняет плагины через их жизненный цикл и зовёт init/destroy фичи — никакой
 * специальной логики по CSS/настройкам/DOM здесь нет (это всё плагины).
 *
 * @param def описание фичи.
 * @param ctx контекст (обычно сам FeatureManager) — источник scope и storage.
 */
export function compileFeatureDefinition(
  def: FeatureDefinition,
  ctx: FeatureContext,
): CompiledFeature {
  const { id } = def;
  const scope = createFeatureScope(id, ctx);

  // Жизненным циклом плагинов владеет отдельная сущность PluginManager — compile
  // лишь связывает её с handler/registry. Никакой логики плагинов здесь нет.
  const plugins = new PluginManager(scope, def.plugins ?? [], {
    init: def.init,
    destroy: def.destroy,
  });

  const handler: FeatureHandler = {
    enable: (value?: unknown) => plugins.enable(value),
    disable: () => plugins.disable(),
  };

  if (def.reapplyOnNavigate) handler.reapplyOnNavigate = true;
  if (def.matchPath) handler.matchPath = def.matchPath;

  const meta: FeatureMetadataInput = {
    name: def.name,
    category: def.category,
    impact: def.impact,
    phase: def.phase,
    dependencies: def.dependencies,
    initOrder: def.initOrder,
    enabledByDefault: def.enabledByDefault,
    requiresDomLayer: def.requiresDomLayer,
    cssFiles: def.cssFiles,
    settingsKeys: def.settingsKeys,
    tags: def.tags,
  };

  return { id, handler, meta };
}
