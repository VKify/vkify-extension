/**
 * Единый каталог управляемых пунктов левого меню VK.
 *
 * Popup строит по нему список тумблеров, а content script берёт отсюда реальные
 * CSS-селекторы. Чтобы добавить новый пункт, достаточно одной записи в группе;
 * для обычного элемента с id используется `#id`, для нестандартной разметки
 * можно передать селекторы и стартовое состояние в options объекта `menuItem`.
 */
export interface MenuItemDefinition {
  readonly id: string;
  readonly name: string;
  readonly selectors: readonly string[];
  readonly hiddenByDefault: boolean;
}

export interface MenuItemGroup {
  readonly id: string;
  readonly title: string;
  readonly items: readonly MenuItemDefinition[];
  readonly separatorAfter?: MenuItemDefinition;
}

function menuItem(
  id: string,
  name: string,
  options: {
    readonly selectors?: readonly string[];
    readonly hiddenByDefault?: boolean;
  } = {},
): MenuItemDefinition {
  return Object.freeze({
    id,
    name,
    selectors: Object.freeze([...(options.selectors ?? [`#${id}`])]),
    hiddenByDefault: options.hiddenByDefault ?? false,
  });
}

export const MENU_ITEM_GROUPS: readonly MenuItemGroup[] = Object.freeze([
  {
    id: 'main',
    title: 'Основные',
    items: Object.freeze([
      menuItem('l_pr', 'Профиль'),
      menuItem('l_nwsf', 'Лента'),
      menuItem('l_msg', 'Мессенджер'),
      menuItem('l_ca', 'Звонки'),
      menuItem('l_fr', 'Друзья'),
      menuItem('l_gr', 'Сообщества'),
      menuItem('l_ph', 'Фото'),
      menuItem('l_aud', 'Музыка'),
      menuItem('l_vid', 'Видео'),
      menuItem('l_svd', 'Клипы'),
      menuItem('l_ap', 'Игры'),
      menuItem('l_stickers', 'Стикеры'),
      menuItem('l_mk', 'Маркет'),
    ]),
    separatorAfter: menuItem('sep_main', 'Разделитель', {
      selectors: ['div[class*="eparator"]:has(+ #l_mini_apps)'],
    }),
  },
  {
    id: 'services',
    title: 'Сервисы',
    items: Object.freeze([
      menuItem('l_mini_apps', 'Сервисы'),
      menuItem('l_buy_votes', 'Голоса'),
      menuItem('l_invite_promo', 'Яндекс Браузер', { hiddenByDefault: true }),
    ]),
    separatorAfter: menuItem('sep_services', 'Разделитель', {
      selectors: ['div[class*="eparator"]:has(+ #l_fav)'],
    }),
  },
  {
    id: 'personal',
    title: 'Личное',
    items: Object.freeze([
      menuItem('l_fav', 'Закладки'),
      menuItem('l_doc', 'Файлы'),
      menuItem('l_ads', 'Реклама'),
      menuItem('l_faq', 'Помощь'),
    ]),
  },
]);

/** Плоский список пунктов и разделителей для валидации/интеграций. */
export const MENU_ITEMS: readonly MenuItemDefinition[] = Object.freeze(
  MENU_ITEM_GROUPS.flatMap((group) => [
    ...group.items,
    ...(group.separatorAfter ? [group.separatorAfter] : []),
  ]),
);

export const MENU_ITEM_IDS: readonly string[] = Object.freeze(
  MENU_ITEMS.map((item) => item.id),
);

export const DEFAULT_HIDDEN_MENU_ITEM_IDS: readonly string[] = Object.freeze(
  MENU_ITEMS.filter((item) => item.hiddenByDefault).map((item) => item.id),
);

const MENU_ITEM_SELECTORS: Readonly<Record<string, readonly string[]>> = Object.freeze(
  Object.fromEntries(MENU_ITEMS.map((item) => [item.id, item.selectors])),
);

/** Возвращает только селекторы пунктов из доверенного каталога. */
export function selectorsForMenuItem(id: string): readonly string[] {
  return Object.prototype.hasOwnProperty.call(MENU_ITEM_SELECTORS, id)
    ? MENU_ITEM_SELECTORS[id]
    : [];
}
