/**
 * Хелпер для «чистых» CSS-фич: единственное поведение — переключить маркер
 * `data-vkify-<id>` на <html>, по которому срабатывают colocated-стили
 * (агрегируются в styles/features.css). Никакого состояния, DOM-логики и teardown.
 *
 * Это самый частый класс фич в расширении (точечное скрытие, фильтры, раскладка
 * сайдбара и т.п.). Раньше каждая требовала ~4 строки руками
 * (`{ enable: () => mgr.enableCss(id), disable: () => mgr.disableCss(id) }`) плюс
 * отдельную строку метадаты в describeFeatures. Теперь — один вызов:
 *
 * @example
 * cssFeature({
 *   id: 'fixed_sidebar',
 *   name: 'Фиксированный сайдбар',
 *   category: 'appearance',
 *   cssFiles: 'appearance/sidebar/fixed-sidebar.css',
 * });
 *
 * Под капотом это обычный FeatureDefinition (см. feature-definition.ts) с одним
 * плагином `cssPlugin` — никакой логики, только маркер. Фаза по умолчанию
 * `early-css` (визуальный CSS применяется раньше тяжёлых фич). Реактивность
 * самого id-ключа обеспечивает FeatureManager, поэтому settingsPlugin тут не нужен.
 */

import type { FeatureDefinition } from './feature-definition.js';
import type { FeatureCategory, FeatureImpact, FeaturePhase } from './feature-registry.js';
import { cssPlugin } from './feature-plugin.js';

export interface CssFeatureOptions {
  readonly id: string;
  readonly name: string;
  readonly category: FeatureCategory;
  /** Путь(и) к colocated `.css` относительно src/content/features. */
  readonly cssFiles: string | readonly string[];
  /** По умолчанию 'early-css' (визуальный CSS — раньше остального). */
  readonly phase?: FeaturePhase;
  readonly initOrder?: number;
  /** По умолчанию 'light' (маркер на <html> — копеечная операция). */
  readonly impact?: FeatureImpact;
  readonly enabledByDefault?: boolean;
  readonly reapplyOnNavigate?: boolean;
  readonly tags?: readonly string[];
}

/** Строит FeatureDefinition для чистой CSS-маркер-фичи (один cssPlugin). */
export function cssFeature(opts: CssFeatureOptions): FeatureDefinition {
  const cssFiles = typeof opts.cssFiles === 'string' ? [opts.cssFiles] : opts.cssFiles;
  return {
    id: opts.id,
    name: opts.name,
    category: opts.category,
    impact: opts.impact ?? 'light',
    phase: opts.phase ?? 'early-css',
    initOrder: opts.initOrder,
    enabledByDefault: opts.enabledByDefault,
    reapplyOnNavigate: opts.reapplyOnNavigate,
    cssFiles,                 // метадата (интроспекция/аудит)
    settingsKeys: [opts.id],  // метадата; реактивность id-ключа делает FeatureManager
    tags: opts.tags,
    plugins: [cssPlugin(cssFiles)],
  };
}
