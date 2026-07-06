/**
 * Русский словарь content-скриптов (язык-фолбэк). Плоское дерево по фиче-
 * областям; ключи читаются через `t('область.ключ')`. Растёт по мере миграции
 * фич — держим синхронно с `en.ts` (те же ключи).
 */
import type { Dict } from './index.js';

export const RU: Dict = {
  download: {
    common: {
      error: 'Ошибка',
    },
    photo: {
      aria: 'Скачать фото в максимальном качестве',
      btn: 'Скачать',
      loading: 'Загрузка…',
      no_id: 'Нет ID',
      api_error: 'Ошибка API',
      no_sizes: 'Нет sizes',
      no_url: 'Нет ссылки',
      done: 'Готово ✓',
    },
    album: {
      btn: 'Скачать альбом',
      tooltip: 'Скачать альбом (ZIP)',
      confirm:
        'Скачать ВСЕ фото из этого альбома?\n\n' +
        'Будет создан ZIP-архив (или несколько по 500 фото для больших альбомов).',
      job_title: 'Альбом фото',
      preparing: 'Подготовка…',
      stopping: 'Останавливаю, сохраняю готовое…',
      downloaded: 'Скачано {{done}}/{{total}}',
      done: 'Готово: {{ok}}/{{total}}',
      cancelled: 'Остановлено: {{ok}}/{{total}}',
      failed_suffix: ' (ошибок: {{count}})',
    },
    music: {
      aria: 'Скачать трек',
      track: 'Трек',
      no_track: 'Нет трека',
      queued: 'В очереди',
      fetching: 'Получение ссылки',
      saving: 'Сохранение',
      done: 'Готово',
    },
    clip: {
      btn: 'Скачать клип',
    },
    center: {
      title: 'Загрузки',
      close: 'Закрыть панель (загрузки продолжатся)',
      job_default: 'Загрузка',
      cancel: 'Отменить',
      queued: 'В очереди…',
      done: 'Готово',
      error: 'Ошибка',
      in_progress: '{{count}} в работе',
      all_done: 'готово',
    },
  },
  embed: {
    iframe_title: 'VKify · Настройки',
    menu_item: 'Настройки VKify',
  },
  widget: {
    collapse: 'Свернуть',
    collapse_toggle: 'Свернуть/развернуть',
    close: 'Закрыть',
  },
  perf: {
    na: 'н/д',
    mb: '{{value}} МБ',
    ms: '{{value}} мс',
    load: 'Загрузка',
    features: 'Активных фич',
    heavy: 'Тяжёлых',
    api: 'API/мин',
    mutations: 'Мутации',
    hint: 'API-вызовы за 60 c · клик — дашборд',
    close_title: 'Закрыть (выключить мини-виджет)',
    body_title: 'Открыть полный дашборд',
  },
  welcome: {
    title: 'Добро пожаловать!',
    subtitle: 'VKify успешно установлен',
    features: {
      appearance_title: 'Внешний вид',
      appearance_desc: 'Темы, шрифты, обои, фильтры — VK как вам нравится',
      ads_title: 'Блокировка рекламы',
      ads_desc: 'Реклама в ленте, баннеры и трекеры — отключаем',
      privacy_title: 'Приватность',
      privacy_desc: 'Скрытие диалогов, шифрование сообщений',
      chats_title: 'Удобство в чатах',
      chats_desc: 'Копирование одной кнопкой, заметки, экспорт диалогов',
      spy_title: 'Онлайн-слежка',
      spy_desc: 'Уведомления о заходах и активности',
    },
    hint:
      'Откройте настройки иконкой расширения в браузере, ' +
      'нажатием <strong>Ctrl + K</strong> в попапе для поиска любой функции, ' +
      'или прямо на странице <strong>vk.com/vkify_settings</strong>',
    cta: 'Начать использовать',
  },
};
