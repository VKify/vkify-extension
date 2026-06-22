import type { FeatureManager } from '@/content/core/feature-manager.js';
import type { FeatureMap } from '@/types/index.js';

/**
 * «Отображаемые пункты меню» — скрывает выбранные пользователем пункты левого
 * меню ВК. Пункты имеют стабильные id (`l_pr`, `l_msg`, `l_aud`, …), поэтому
 * прятать их проще всего одним инжектом CSS: правило `#id{display:none}`
 * переживает перерисовку меню React'ом и применяется до первой отрисовки
 * (injectCSS зеркалится в localStorage — см. injected-css-mirror.ts), так что
 * нет необходимости в MutationObserver.
 *
 * Значение фичи — массив id из chrome.storage (`hidden_menu_items`). Пустой
 * список → правило снимается (shouldEnable вернёт false и вызовет disable).
 */
const CSS_ID = 'hidden_menu_items';

// Пускаем в селектор только id-пунктов вида `l_pr`, `l_msg`. Массив может прийти
// из импорта настроек, поэтому не доверяем содержимому вслепую.
const ITEM_ID = /^l_[A-Za-z0-9_]+$/;

/**
 * Разделители меню — это `<div>` без id, поэтому таргетим их по соседнему
 * пункту через `:has(+ #id)` (display:none у самого пункта не меняет порядок в
 * DOM, так что привязка устойчива). Псевдо-id из popup-каталога (sep_main, …)
 * сопоставляем с реальными селекторами здесь.
 */
const SEPARATOR_SELECTORS: Readonly<Record<string, string>> = {
  sep_main: 'div[class*="eparator"]:has(+ #l_mini_apps)',
  sep_services: 'div[class*="eparator"]:has(+ #l_fav)',
};

function selectorFor(id: string): string | null {
  if (Object.prototype.hasOwnProperty.call(SEPARATOR_SELECTORS, id)) {
    return SEPARATOR_SELECTORS[id];
  }
  return ITEM_ID.test(id) ? `#${id}` : null;
}

export function createMenuItemsFeature(manager: FeatureManager): FeatureMap {
  function apply(value: unknown): void {
    const selectors = Array.isArray(value)
      ? (value as unknown[])
          .map((id) => (typeof id === 'string' ? selectorFor(id) : null))
          .filter((s): s is string => s !== null)
      : [];

    if (selectors.length === 0) {
      manager.removeCSS(CSS_ID);
      return;
    }

    // По одному правилу на селектор: если браузер не поддерживает `:has`,
    // невалидное правило-разделитель отбрасывается само, не ломая остальные.
    const css = selectors.map((s) => `${s}{display:none!important}`).join('');
    manager.injectCSS(CSS_ID, css);
  }

  return {
    hidden_menu_items: {
      enable: (value?: unknown) => apply(value),
      disable: () => manager.removeCSS(CSS_ID),
    },
  };
}
