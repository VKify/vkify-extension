<div align="center">
  <img src=".github/assets/logo.png" alt="VKify" width="96" />

  # VKify

  **Расширение для Chrome, которое делает ВКонтакте удобнее, красивее и приватнее**

  [![Website](https://img.shields.io/badge/vkify.ru-0077FF?style=for-the-badge&logo=googlechrome&logoColor=white)](https://vkify.ru)
  [![Telegram](https://img.shields.io/badge/Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/VKify)
  [![VK](https://img.shields.io/badge/VK-4C75A3?style=for-the-badge&logo=vk&logoColor=white)](https://vk.com/vkify)
  [![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/VKify/vkify-extension)

  ![Version](https://img.shields.io/badge/версия-1.3.0-blue?style=flat-square)
  ![Chrome](https://img.shields.io/badge/Chrome-105+-4285F4?style=flat-square&logo=googlechrome&logoColor=white)
  ![Manifest](https://img.shields.io/badge/Manifest-V3-34A853?style=flat-square)
  ![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
  ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
  ![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite&logoColor=white)
  ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)

  [English version →](README.en.md)

  <br/>

  <img src=".github/assets/extension-preview.png" alt="VKify Preview" width="100%" />
</div>

---

## Возможности

### 🎨 Внешний вид (`Вид`)
- 70+ готовых тем и тонкая настройка своими цветами
- 60+ шрифтов и фоновые обои — картинки, видео, анимации
- Регулировка скруглений, ширины контента, смещения страницы
- Визуальные фильтры — ч/б, сепия, инверсия, высокий контраст и др.
- Компактный режим, минималистичное и фиксированное меню
- Редактор своего CSS со снипетами и подсветкой синтаксиса

### 🧩 Элементы (`Элементы`)
- Прячьте то, что не нужно: истории, рекомендации, эмодзи-статус, мини-чат, кнопку «наверх», баннеры и пр.

### 🛡️ Реклама (`Реклама`)
- Реклама в ленте — два независимых фильтра (один режет до показа, второй чистит то, что просочилось)
- Боковые баннеры
- Блокировка трекеров и счётчиков
- Свой список слов для блокировки и whitelist
- Журнал заблокированного, чтобы видеть, что и за что было скрыто

### 🔒 Приватность (`Приватность`)
- Шифрование сообщений — современный формат VKify E2E и совместимый COFFEE (Kate Mobile, VK Coffee, Laney, Vika)
- Скрытие конкретных диалогов
- Горячая клавиша «спрятать переписку» одним нажатием
- Размытие страницы, когда окно теряет фокус
- Режим-скелетон для маскировки содержимого

### ⚡ Скрипты (`Скрипты`)
- Прямые ссылки — обход редиректа `away.php`
- Автодобавление в друзья по таймеру
- Переключатель раскладки горячей клавишей
- **Быстрое копирование сообщений** — кнопка-копия у каждого сообщения. Shift+клик копирует диапазон сообщений сразу
- **Экспорт диалогов** в JSON, TXT, HTML, HTML с фото внутри файла, ZIP-архив с папкой `photos/`. Есть встроенный поиск в экспорте и опция «расшифровать сохранённым ключом»
- **Заметки из сообщений** — сохраняет любое сообщение в локальный архив, доступный во вкладке «Заметки»

### 👁️ Слежка (`Слежка`)
- Активность в сообщениях — печатает, читает, удаляет, заходит в звонок и т.п.
- Онлайн-мониторинг с историей и графиками
- Отслеживание профилей — смена аватара, статуса, числа друзей
- Браузерные уведомления, отдельный список и журнал для каждой подсистемы

### 💬 Шаблоны (`Шаблоны`)
- Свои шаблоны сообщений с переменными (`%имя%`, `%время%`, `%дата%`, `%br%`)
- Триггеры — «/» в начале строки, горячая клавиша, автоподсказка
- Опция «отправлять сразу» без подтверждения

### 📌 Заметки (`Заметки`)
- Локальный архив сохранённых сообщений
- Поиск по тексту, автору, названию чата
- Копирование и удаление по одному или массово
- Всё хранится только у вас, без серверов

### 🎧 Медиа (`Медиа`)
- Хоткеи плеера — пауза, переключение, перемотка, скорость. Можно сделать глобальными (работают с любой вкладки браузера)
- Скачивание видео и клипов с выбором качества до 1080p
- Скачивание историй (фото и видео) одним нажатием
- Скачивание фото или целого альбома в подпапку

### 💻 CSS (`CSS`)
- Встроенный редактор с подсветкой и автоматическим форматированием
- Готовые сниппеты, импорт/экспорт

### ⚙️ Прочее (`Ещё`)
- Тур по возможностям при первом открытии
- Экспорт / импорт настроек, сброс к дефолтам
- **Поиск по функциям** — `Ctrl/Cmd+K` открывает палитру со всеми возможностями расширения. Выбор результата — попап сам прыгает к нужной секции и подсвечивает её
- **⭐ Избранные функции** — отмечайте те, которыми пользуетесь чаще: они закрепляются сверху списка
- **Быстрые действия в шапке** попапа — поиск, тема, реклама, обновление активной вкладки
- **Настройки прямо на странице VK** — откройте `vk.com/vkify_settings` или выберите «Настройки VKify» в выпадающем меню профиля
- Поддержка vk.com, vk.ru, vkvideo.ru

---

## Установка и использование

**Готовое расширение** — установите из [Chrome Web Store](https://vkify.ru) (ссылка на актуальную версию — на сайте проекта).

**Из исходников** (для разработки или ручной установки):

```bash
git clone https://github.com/VKify/vkify-extension.git
cd vkify-extension
npm install
npm run build          # соберёт расширение в dist/
```

Затем `chrome://extensions` → включите «Режим разработчика» → «Загрузить
распакованное» → выберите папку `dist/`. Обновите открытые вкладки vk.com.

**Как пользоваться:**

- Нажмите иконку VKify на панели браузера — откроется попап с настройками (10 вкладок).
- Или откройте `vk.com/vkify_settings` (либо пункт «Настройки VKify» в меню профиля) — те же настройки прямо на странице VK.
- `Ctrl/Cmd + K` в попапе — поиск по всем функциям расширения.
- Настройки применяются мгновенно и синхронизируются между попапом и страницей.

---

## Архитектура

Расширение состоит из четырёх независимых слоёв, которые общаются через Chrome Storage и Message API:

```
┌─────────────────┐     chrome.runtime      ┌──────────────────┐
│  popup (React)  │ ◄──────────────────────  │  background SW   │
│  UI настроек    │  ───────────────────────► │  VK API, алармы  │
└─────────────────┘                           └──────────────────┘
                                                       │
                                             chrome.tabs.sendMessage
                                                       │
                                            ┌──────────▼──────────┐
                                            │   content script    │
                                            │   фичи на странице  │
                                            └─────────────────────┘
                                                       │
                                            ┌──────────▼──────────┐
                                            │  injected scripts   │
                                            │  page context (spy, │
                                            │  ad blocker, bridge)│
                                            └─────────────────────┘
```

- **background** — сервис-воркер: запросы к VK API, управление алармами и уведомлениями
- **content** — контент-скрипты: применяют CSS/JS прямо в интерфейсе VK, управляют фичами через `FeatureManager`
- **injected** — скрипты в page context (обход sandbox): перехват WebSocket событий (spy), блокировка рекламы на уровне API, антитрекинг
- **popup** — React-приложение в попапе: интерфейс настроек (10 вкладок)
- **site-bridge** — контент-скрипт для vkify.ru: передаёт настройки с сайта в расширение (на `http://localhost/*` — **только в dev-сборке**)

### Безопасность

- **Канонический реестр настроек** `shared/constants/settings-schema.ts` — единственный источник истины: из него деривятся все whitelist'ы и единый валидатор для shared-тем, импорта файла и site-bridge
- **Per-session nonce** на канале `postMessage` токена/native-API между content и injected; токен VK больше не выскрапливается из чужих fetch
- **CSP** `script-src 'self'`; все исходящие `postMessage` пинятся к конкретному origin (никаких `'*'`)
- **`http://localhost/*`** для site-bridge присутствует только в dev-манифесте, не в продакшене
- Единый shared-координатор `fetch` (один wrapper на все injected-скрипты вместо стека из четырёх)
- **Env-aware ссылки на сайт-компаньон** (`shared/constants/site.ts`): `SITE_URL` подставляется на этапе сборки через Vite `define` (`__VKIFY_SITE_URL__`). Все исходящие ссылки (welcome / changelog / uninstall / share theme / popup-кнопка сайта / каталог обоев) и `manifest.homepage_url` в dev указывают на `http://localhost:5173`, в prod — на `https://vkify.ru`. Никаких хардкодов домена

---

## Структура проекта

```
vkify/
├── src/
│   ├── __tests__/                          # Тесты (Vitest)
│   │   ├── highlighter.test.ts             # Подсветка CSS
│   │   ├── message-crypto.test.ts          # FIPS 197 / NIST KAT / GCM integrity (100 кейсов)
│   │   ├── message-handler.test.ts         # Роутинг сообщений background
│   │   ├── message-handler-theme.test.ts   # Применение общей темы (декод + санитизация)
│   │   ├── page-channel.test.ts            # Nonce-гейт postMessage-канала
│   │   ├── settings-schema.test.ts         # Валидация/санитизация настроек по scope
│   │   ├── should-enable.test.ts           # Логика включения фич
│   │   ├── spy-events.test.ts              # Разбор событий LongPoll (парсер слежки)
│   │   ├── spy-tracker.test.ts             # Онлайн-трекер (background)
│   │   ├── ttl-cache.test.ts               # TTL-кэш: истечение, вытеснение
│   │   ├── vk-api.test.ts                  # Токен-флоу VK API
│   │   └── zip.test.ts                     # ZIP-writer: CRC-32, структура архива
│   │
│   ├── background/                         # Сервис-воркер
│   │   ├── handlers/
│   │   │   └── message-handler.ts          # Роутинг входящих сообщений
│   │   ├── services/
│   │   │   ├── alarm-manager.ts            # Расписание опросов (spy)
│   │   │   ├── notification-service.ts     # Браузерные уведомления
│   │   │   └── spy-tracker.ts              # Логика слежки за пользователями
│   │   ├── utils/
│   │   │   ├── storage.ts                  # Работа с chrome.storage
│   │   │   ├── tabs.ts                     # Управление вкладками
│   │   │   └── vk-api.ts                   # Обёртка над VK API
│   │   └── index.ts
│   │
│   ├── content/                            # Контент-скрипты
│   │   ├── api/
│   │   │   └── vk-api-client.ts            # HTTP-клиент для VK API (через shared/utils/vk-fetch)
│   │   ├── core/
│   │   │   ├── app.ts                      # Точка входа, инициализация
│   │   │   ├── feature-manager.ts          # Реестр и жизненный цикл фич
│   │   │   ├── css-manager.ts              # Инъекция и удаление CSS
│   │   │   ├── script-injector.ts          # Внедрение скриптов в page context
│   │   │   ├── should-enable.ts            # Проверка применимости фичи
│   │   │   └── storage.ts                  # Локальный кэш настроек
│   │   ├── features/
│   │   │   ├── appearance/
│   │   │   │   ├── background.ts           # Обои (image/video/web)
│   │   │   │   ├── border-radius.ts        # Скругление элементов
│   │   │   │   ├── compact-spacing.ts      # Компактный режим
│   │   │   │   ├── filters.ts              # Визуальные фильтры
│   │   │   │   ├── fontManager.ts          # Подключение шрифтов
│   │   │   │   ├── header.ts               # Настройки шапки VK
│   │   │   │   ├── hide-elements.ts        # Скрытие блоков интерфейса
│   │   │   │   ├── page-offset.ts          # Смещение страницы
│   │   │   │   ├── sidebar.ts              # Компактный/фиксированный сайдбар
│   │   │   │   ├── theme.ts                # Применение цветовой темы
│   │   │   │   └── widescreen.ts           # Широкоэкранный режим
│   │   │   ├── ads-blocking/
│   │   │   │   ├── config.ts               # TRACKER_DOMAINS (46+ доменов), CONFIG, TRACKER_DOM_CONFIG
│   │   │   │   ├── shared.ts               # Общий контекст: статистика (лимит 100), ref-counted listener
│   │   │   │   ├── feed-api.ts             # Фильтр рекламы на уровне API (block_feed_ads_api)
│   │   │   │   ├── feed-dom.ts             # DOM-эвристика: CSS + JS-анализ (block_feed_ads_dom)
│   │   │   │   ├── trackers.ts             # DOM-очистка трекерных пикселей (block_trackers)
│   │   │   │   └── index.ts                # Точка входа: registerMultiple в FeatureManager
│   │   │   ├── automation/
│   │   │   │   ├── auto-add-friends.ts     # Автодобавление в друзья
│   │   │   │   ├── bypass-away-links.ts    # Обход away.php
│   │   │   │   └── keyboard-layout.ts      # Переключение раскладки
│   │   │   ├── custom-css/
│   │   │   │   └── custom-css.ts           # Пользовательский CSS
│   │   │   ├── media/
│   │   │   │   ├── player-control.ts       # Управление аудиоплеером VK (window.ap)
│   │   │   │   ├── video-download.ts       # Скачивание видео с vkvideo.ru
│   │   │   │   ├── story-download.ts       # Скачивание сторис с vk.com
│   │   │   │   ├── clip-download.ts        # Скачивание клипов с vk.com / vkvideo.ru
│   │   │   │   ├── photo-download.ts       # Скачивание фото и целых альбомов с vk.com
│   │   │   │   └── index.ts                # Точка входа: регистрация медиа-фич
│   │   │   ├── privacy/
│   │   │   │   ├── anti-tracking.ts        # Антислежка
│   │   │   │   ├── blur-on-unfocus.ts      # Размытие при потере фокуса
│   │   │   │   ├── hide-dialogs-hotkey.ts  # Горячая клавиша скрытия диалогов
│   │   │   │   ├── hide-specific-dialogs.ts# Скрытие диалогов по ID
│   │   │   │   ├── message-crypto.ts       # Фича: DOM, кнопка composer'а, авторасшифровка
│   │   │   │   ├── message-crypto-core.ts  # Крипто-ядро: AES-128/256, PBKDF2, COFFEE/VKify
│   │   │   │   └── skeleton.ts             # Скелетон-режим загрузки
│   │   │   └── spy/
│   │   │       └── index.ts                # Слежка за онлайн-статусом
│   │   ├── injected/                       # Скрипты в page context
│   │   │   ├── ad-feed-blocker.ts          # Response hook: фильтрует ads* из newsfeed.get, отправляет JSON-снапшот в лог
│   │   │   ├── anti-tracking.ts            # Антифингерпринтинг: блокировка typing/read-статусов
│   │   │   ├── injected-vk-api.ts          # Доступ к внутреннему API VK
│   │   │   ├── spy.ts                      # Перехват LongPoll-ответов VK (фича слежки)
│   │   │   ├── spy-events.ts               # Чистый разбор событий LongPoll (тестируемый)
│   │   │   ├── tracker-blocker.ts          # fetch/sendBeacon/WS/Image.src + neutralizeGlobals; домены из TRACKER_DOMAINS
│   │   │   └── vk-api-bridge.ts            # Мост content ↔ page context
│   │   ├── services/
│   │   │   ├── message-service.ts          # Связь с background
│   │   │   ├── navigation-service.ts       # Отслеживание SPA-навигации
│   │   │   └── token-service.ts            # Получение токена VK
│   │   ├── ui/
│   │   │   └── welcome-modal.ts            # Модалка приветствия
│   │   ├── utils/
│   │   │   ├── context-guard.ts            # Защита от повторной инициализации
│   │   │   └── injected-ready.ts           # Синхронизация инжекции скриптов
│   │   ├── index.ts
│   │   └── site-bridge.ts                  # Мост vkify.ru ↔ расширение
│   │
│   ├── popup/                              # React UI расширения (680×660 px)
│   │   ├── components/
│   │   │   ├── charts/
│   │   │   │   ├── ActivityChart.tsx       # График дневной активности
│   │   │   │   └── WeeklyActivityChart.tsx # Еженедельный график
│   │   │   ├── icons/
│   │   │   │   └── Icons.tsx               # Иконки вкладок и элементов
│   │   │   ├── layout/
│   │   │   │   ├── Header.tsx              # Шапка попапа с быстрыми действиями
│   │   │   │   ├── NotificationPanel.tsx   # Панель уведомлений
│   │   │   │   ├── QuickActions.tsx        # Быстрые действия (тема, реклама)
│   │   │   │   ├── TabContent.tsx          # Контентная область вкладки
│   │   │   │   └── Tabs.tsx                # Навигационные вкладки
│   │   │   ├── modals/
│   │   │   │   ├── ActivityComparisonModal.tsx
│   │   │   │   ├── AddUserModal.tsx        # Добавление пользователя в слежку
│   │   │   │   ├── OverallActivityModal.tsx
│   │   │   │   ├── SpyLogModal.tsx         # Лог событий слежки
│   │   │   │   └── UserActivityModal.tsx
│   │   │   ├── onboarding/
│   │   │   │   └── OnboardingTour.tsx      # 6-шаговый тур при первом запуске
│   │   │   ├── tabs/
│   │   │   │   ├── AppearanceTab.tsx       # Вид: темы, шрифты, фоны
│   │   │   │   ├── ElementsTab.tsx         # Элементы: скрытие блоков
│   │   │   │   ├── PrivacyTab.tsx          # Приватность
│   │   │   │   ├── AdsTab.tsx              # Реклама
│   │   │   │   ├── AutomationTab.tsx       # Автоматизация
│   │   │   │   ├── MediaTab.tsx            # Медиа: хоткеи плеера, скачивание видео/сторис
│   │   │   │   ├── OnlineSpyTab.tsx        # Слежка
│   │   │   │   ├── CSSEditorTab.tsx        # CSS-редактор
│   │   │   │   ├── MoreTab.tsx             # Ещё (импорт/экспорт)
│   │   │   │   └── appearanceSections/
│   │   │   │       ├── BackgroundSection.tsx
│   │   │   │       ├── DisplayModeSection.tsx
│   │   │   │       ├── FontSection.tsx
│   │   │   │       ├── ShareSection.tsx
│   │   │   │       ├── ThemeSection.tsx
│   │   │   │       └── VisualFiltersSection.tsx
│   │   │   ├── ui/
│   │   │   │   ├── ActionCard.tsx
│   │   │   │   ├── ColorPicker.tsx
│   │   │   │   ├── HotkeyPicker.tsx
│   │   │   │   ├── InfoBlock.tsx
│   │   │   │   ├── InfoCard.tsx
│   │   │   │   ├── LinkButton.tsx
│   │   │   │   ├── QuickCard.tsx
│   │   │   │   ├── RangeSlider.tsx
│   │   │   │   ├── SettingRow.tsx
│   │   │   │   ├── ThemeCard.tsx
│   │   │   │   ├── ThemeSelector.tsx
│   │   │   │   ├── Toast.tsx
│   │   │   │   └── Toggle.tsx
│   │   │   └── ErrorBoundary.tsx
│   │   ├── context/
│   │   │   ├── SettingsContext.tsx          # Глобальное хранилище настроек
│   │   │   └── ToastContext.tsx             # Уведомления внутри попапа
│   │   ├── hooks/
│   │   │   ├── core/
│   │   │   │   ├── useHeaderNotifications.ts
│   │   │   │   ├── usePopupTheme.ts         # Тема попапа (dark/light)
│   │   │   │   ├── useStorage.ts            # Подписка на chrome.storage
│   │   │   │   └── useVKApi.ts              # Вызовы VK API из попапа
│   │   │   └── features/
│   │   │       ├── useAdsBlocking.ts
│   │   │       ├── useApiMethod.ts
│   │   │       ├── useBackground.ts
│   │   │       ├── useConversations.ts
│   │   │       ├── useCSSEditor.ts
│   │   │       ├── useDataManagement.ts
│   │   │       ├── useFont.ts
│   │   │       ├── useFriends.ts
│   │   │       ├── useHiddenDialogs.ts
│   │   │       ├── useOnlineSpyStats.ts
│   │   │       ├── useProfileSpyStats.ts
│   │   │       ├── useProjectJson.ts
│   │   │       ├── useTrackedUsers.ts
│   │   │       ├── useVisualFilters.ts
│   │   │       └── useVKTheme.ts
│   │   ├── constants/
│   │   │   ├── appearance.ts               # Темы, шрифты, категории, пресеты
│   │   │   ├── links.ts                    # Внешние ссылки
│   │   │   └── tabs.ts                     # Конфигурация 10 вкладок
│   │   └── utils/
│   │       ├── css/
│   │       │   ├── formatter.ts
│   │       │   ├── highlighter.ts
│   │       │   ├── index.ts
│   │       │   └── templates.ts
│   │       └── videoEmbed.ts               # Парсер URL видео (YouTube, VK и др.)
│   │
│   ├── shared/                             # Общий код для всех слоёв
│   │   ├── constants/
│   │   │   ├── alarms.ts                   # Названия алармов
│   │   │   ├── defaults.ts                 # Дефолтные настройки
│   │   │   ├── messages.ts                 # Типы сообщений
│   │   │   ├── settings-schema.ts          # Канонический реестр настроек + валидатор
│   │   │   ├── site.ts                     # Env-aware SITE_URL/siteUrl()/SITE_HOST
│   │   │   └── storage-keys.ts             # Ключи chrome.storage
│   │   ├── utils/
│   │   │   ├── event-emitter.ts
│   │   │   ├── fetch-hooks.ts              # Единый координатор window.fetch
│   │   │   ├── page-channel.ts             # Per-session nonce для postMessage-канала
│   │   │   ├── token.ts
│   │   │   ├── ttl-cache.ts                # Ограниченный кэш с TTL
│   │   │   └── vk-fetch.ts                 # Единая реализация вызова VK API
│   │   └── videoEmbed.ts                   # Общая версия парсера видео
│   │
│   └── types/
│       └── index.ts                        # Все TypeScript-типы проекта
│
├── public/                                 # Иконки расширения (16–300 px)
├── .github/assets/                         # Медиа для README
├── scripts/
│   ├── build.mjs                           # Оркестратор сборки (modules ESM + classic IIFE)
│   └── classic-entries.mjs                 # Список classic-точек входа (единый источник)
├── manifest.json                           # Chrome Extension Manifest V3 (+ CSP)
├── vite.config.ts                          # Конфиг: цель modules | classic:<name>
└── tailwind.config.ts                      # Конфигурация Tailwind
```

---

## Сборка и разработка

```bash
npm install

npm run build        # typecheck + сборка (prod) → dist/
npm run build:fast   # сборка (prod) без typecheck
npm run build:dev    # сборка (dev): localhost-мост + console.* сохранены
npm run dev          # dev-сервер popup с hot reload
npm run typecheck    # проверка TypeScript-типов
npm run test         # запуск тестов (Vitest)
npm run test:watch   # тесты в режиме watch
npm run clean        # удалить папку dist/
```

Сборка раздельная (`scripts/build.mjs`): popup и background собираются как
ES-модули, а `content.js`, `site-bridge.js` и `injected/*.js` — отдельными
самодостаточными IIFE-бандлами (классические скрипты не могут содержать
ES-`import`; так они могут переиспользовать код из `shared/`).

- **prod** (`build` / `build:fast`) — `console.*` вырезаны, `http://localhost/*`
  в манифесте отсутствует, `SITE_URL = https://vkify.ru`.
- **dev** (`build:dev`) — `console.*` сохранены, в site-bridge добавлен
  `http://localhost/*`, `manifest.homepage_url` переписан на dev-URL,
  `SITE_URL = http://localhost:5173`. Все исходящие ссылки расширения
  автоматически указывают на локальный лендинг.
- **Кастомный URL** — `VKIFY_SITE_URL=http://localhost:3000 npm run build:dev`
  (если фронтенд крутится не на дефолтном 5173).

После сборки загрузите папку `dist/` в Chrome через `chrome://extensions` →
«Загрузить распакованное». После обновления расширения перезагрузите открытые
вкладки vk.com (контент-скрипты MV3 не переинъектятся сами).

---

## Тесты

Тесты на [Vitest](https://vitest.dev) (среда `node`), лежат в `src/__tests__/`.

```bash
npm test               # одноразовый прогон
npm run test:watch     # watch-режим
npx vitest run --coverage   # с покрытием (нужен @vitest/coverage-v8, уже в devDeps)
```

Покрыта в первую очередь чистая бизнес-логика и зоны риска (там, где правки
исторически ломали поведение), без DOM/сети — через моки `chrome.*` и фейковые
таймеры, где нужно:

- **Крипто-ядро** (`message-crypto`) — AES-128/256, PBKDF2, COFFEE/VKify, KAT-векторы
- **Парсер событий слежки** (`spy-events`) — все типы LongPoll-событий, матч URL
  лонгполла, атрибуция ЛС/беседы, текст удалённого сообщения
- **Реестр настроек** (`settings-schema`) — валидация типов/enum/scope, защита от
  prototype-загрязнения, санитизация недоверенного ввода
- **VK API** (`vk-api`, `message-handler`) — токен-флоу, ретраи, роутинг сообщений
- **Онлайн-трекер** (`spy-tracker`) — опрос статусов, алармы, журнал
- **Утилиты** — ZIP-writer (`zip`), TTL-кэш (`ttl-cache`), nonce-канал
  (`page-channel`), включение фич (`should-enable`), подсветка CSS (`highlighter`)

---

## Технологии

| Слой | Технологии |
|---|---|
| UI расширения | React 18, TypeScript 5, Tailwind CSS 3 |
| Сборка | Vite 7, Rollup — раздельно: modules (ESM) + classic (IIFE) |
| Тесты | Vitest |
| Контент | Vanilla TypeScript |
| Фоновый воркер | TypeScript, Chrome Alarms API |

---

## Поддержать проект

Если расширение вам нравится — можно поддержать разработку:

| Способ | Ссылка |
|--------|--------|
| 🇷🇺 Visa, MasterCard, МИР | [Cloudtips](https://pay.cloudtips.ru/p/b59e1765) |
| 🌍 Зарубежные карты и крипта | [Tribute](https://t.me/tribute/app?startapp=dE4k) |
