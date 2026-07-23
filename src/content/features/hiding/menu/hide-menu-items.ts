import { derivedCssFeature, type FeatureDefinition } from '@/content/core/features/index.js';
import { selectorsForMenuItem } from '@/shared/constants/menu-items.js';

/**
 * «Отображаемые пункты меню» — скрывает выбранные пользователем пункты левого
 * меню ВК. Пункты и их селекторы описаны в общем каталоге menu-items.ts,
 * поэтому новая или нестандартная разметка не требует правок этой фичи.
 * Скрытие выполняется одним инжектом CSS: правило `selector{display:none}`
 * переживает перерисовку меню React'ом и применяется до первой отрисовки
 * (injectCSS зеркалится в localStorage — см. injected-css-mirror.ts), так что
 * нет необходимости в MutationObserver.
 *
 * Значение фичи — массив id из chrome.storage (`hidden_menu_items`). Пустой
 * список → shouldEnable вернёт false и фича выключится (CSS снят); механика
 * инжекта/teardown — derivedCssPlugin.
 */

export function buildHiddenMenuItemsCss(value: unknown): string | null {
  if (!Array.isArray(value)) return null;

  const selectors = new Set<string>();
  for (const id of value) {
    if (typeof id !== 'string') continue;
    for (const selector of selectorsForMenuItem(id)) selectors.add(selector);
  }

  if (selectors.size === 0) return null;

  // По одному правилу на селектор: если браузер не поддерживает `:has`,
  // невалидное правило-разделитель отбрасывается само, не ломая остальные.
  return [...selectors].map((selector) => `${selector}{display:none!important}`).join('');
}

export const hideMenuItemsFeature: FeatureDefinition = derivedCssFeature({
  id: 'hidden_menu_items',
  name: 'Скрытые пункты меню',
  category: 'hiding',
  marker: false,               // поведение целиком в инжектируемом CSS
  reapplyOnUpdate: true,       // смена набора пунктов — мягкий пересчёт
  compute: (settings) => {
    const css = buildHiddenMenuItemsCss(settings['hidden_menu_items']);
    return css ? { css } : null;
  },
});
