<div align="center">
  <img src=".github/assets/logo.png" alt="VKify" width="96" />

  # VKify

  **Расширение для Chrome, которое делает ВКонтакте удобнее, красивее и приватнее**

  [![Website](https://img.shields.io/badge/vkify.ru-0077FF?style=for-the-badge&logo=googlechrome&logoColor=white)](https://vkify.ru)
  [![Telegram](https://img.shields.io/badge/Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/VKify)
  [![VK](https://img.shields.io/badge/VK-4C75A3?style=for-the-badge&logo=vk&logoColor=white)](https://vk.com/vkify)
  [![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/VKify/vkify-extension)

  ![Version](https://img.shields.io/badge/версия-1.2.0-blue?style=flat-square)
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
- **72 встроенные темы** в 11 категориях: Classic, Soft, AMOLED, Colored, Neon, Nature, Minimal, Retro, Warm, Cool
- Свой цвет фона и акцентный цвет
- 60+ шрифтов через Google Fonts
- Фоновые обои — статичные (IMAGE), видео (VIDEO) и HTML-анимации (WEB)
- Смещение страницы до ±600 px — удобно на широких мониторах
- Скругление элементов, визуальные фильтры (оттенки серого, сепия, инверсия и др.)
- Компактный режим — убирает отступы между блоками VK (классический VK и VKUI)
- Компактный / фиксированный сайдбар, сворачиваемая поисковая строка
- Редактор пользовательского CSS с подсветкой синтаксиса и сниппетами

### 🧩 Элементы (`Элементы`)
- Скрытие отдельных блоков интерфейса: истории, рекомендации, музыка, клипы, онлайн-статусы, реклама в историях, баннеры

### 🛡️ Реклама (`Реклама`)
Четыре независимых фильтра, каждый включается отдельным тумблером:

- **Боковые баннеры** — CSS-скрытие рекламных виджетов в левой колонке
- **Лента · фильтр API** — перехватывает ответ `newsfeed.get` до рендера; вырезает элементы с `type=ads*` и флагами `marked_as_ads` / `is_ad` / `ad_id`; нулевые задержки, пост не мелькает в интерфейсе
- **Лента · фильтр DOM** — двойная защита поверх API-фильтра:
  - постоянные CSS-правила `:has()` для мгновенного скрытия по ERID-классам, `[data-testid="post-header-subscription-button"]` и рекламным CDN-доменам в `img[src]`
  - JS-эвристика (MutationObserver + интервал): жёсткие маркеры (`erid`, `спонсор`, `на правах рекламы`), рекламные CDN в картинках, `aria-label` с «реклам», CTA-фразы + внешние ссылки, HTML-обфускация слова «реклама»
  - `closest()` на атрибуте `data-ad-checked` предотвращает двойную обработку вложенных селекторов
  - `WeakSet` защищает лог от дублей при `reapplyOnNavigate`
- **Ключевые слова** — раскрываются прямо под тумблером DOM-фильтра (паттерн MediaTab): список слов-блокировок и allow-list; применяются в реальном времени без перезагрузки страницы
- **Блокировка трекеров** — сетевой перехват (`fetch` / `sendBeacon` / `WebSocket` / `Image.prototype.src`) + DOM-очистка пиксельных маяков; нейтрализует аналитические глобалы (`window.ym`, `window.gtag`, `window.fbq`, `VK.Retargeting`) при каждой новой вставке `<script>` в DOM; единый список из 46+ доменов (`TRACKER_DOMAINS` в `config.ts`) — источник истины для обоих уровней
- **Журнал блокировок** (100 записей): фильтр Все / Реклама / Трекеры, пагинация по 10; раскрываемые детали — JSON-снапшот заблокированного API-поста с кнопкой «копировать», текст DOM-поста или URL трекера; цветовая маркировка триггера блокировки
- Счётчики и журнал — устройство-локальные, не попадают в экспорт/импорт настроек

### 🔒 Приватность (`Приватность`)
- Скрытие конкретных диалогов по ID пользователя
- Горячая клавиша для скрытия открытых диалогов
- Размытие страницы при потере фокуса окна
- Скелетон-режим загрузки

### ⚡ Автоматизация (`Скрипты`)
- Обход away.php — внешние ссылки открываются напрямую без редиректа VK
- Автодобавление в друзья
- Переключатель раскладки клавиатуры

### 👁️ Слежка (`Слежка`)
Три независимых подсистемы со **своими** списками отслеживаемых и логами:
- **Активность в сообщениях** — печать, голосовые, загрузка медиа (фото/видео/файл),
  прочтение, редактирование, удаление, входящие сообщения, звонки, события беседы
  (вход/выход/исключение), смена невидимки друга (перехват LongPoll v19)
- **Онлайн-мониторинг** — заходы/выходы из сети, настраиваемый интервал опроса
  через VK API, история активности и еженедельные графики
- **Отслеживание профилей** — периодически проверяет смену аватарки, статуса
  и количество друзей через `users.get(fields=photo_100,status,counters)`;
  отдельный список, лог и интервал
- Браузерные уведомления; добавление пользователя в одну подсистему не
  затрагивает другие — у каждой свой список и свой лог
- В модалке «Добавить» все три подсистемы поддерживают добавление из друзей,
  из текущих диалогов и вручную по ID

### 💬 Шаблоны (`Шаблоны`)
- CRUD-редактор: добавление, редактирование и удаление шаблонов сообщений
- **Триггеры** (включаются независимо): «/» в начале поля сообщения,
  настраиваемая горячая клавиша (`HotkeyPicker`), автоподсказка по префиксу
- **Переменные**: `%first_name%`, `%last_name%`, `%my_first_name%`,
  `%my_last_name%`, `%title%`, `%peer_id%`, `%time%`, `%date%`, `%br%`
- Резолв собеседника из URL VK Messenger Engine (`/im/convo/<id>`),
  vanity-URL через `utils.resolveScreenName` (с TTL-кэшем), DOM-фолбэк
  по `.ConvoHeader__info`/`.ConvoTitle__author`
- Опция «Отправлять сообщение сразу» — клик/Enter пушит сообщение в VK
  через `messages.send`, без подтверждения
- Пикер в Shadow-стиле: SVG-лого, навигация ↑↓, авто-detect тёмной темы

### 🎧 Медиа (`Медиа`)
- Локальные хоткеи на vk.com: play/pause, next, prev, перемотка, скорость
  (через `HotkeyPicker`)
- **Глобальные** хоткеи через `chrome.commands` — работают **с любой**
  активной вкладки браузера (фон ретранслирует команду во все открытые
  VK-вкладки, инжектированный `player-control.js` управляет `window.ap`)
- Без предустановленных значений в манифесте: пользователь сам назначает
  шорткаты в `chrome://extensions/shortcuts` (кнопка-deeplink в попапе)
- **Скачивание видео** с vkvideo.ru — плавающая кнопка с логотипом расширения
  и выбором качества (1080p–240p); цветовые индикаторы по разрешению; получает
  прямые CDN-ссылки через VK API `video.get`; загрузка идёт через
  `chrome.downloads` в фоне (кросс-оригинные URL не работают через `<a download>`)
- **Скачивание сторис** с vk.com — при просмотре сторис появляется плавающая
  кнопка: фото-сторис скачиваются в JPEG одним кликом, видео-сторис — с
  выпадающим пикером качества; опрашивает `location.search` каждые 300 мс для
  надёжного обнаружения навигации между сторис (VK меняет только query-параметр
  `?w=`, не обновляя `<title>`, поэтому стандартный `MutationObserver` на
  `document.head` не срабатывает); API `stories.getById`; счётчик поколений
  отменяет устаревшие запросы при быстрой навигации

### 💻 CSS (`CSS`)
- Встроенный редактор с подсветкой синтаксиса
- Живой превью
- Форматтер кода
- Импорт / экспорт
- Готовые сниппеты

### ⚙️ Прочее (`Ещё`)
- Онбординг-тур при первом открытии — 6 шагов с описанием ключевых возможностей
- Экспорт / импорт всех настроек
- Быстрые действия в шапке попапа (тема, реклама, обновить страницу)
- Попап 680 × 660 px — больше контента без прокрутки
- Поддержка vk.com, vk.ru, vkvideo.ru

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
│   │   ├── highlighter.test.ts
│   │   ├── message-handler.test.ts
│   │   ├── message-handler-theme.test.ts
│   │   ├── should-enable.test.ts
│   │   ├── spy-tracker.test.ts
│   │   └── vk-api.test.ts
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
│   │   │   │   └── index.ts                # Точка входа: регистрация медиа-фич
│   │   │   ├── privacy/
│   │   │   │   ├── anti-tracking.ts        # Антислежка
│   │   │   │   ├── blur-on-unfocus.ts      # Размытие при потере фокуса
│   │   │   │   ├── hide-dialogs-hotkey.ts  # Горячая клавиша скрытия диалогов
│   │   │   │   ├── hide-specific-dialogs.ts# Скрытие диалогов по ID
│   │   │   │   └── skeleton.ts             # Скелетон-режим загрузки
│   │   │   └── spy/
│   │   │       └── index.ts                # Слежка за онлайн-статусом
│   │   ├── injected/                       # Скрипты в page context
│   │   │   ├── ad-feed-blocker.ts          # Response hook: фильтрует ads* из newsfeed.get, отправляет JSON-снапшот в лог
│   │   │   ├── anti-tracking.ts            # Антифингерпринтинг: блокировка typing/read-статусов
│   │   │   ├── injected-vk-api.ts          # Доступ к внутреннему API VK
│   │   │   ├── spy.ts                      # Перехват WebSocket-событий VK
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
