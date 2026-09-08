import type { Migration, RawSettings } from './types.js';

/** v9 → v10: рекомендации сообществ и перенос промопункта из скрытия меню. */
export const migrateV9ToV10: Migration = {
  to: 10,
  description: 'Add similar communities and move the Yandex Browser menu promo to ads',
  migrate(old: RawSettings): RawSettings {
    const next = { ...old };
    const promoIds = ['l_invite_menu_promo', 'l_invite_promo'];
    const hiddenItems = Array.isArray(old.hidden_menu_items) ? old.hidden_menu_items : null;

    if (typeof next.block_recommendations_communities !== 'boolean') {
      next.block_recommendations_communities = true;
    }
    if (typeof next.block_yandex_browser_promo !== 'boolean') {
      next.block_yandex_browser_promo = hiddenItems === null
        ? true
        : hiddenItems.some(id => promoIds.includes(id as string));
    }
    if (hiddenItems !== null) {
      next.hidden_menu_items = hiddenItems.filter(id => !promoIds.includes(id as string));
    }
    return next;
  },
};
