/**
 * Реестр функций расширения для глобального поиска (Ctrl+K в попапе).
 *
 * Это hand-curated список — потому что часть настроек в схеме не имеет
 * собственной UI-секции (например, спайные internal-флаги), а у некоторых
 * UI-секций нет 1-к-1 ключа в schema (вроде «Открыть VK», «Очистить заметки»).
 * Когда добавляете новую фичу — добавьте запись сюда, иначе поиск её не найдёт.
 *
 * `tab` — id вкладки из constants/tabs.ts. По клику в палитре активируется
 * именно эта вкладка, и пользователь сразу видит контрол.
 */

export interface FunctionEntry {
  /** Уникальный идентификатор (обычно совпадает с ключом настройки). */
  id: string;
  /** Заголовок — что пользователь будет искать. */
  title: string;
  /** Краткое описание под заголовком. */
  desc?: string;
  /** id вкладки, к которой относится функция. */
  tab: string;
  /** Дополнительные слова для поиска (синонимы, англ.-версии). */
  keywords?: string[];
}

export const FUNCTIONS: FunctionEntry[] = [
  // ── Вид ────────────────────────────────────────────────────────────────
  { id: 'custom_theme',          title: 'Цветовая тема',        desc: 'Палитра, фон и акцент',           tab: 'appearance', keywords: ['theme', 'colors', 'dark', 'light'] },
  { id: 'custom_background',     title: 'Фон страницы',         desc: 'Картинка, видео, эффекты, фильтры', tab: 'appearance', keywords: ['wallpaper', 'background', 'обои', 'blur', 'эффекты', 'затемнение'] },
  { id: 'custom_font',           title: 'Шрифт интерфейса',     desc: 'Сменить шрифт и размер',          tab: 'appearance', keywords: ['font', 'размер'] },
  { id: 'visual_filters',        title: 'Визуальные фильтры',   desc: 'Ч/б, инверсия, высокий контраст', tab: 'appearance', keywords: ['filter', 'grayscale', 'invert'] },
  { id: 'display_mode',          title: 'Режим отображения',    desc: 'Широкий, компактный, минимализм', tab: 'appearance', keywords: ['layout', 'widescreen', 'compact'] },
  { id: 'share_theme',           title: 'Поделиться темой',     desc: 'Сгенерировать ссылку на тему',    tab: 'appearance', keywords: ['share', 'export theme'] },

  // ── Элементы ───────────────────────────────────────────────────────────
  { id: 'hide_stories',          title: 'Скрыть истории',       desc: 'Лента историй в верху ленты',     tab: 'elements', keywords: ['stories', 'reels'] },
  { id: 'hide_recommendations',  title: 'Скрыть рекомендации',  desc: 'Блок «Рекомендуем» в ленте',      tab: 'elements' },
  { id: 'hide_friends_suggestions', title: 'Скрыть «возможные друзья»', desc: 'Карусель в шапке',         tab: 'elements' },
  { id: 'hide_emoji_status',     title: 'Скрыть emoji-статус',  desc: 'Эмодзи у имени в шапке',          tab: 'elements' },
  { id: 'hide_mini_chat',        title: 'Скрыть мини-чат',      desc: 'Плавающий чат в углу',            tab: 'elements' },
  { id: 'hide_scroll_top',       title: 'Скрыть «наверх»',      desc: 'Кнопка прокрутки вверх',          tab: 'elements' },
  { id: 'hide_menu_settings',    title: 'Скрыть «Настройки» в меню', desc: 'Пункт в боковом меню',       tab: 'elements' },
  { id: 'hide_auth_popup',       title: 'Скрыть попап входа',   desc: 'Уведомление о новом сеансе',      tab: 'elements' },

  // ── Реклама ────────────────────────────────────────────────────────────
  { id: 'block_left_ads',        title: 'Скрыть левый блок рекламы', tab: 'ads', keywords: ['ads', 'banner'] },
  { id: 'block_feed_ads_api',    title: 'Резать рекламу в API',      desc: 'Удаление промопостов на уровне ответа сервера', tab: 'ads', keywords: ['ads', 'feed'] },
  { id: 'block_feed_ads_dom',    title: 'Резать рекламу в DOM',      desc: 'Резерв на случай, если API-фильтр не сработал',  tab: 'ads' },
  { id: 'block_trackers',        title: 'Блокировка трекеров',       desc: 'Метрика, аналитика, пиксели', tab: 'ads', keywords: ['trackers', 'analytics', 'metrika'] },

  // ── Скрипты (автоматизация) ────────────────────────────────────────────
  { id: 'auto_add_friends',      title: 'Авто-добавление друзей', desc: 'Заявки на странице поиска', tab: 'scripts', keywords: ['friends', 'auto'] },
  { id: 'keyboard_layout_switch', title: 'Смена раскладки',      desc: 'Конвертация ru↔en хоткеем', tab: 'scripts', keywords: ['layout', 'keyboard'] },
  { id: 'bypass_away_links',     title: 'Обход away.php',       desc: 'Прямые ссылки минуя редирект VK', tab: 'scripts', keywords: ['away', 'redirect'] },
  { id: 'message_quick_copy',    title: 'Быстрое копирование сообщений', desc: 'Кнопка «копировать» у каждого сообщения. Shift+клик — диапазон', tab: 'center', keywords: ['copy', 'clipboard', 'сообщения'] },
  { id: 'dialog_export_enabled', title: 'Экспорт диалога',      desc: 'Скачать переписку (JSON/TXT/HTML/ZIP)', tab: 'center', keywords: ['export', 'download', 'архив', 'сообщения'] },
  { id: 'message_pin_notes',     title: 'Заметки из сообщений', desc: 'Сохранять сообщения в локальный архив', tab: 'center', keywords: ['pin', 'bookmark', 'save', 'заметки'] },

  // ── Приватность ────────────────────────────────────────────────────────
  { id: 'message_crypto',        title: 'Шифрование сообщений', desc: 'COFFEE и VKify E2E (AES-256-GCM)', tab: 'privacy', keywords: ['encryption', 'crypto', 'aes'] },
  { id: 'hide_online',           title: 'Скрыть онлайн-статус', desc: 'Невидимка — вас не видно в сети (и вы не видите чужой онлайн)', tab: 'privacy', keywords: ['online', 'invisible', 'невидимка', 'офлайн', 'offline'] },
  { id: 'prevent_typing',        title: 'Не показывать «печатает»', desc: 'Собеседник не увидит, что вы набираете',  tab: 'privacy', keywords: ['typing'] },
  { id: 'prevent_read',          title: 'Не отмечать прочитанным', desc: 'Сообщения остаются непрочитанными',         tab: 'privacy', keywords: ['read', 'seen'] },
  { id: 'hide_dialogs_hotkey',   title: 'Скрыть переписки хоткеем', desc: 'Мгновенно прячет список чатов', tab: 'privacy', keywords: ['panic', 'hide', 'boss'] },
  { id: 'hidden_dialogs',        title: 'Скрытые диалоги',      desc: 'Список спрятанных чатов',          tab: 'privacy' },
  { id: 'blur_on_unfocus',       title: 'Размытие при потере фокуса', desc: 'Прячет содержимое, когда переключаетесь на другое окно', tab: 'privacy', keywords: ['blur', 'focus'] },

  // ── Слежка ─────────────────────────────────────────────────────────────
  { id: 'spy_online',            title: 'Онлайн-мониторинг',    desc: 'Отслеживание заходов выбранных пользователей', tab: 'onlinespy', keywords: ['spy', 'online'] },
  { id: 'profile_spy',           title: 'Слежка за профилем',   desc: 'Изменения аватара, статуса, друзей', tab: 'onlinespy', keywords: ['profile', 'spy'] },
  { id: 'spy_activity',          title: 'Активность в чатах',   desc: 'Печатает, читает, удаляет — на основе LongPoll', tab: 'onlinespy', keywords: ['typing', 'activity'] },

  // ── Медиа ──────────────────────────────────────────────────────────────
  { id: 'video_download',        title: 'Скачать видео',        desc: 'Кнопка скачивания на странице видео', tab: 'media', keywords: ['video', 'download'] },
  { id: 'story_download',        title: 'Скачать историю',      desc: 'Скачивание сторис',                  tab: 'media', keywords: ['story', 'download'] },
  { id: 'clip_download',         title: 'Скачать клип',         desc: 'Сохранение VK Clips',                tab: 'media', keywords: ['clip', 'reels', 'download'] },
  { id: 'photo_download',        title: 'Скачать фото',         desc: 'Кнопка у фото и альбомов',           tab: 'media', keywords: ['photo', 'download', 'album'] },

  // ── Плеер (вкладка «Центр») ─────────────────────────────────────────────
  { id: 'media_player_hotkeys',  title: 'Хоткеи плеера',        desc: 'Управление аудиоплеером VK с клавиатуры', tab: 'center', keywords: ['hotkey', 'keyboard', 'плеер', 'player', 'музыка'] },

  // ── Шаблоны ────────────────────────────────────────────────────────────
  { id: 'message_templates_enabled', title: 'Шаблоны сообщений', desc: 'Быстрая вставка по слэшу/хоткею', tab: 'center', keywords: ['templates', 'snippets', 'autotext', 'шаблоны', 'сообщения'] },

  // ── Заметки ────────────────────────────────────────────────────────────
  { id: 'notes_view',            title: 'Просмотр заметок',     desc: 'Сохранённые сообщения из ВК',     tab: 'center', keywords: ['notes', 'saved', 'заметки', 'сообщения'] },

  // ── CSS ────────────────────────────────────────────────────────────────
  { id: 'custom_css_enabled',    title: 'Свой CSS',             desc: 'Редактор пользовательских стилей', tab: 'css', keywords: ['css', 'styles'] },

  // ── Ещё ────────────────────────────────────────────────────────────────
  { id: 'export_settings',       title: 'Экспорт настроек',     desc: 'Сохранить все настройки в JSON',   tab: 'more', keywords: ['backup', 'export'] },
  { id: 'import_settings',       title: 'Импорт настроек',      desc: 'Загрузить настройки из файла',     tab: 'more', keywords: ['restore', 'import'] },
  { id: 'reset_settings',        title: 'Сбросить настройки',   desc: 'Вернуть значения по умолчанию',    tab: 'more', keywords: ['reset', 'default'] },
];
