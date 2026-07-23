import type { Migration, RawSettings } from './types.js';

// Миграции неизменяемы: не связываем исторический шаг с живым каталогом,
// в котором позднее могут появиться другие hiddenByDefault-пункты.
const YANDEX_BROWSER_MENU_ITEM_ID = 'l_invite_promo';

/**
 * v7 → v8: новый промо-пункт «Яндекс Браузер» скрыт по умолчанию.
 *
 * У существующих пользователей этого пункта ещё не было в настройках, поэтому
 * один раз добавляем его в список скрытых. После миграции пользователь может
 * включить пункт обычным тумблером — повторно значение уже не навязывается.
 */
export const migrateV7ToV8: Migration = {
  to: 8,
  description: 'Hide the Yandex Browser menu promo by default',
  migrate(old: RawSettings): RawSettings {
    const current = Array.isArray(old.hidden_menu_items)
      ? old.hidden_menu_items
      : [];

    if (current.includes(YANDEX_BROWSER_MENU_ITEM_ID)) return { ...old };

    return {
      ...old,
      hidden_menu_items: [...current, YANDEX_BROWSER_MENU_ITEM_ID],
    };
  },
};
