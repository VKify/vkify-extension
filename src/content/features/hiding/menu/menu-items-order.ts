import { derivedCssFeature, type FeatureDefinition } from '@/content/core/features/index.js';
import { normalizeMenuOrder, selectorsForMenuItem } from '@/shared/constants/menu-items.js';

const MENU = 'ol:has(> li[data-testid="leftmenuitem"])';

export function buildMenuOrderCss(value: unknown): string | null {
  if (!Array.isArray(value) || !value.length) return null;
  const order = normalizeMenuOrder(value);
  // CSS сохраняет React-узлы на месте и переживает повторную отрисовку VK.
  return `${MENU}{display:flex!important;flex-direction:column!important}`
    // Tie unmanaged tail entries to the final controlled item. Native DOM order
    // keeps the pinned-community separator/links ahead of an appended VKify link.
    + `${MENU}>*{order:${order.length - 1}!important}`
    // This optional promo belongs to the services group, not the pinned tail.
    + `${MENU}>#l_invite_menu_promo{order:${order.indexOf('l_buy_votes')}!important}`
    + order.flatMap((id, index) => selectorsForMenuItem(id).map(
      (selector) => `${MENU}>${selector}{order:${index}!important}`,
    )).join('');
}

export const menuItemsOrderFeature: FeatureDefinition = derivedCssFeature({
  id: 'menu_items_order',
  name: 'Порядок пунктов меню',
  category: 'hiding',
  marker: false,
  reapplyOnUpdate: true,
  compute: (settings) => {
    const css = buildMenuOrderCss(settings['menu_items_order']);
    return css ? { css } : null;
  },
});
