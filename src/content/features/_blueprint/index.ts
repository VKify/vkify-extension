/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BLUEPRINT: шаблон новой фичи. КОПИРУЙ ОТСЮДА.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Файл компилируется (tsc его проверяет — примеры не протухают), но НИКОГДА не
 * импортируется, поэтому в сборку не попадает. Подробности слоёв и правил — в
 * ARCHITECTURE.md в корне репозитория.
 *
 * ЧЕК-ЛИСТ НОВОЙ ФИЧИ (5 шагов):
 *   1. Ключ настройки:  src/shared/constants/settings-schema.ts — если ключ
 *      должен переживать trust-границу (импорт JSON, shared-theme URL,
 *      site-bridge); тип поля — в src/types/index.ts (ExtensionSettings).
 *   2. Дефолт:          src/shared/constants/defaults.ts (если фича включена
 *      по умолчанию или у ключа небулевый дефолт).
 *   3. Определение:     новая папка src/content/features/<домен>/<фича>/ с
 *      одним из трёх рецептов ниже; colocated `<фича>.css` рядом (агрегируется
 *      в styles/features.css автоматически, правила гейть через
 *      `html[data-vkify-<id>]`).
 *   4. Регистрация:     добавь определение в registerDefinitions(...) доменного
 *      регистратора (src/content/features/<домен>/index.ts).
 *   5. Popup:           тумблер в соответствующей вкладке + запись в
 *      src/popup/constants/functions.ts (иначе Ctrl+K-поиск фичу не найдёт).
 *      Конфликтует с другой фичей? — пара в shared/constants/feature-conflicts.ts.
 *
 * ЖЁСТКИЕ ПРАВИЛА:
 *   • Один API регистрации: manager.registerDefinition(s). Никаких других.
 *   • Одна фича = один settings-id (он же тумблер). Дополнительные ключи-значения
 *     (слайдеры, выпадашки) — это `watch`/settingsKeys ТОЙ ЖЕ фичи, а не
 *     отдельные фичи.
 *   • Метадата, нужная popup'у (конфликты, пресеты), живёт ТОЛЬКО в src/shared/
 *     — popup не может импортировать content-код и наоборот.
 *   • Ресурсы (observers, слушатели, CSS) — только через ctx (ScopedFeatureContext):
 *     они снимаются автоматически на disable/reapply.
 */

import {
  cssFeature,
  derivedCssFeature,
  handlerFeature,
  settingsPlugin,
  scriptPlugin,
  type FeatureDefinition,
} from '@/content/core/features/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// РЕЦЕПТ 1: чистая CSS-фича (≈50% всех фич расширения).
// Поведение — только маркер `data-vkify-<id>` на <html>; правила в colocated CSS:
//
//   /* my-feature.css */
//   html[data-vkify-hide_something] .some-vk-block { display: none !important; }
// ─────────────────────────────────────────────────────────────────────────────
export const example1_cssOnly: FeatureDefinition = cssFeature({
  id: 'hide_something',                       // = ключ настройки (тумблер)
  name: 'Скрыть что-нибудь',
  category: 'hiding',                         // FeatureCategory
  cssFiles: 'hiding/global/hide-something.css', // путь от src/content/features/
  // phase: 'early-css' по умолчанию — CSS применяется до первой отрисовки.
});

// ─────────────────────────────────────────────────────────────────────────────
// РЕЦЕПТ 2: derived-CSS-фича — «N настроек → CSS-переменные / сгенерированный
// CSS». Механика (rAF-коалесинг, дебаунс-персист зеркала, маркер, teardown) —
// в derivedCssPlugin; фича описывает только ЧТО вычислять.
// Живой пример: appearance/layout/widescreen.ts.
// ─────────────────────────────────────────────────────────────────────────────
export const example2_derivedCss: FeatureDefinition = derivedCssFeature({
  id: 'my_effect_enabled',                    // boolean-тоггл
  name: 'Мой эффект',
  category: 'appearance',
  watch: ['my_effect_strength'],              // значение-слайдер: НЕ отдельная фича
  reapplyOnNavigate: true,
  compute: (settings) => {
    const strength = Number(settings['my_effect_strength']) || 0;
    if (strength <= 0) return null;           // null = визуально выключено
    return {
      vars: { '--vkify-my-effect': `${strength}px` }, // инлайн на :root + зеркало
      // css: '.generated { ... }',           // и/или сгенерированный CSS-текст
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// РЕЦЕПТ 3: stateful-фича с императивным ядром (медиа-пайплайны, page-world
// мосты, наблюдатели DOM). Ядро — обычный enable/disable; handlerFeature
// оборачивает его в FeatureDefinition с метадатой. Доп. плагины (settingsPlugin,
// scriptPlugin) — по необходимости.
// ─────────────────────────────────────────────────────────────────────────────
export function createExample3Stateful(): FeatureDefinition {
  let off: (() => void) | null = null;        // состояние — в замыкании

  return handlerFeature({
    id: 'my_stateful_feature',
    name: 'Моя stateful-фича',
    category: 'misc',
    impact: 'medium',                         // прокси нагрузки для perf-дашборда
    requiresDomLayer: true,                   // использует общий DOM-observer
    settingsKeys: ['my_stateful_feature', 'my_stateful_option'],
    plugins: [
      settingsPlugin(['my_stateful_option']), // смена опции → reapply
      // scriptPlugin(InjectedScript.MY_SCRIPT), // page-world скрипт, если нужен
    ],
    handler: {
      enable: (_value) => {
        // _value — «сырое» значение триггера (или undefined при reapply).
        off = () => {};                       // подписки/наблюдатели/UI
      },
      disable: () => {
        off?.();                              // полный teardown — парный к enable
        off = null;
      },
    },
  });
}

// Регистрация (в доменном src/content/features/<домен>/index.ts):
//
//   export function registerMyDomainFeatures(manager: FeatureManager): void {
//     manager.registerDefinitions([
//       example1_cssOnly,
//       example2_derivedCss,
//       createExample3Stateful(),
//     ]);
//   }