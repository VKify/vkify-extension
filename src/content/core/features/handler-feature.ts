/**
 * Хелпер для stateful-фич с императивным ядром: оборачивает существующий
 * обработчик (enable/disable) в полноценный FeatureDefinition с метадатой —
 * одним вызовом, без отдельного describeFeatures.
 *
 * Это штатный (а не временный) путь для фич, чья логика принципиально
 * императивна: медиа-пайплайны, page-world мосты, crypto, spy и т.п. Ядро
 * обработчика НЕ переписывается — он попадает в плагинную модель через адаптер
 * handlerPlugin, а метадата (категория, фаза, impact, settingsKeys…) объявляется
 * рядом, в том же вызове.
 *
 * @example
 * handlerFeature({
 *   id: 'custom_css',
 *   name: 'Пользовательский CSS',
 *   category: 'custom-css',
 *   settingsKeys: ['custom_css', 'custom_css_enabled'],
 *   handler: {
 *     enable: (value) => applyCss(value),
 *     disable: () => removeCss(),
 *   },
 * });
 */

import type { FeatureDefinition } from './feature-definition.js';
import { handlerPlugin, type FeaturePlugin, type HandlerLike } from './feature-plugin.js';

/** Обработчик + опциональные флаги поведения (как у FeatureHandler). */
export interface HandlerFeatureHandler extends HandlerLike {
  readonly reapplyOnNavigate?: boolean;
  readonly reapplyOnUpdate?: boolean;
  readonly matchPath?: (pathname: string) => boolean;
}

export interface HandlerFeatureOptions
  extends Omit<FeatureDefinition, 'plugins' | 'init' | 'destroy'> {
  /** Императивное ядро фичи — боевая логика не переписывается. */
  readonly handler: HandlerFeatureHandler;
  /**
   * Дополнительные плагины (settingsPlugin, scriptPlugin, …). Выполняются
   * ПЕРЕД handlerPlugin (порядок в массиве plugins определения).
   */
  readonly plugins?: readonly FeaturePlugin[];
}

/**
 * Строит FeatureDefinition вокруг императивного обработчика. Флаги
 * reapplyOnNavigate / reapplyOnUpdate / matchPath берутся из опций, а при их
 * отсутствии — с самого обработчика.
 *
 * settingsPlugin НЕ добавляется автоматически: у мульти-ключевых замыканий
 * каждый ключ остаётся отдельной definition (реактивность id-ключа обеспечивает
 * FeatureManager) — поведение при миграции не меняется.
 */
export function handlerFeature(opts: HandlerFeatureOptions): FeatureDefinition {
  const { handler, plugins = [], ...def } = opts;
  return {
    ...def,
    reapplyOnNavigate: def.reapplyOnNavigate ?? handler.reapplyOnNavigate,
    reapplyOnUpdate: def.reapplyOnUpdate ?? handler.reapplyOnUpdate,
    matchPath: def.matchPath ?? handler.matchPath,
    plugins: [...plugins, handlerPlugin(handler)],
  };
}
