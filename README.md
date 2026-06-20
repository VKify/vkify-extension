<div align="center">
  <img src=".github/assets/logo.png" alt="VKify" width="96" />

  # VKify

  **Расширение для Chrome, Firefox и Opera, которое делает ВКонтакте удобнее, красивее и приватнее**

  [![Website](https://img.shields.io/badge/vkify.ru-0077FF?style=for-the-badge&logo=googlechrome&logoColor=white)](https://vkify.ru)
  [![Telegram](https://img.shields.io/badge/Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/VKify)
  [![VK](https://img.shields.io/badge/VK-4C75A3?style=for-the-badge&logo=vk&logoColor=white)](https://vk.com/vkify)
  [![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/VKify/vkify-extension)

  [![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/vkify/lofggenkgbpdmmplnbgfplnpfjhgljla)
  [![Firefox Add-ons](https://img.shields.io/badge/Firefox_Add--ons-FF7139?style=for-the-badge&logo=firefoxbrowser&logoColor=white)](https://addons.mozilla.org/ru/firefox/addon/vkify/)

  ![Version](https://img.shields.io/badge/версия-1.6.0-blue?style=flat-square)
  ![Chrome](https://img.shields.io/badge/Chrome-105+-4285F4?style=flat-square&logo=googlechrome&logoColor=white)
  ![Firefox](https://img.shields.io/badge/Firefox-115+-FF7139?style=flat-square&logo=firefoxbrowser&logoColor=white)
  ![Opera](https://img.shields.io/badge/Opera-Chromium-FF1B2D?style=flat-square&logo=opera&logoColor=white)
  ![Manifest](https://img.shields.io/badge/Manifest-V3-34A853?style=flat-square)
  ![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
  ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
  ![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white)
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

### ⚡ Скрипты (`Скрипты`)
- Прямые ссылки — обход редиректа `away.php`
- Автодобавление в друзья по таймеру
- Переключатель раскладки горячей клавишей

### 👁️ Слежка (`Слежка`)
- Активность в сообщениях — печатает, читает, удаляет, заходит в звонок и т.п.
- Онлайн-мониторинг с историей и графиками
- Отслеживание профилей — смена аватара, статуса, числа друзей
- Браузерные уведомления, отдельный список и журнал для каждой подсистемы

### 🗂️ Центр (`Центр`) — хаб со страницами
Вкладка-контейнер с внутренними страницами (компактная навигация слева, как разделы в VK) — чтобы не плодить вкладки. Доступные страницы:
- **Мессенджер** — всё про переписку в одном месте:
  - **Быстрое копирование** — кнопка-копия у каждого сообщения. Shift+клик копирует диапазон
  - **Экспорт диалогов** в JSON, TXT, HTML, HTML с фото внутри файла, ZIP-архив с папкой `photos/`. Встроенный поиск в экспорте и опция «расшифровать сохранённым ключом»
  - **Шаблоны сообщений** с переменными (`%first_name%`, `%time%`, `%date%`, `%br%`) и прикреплёнными файлами; триггеры — «/» в начале строки, горячая клавиша, автоподсказка; опция «отправлять сразу»
  - **Заметки** — кнопка-закладка у сообщения сохраняет его в локальный архив с поиском по тексту/автору/чату; всё хранится только у вас
- **Плеер** — хоткеи плеера: пауза, переключение, перемотка, скорость. Можно сделать глобальными (работают с любой вкладки браузера)
- **Лента** — разворачивание текста постов и скачивание историй (фото и видео) одним нажатием
- **Видео** — скачивание видео с vkvideo.ru с выбором качества до 1080p
- **Клипы** — скачивание VK Clips с выбором качества до 1080p
- **Фото** — скачивание отдельного фото или целого альбома (ZIP) в подпапку
- **Музыка** — сохранение треков в MP3 (теги, обложка, текст песни) и загрузка нескольких треков сразу

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

**Готовое расширение** — поставьте из магазина:

- [Chrome Web Store](https://chromewebstore.google.com/detail/vkify/lofggenkgbpdmmplnbgfplnpfjhgljla) — Chrome, Opera и другие браузеры на Chromium
- [Firefox Add-ons](https://addons.mozilla.org/ru/firefox/addon/vkify/) — Firefox

**Из исходников** (для разработки или ручной установки):

```bash
git clone https://github.com/VKify/vkify-extension.git
cd vkify-extension
npm install
npm run build          # соберёт все три версии: dist/chrome, dist/firefox, dist/opera
```

Можно собрать и по отдельности: `npm run build:chrome` / `build:firefox` / `build:opera`.

Установка распакованной версии:

- **Chrome** — `chrome://extensions` → «Режим разработчика» → «Загрузить распакованное» → папка `dist/chrome`.
- **Opera** — `opera://extensions` → «Режим разработчика» → «Загрузить распакованное» → папка `dist/opera`.
- **Firefox** — `about:debugging#/runtime/this-firefox` → «Load Temporary Add-on» → `dist/firefox/manifest.json` (или `npm run run:firefox`). Постоянная установка требует подписи AMO.

После загрузки обновите открытые вкладки vk.com. Подробности по кросс-браузерности — в [CROSS_BROWSER.md](CROSS_BROWSER.md).

**Как пользоваться:**

- Нажмите иконку VKify на панели браузера — откроется попап с настройками (10 вкладок).
- Или откройте `vk.com/vkify_settings` (либо пункт «Настройки VKify» в меню профиля) — те же настройки прямо на странице VK.
- `Ctrl/Cmd + K` в попапе — поиск по всем функциям расширения.
- Настройки применяются мгновенно и синхронизируются между попапом и страницей.

---

## Архитектура

Расширение разбито на несколько слоёв, которые общаются через Chrome Storage и Message API:

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
- **embed** — контент-скрипт, который встраивает тот же интерфейс настроек прямо в страницу VK (`vk.com/vkify_settings` и пункт меню профиля)
- **site-bridge** — контент-скрипт для vkify.ru: передаёт настройки с сайта в расширение (на `http://localhost/*` — только в dev-сборке)

### Безопасность

- Все настройки описаны в одном реестре `shared/constants/settings-schema.ts`. Из него собираются whitelist'ы и общий валидатор для shared-тем, импорта файла и site-bridge.
- Канал `postMessage` между content и injected закрыт nonce'ом на сессию; токен VK не достаётся из чужих запросов.
- CSP `script-src 'self'`, исходящие `postMessage` адресованы конкретному origin, без `'*'`.
- `http://localhost/*` для site-bridge есть только в dev-манифесте.
- Ссылки на сайт (`shared/constants/site.ts`) подставляются на сборке: в prod `https://vkify.ru`, в dev `http://localhost:5173`. Домен нигде не захардкожен.

---

## Структура проекта

Ниже только каталоги. Имена файлов внутри опущены, чтобы дерево оставалось
актуальным при перестановке модулей.

```
vkify/
├── .github/                          # Workflows, шаблоны issue/PR, медиа для README
│   ├── assets/
│   ├── ISSUE_TEMPLATE/
│   └── workflows/
├── e2e/                              # Playwright-тесты попапа
├── manifest/                         # base.json + оверрайды chrome / firefox / opera
├── public/
│   ├── icons/                        # Иконки расширения (16–300 px)
│   ├── styles/                       # Статичный CSS контент-скрипта
│   └── wallpapers/                   # Каталог обоев
├── scripts/                          # Сборка, проверка размера и упаковка
└── src/
    ├── __tests__/                    # Юнит-тесты (Vitest)
    ├── background/                   # Сервис-воркер: VK API, алармы, уведомления
    │   ├── handlers/
    │   ├── services/
    │   └── utils/
    ├── content/                      # Контент-скрипты
    │   ├── api/
    │   ├── core/                     # FeatureManager, CSS/скрипт-инъекторы, кэш
    │   ├── embed/                    # Настройки прямо на странице VK (vk.com/vkify_settings)
    │   ├── features/
    │   │   ├── ads-blocking/
    │   │   ├── appearance/
    │   │   │   ├── background/        # Обои: картинки, видео, веб
    │   │   │   ├── filters/           # Визуальные фильтры
    │   │   │   ├── font/
    │   │   │   ├── header/
    │   │   │   ├── layout/            # Ширина контента, смещение, скругления
    │   │   │   ├── sidebar/
    │   │   │   └── theme/
    │   │   ├── automation/           # away.php, автодрузья, раскладка
    │   │   ├── center/               # Хаб «Центр» — страницы со скачиванием медиа
    │   │   │   ├── _shared/          # Общие утилиты download-фич + barrel _shared.ts
    │   │   │   ├── feed/             # «Лента»: раскрытие текста постов
    │   │   │   ├── messages/         # «Мессенджер»
    │   │   │   │   ├── _shared/
    │   │   │   │   ├── dialog-export/
    │   │   │   │   ├── pin-note/
    │   │   │   │   ├── quick-copy/
    │   │   │   │   └── templates/
    │   │   │   ├── player/           # «Плеер»: хоткеи аудиоплеера
    │   │   │   ├── story/            # «Лента»: скачивание историй
    │   │   │   ├── video/            # «Видео»: скачивание видео
    │   │   │   ├── clip/             # «Клипы»: скачивание VK Clips
    │   │   │   ├── photo/            # «Фото»: скачивание фото и альбомов
    │   │   │   └── music/            # «Музыка»: MP3-скачивание + мульти-загрузка
    │   │   ├── custom-css/
    │   │   ├── elements/             # Скрытие блоков интерфейса
    │   │   │   ├── communities/
    │   │   │   ├── feed/
    │   │   │   ├── friends/
    │   │   │   ├── global/
    │   │   │   ├── menu/
    │   │   │   ├── messenger/
    │   │   │   ├── music/
    │   │   │   └── profile/
    │   │   ├── privacy/
    │   │   │   ├── crypto/           # Шифрование сообщений (VKify E2E / COFFEE)
    │   │   │   └── dialogs/          # Скрытие диалогов, хоткеи
    │   │   ├── spy/                  # Слежка за онлайн-статусом
    │   │   └── utils/
    │   ├── injected/                 # Скрипты в page context (spy, блокировка рекламы, мост)
    │   ├── services/                 # Связь с background, SPA-навигация, токен
    │   ├── ui/
    │   │   └── download-center/      # Центр загрузок на странице
    │   └── utils/
    ├── popup/                        # React UI расширения
    │   ├── components/
    │   │   ├── charts/
    │   │   ├── icons/
    │   │   ├── layout/
    │   │   ├── modals/
    │   │   ├── onboarding/
    │   │   ├── tabs/                 # 10 вкладок попапа
    │   │   │   ├── appearanceSections/
    │   │   │   ├── center/
    │   │   │   │   ├── feed/
    │   │   │   │   ├── messages/
    │   │   │   │   ├── player/
    │   │   │   │   ├── video/
    │   │   │   │   ├── clip/
    │   │   │   │   ├── photo/
    │   │   │   │   └── music/
    │   │   │   ├── elements/
    │   │   │   │   ├── communities/
    │   │   │   │   ├── feed/
    │   │   │   │   ├── friends/
    │   │   │   │   ├── global/
    │   │   │   │   ├── menu/
    │   │   │   │   ├── messenger/
    │   │   │   │   ├── music/
    │   │   │   │   └── profile/
    │   │   │   └── spySections/
    │   │   └── ui/                   # Общие UI-примитивы
    │   ├── constants/
    │   ├── context/
    │   ├── hooks/
    │   │   ├── core/
    │   │   └── features/
    │   └── utils/
    │       └── css/
    ├── shared/                       # Общий код для всех слоёв
    │   ├── constants/                # settings-schema, defaults, site, ключи storage
    │   └── utils/                    # vk-fetch, zip, ttl-cache, page-channel и др.
    └── types/                        # TypeScript-типы проекта
```

---

## Сборка и разработка

```bash
npm install

npm run build          # typecheck + сборка всех трёх → dist/{chrome,firefox,opera}
npm run build:chrome   # только Chrome  → dist/chrome
npm run build:firefox  # только Firefox → dist/firefox
npm run build:opera    # только Opera   → dist/opera
npm run build:fast     # быстрая сборка Chrome без typecheck
npm run build:dev      # dev-сборка Chrome: localhost-мост + console.* сохранены
npm run dev            # dev-сервер popup с hot reload
npm run typecheck      # проверка TypeScript-типов
npm run test           # запуск тестов (Vitest)
npm run run:firefox    # запустить Firefox с расширением (web-ext)
npm run lint:firefox   # проверка пакета правилами AMO (web-ext lint)
npm run package:chrome # собрать + упаковать .zip (аналогично firefox/opera)
npm run clean          # удалить папку dist/
```

Сборка раздельная (`scripts/build.mjs`): popup и background собираются как
ES-модули, а `content.js`, `embed.js`, `site-bridge.js` и `injected/*.js` —
отдельными IIFE-бандлами. Классический скрипт не умеет в ES-`import`, и такой
бандл всё равно переиспользует код из `shared/`.

### Кросс-браузерность (Chrome / Firefox / Opera)

Одна кодовая база, три пакета. Браузеро-специфичны только манифесты и
крошечный слой нормализации API:

- **Манифесты** — общий `manifest/base.json` + оверрайды `manifest/{chrome,firefox,opera}.json`,
  которые мёржатся на сборке в `dist/<browser>/manifest.json`. Firefox получает
  `background.scripts` (event-page) вместо service worker, `browser_specific_settings.gecko`
  и CSP без `base-uri`; Opera = Chromium-база.
- **API** — код вызывает `chrome.*` в promise-стиле; на Firefox
  [`src/shared/ext-api.ts`](src/shared/ext-api.ts) переводит глобал `chrome` на
  нативный `browser` (промисы + рабочий `return true`/`sendResponse`). На Chromium — no-op.
  webextension-polyfill НЕ используется намеренно (его обёртка над `onMessage`
  ломает паттерн `return true`).
- **Точечные отличия движков** — через build-константу `IS_FIREFOX`
  ([`src/shared/constants/browser.ts`](src/shared/constants/browser.ts)): напр.
  Chrome-only поле `priority` в `notifications.create` и `cloneInto` для
  content→injected событий (Firefox изолирует миры).

Полное руководство, нюансы Firefox (host_permissions, подпись AMO) и упаковка —
в [CROSS_BROWSER.md](CROSS_BROWSER.md).

- **prod** (`build` / `build:fast`) — `console.*` вырезаны, `http://localhost/*`
  в манифесте отсутствует, `SITE_URL = https://vkify.ru`.
- **dev** (`build:dev`) — `console.*` сохранены, в site-bridge добавлен
  `http://localhost/*`, `manifest.homepage_url` переписан на dev-URL,
  `SITE_URL = http://localhost:5173`. Все исходящие ссылки расширения
  автоматически указывают на локальный лендинг.
- **Кастомный URL** — `VKIFY_SITE_URL=http://localhost:3000 npm run build:dev`
  (если фронтенд крутится не на дефолтном 5173).

После сборки загрузите папку `dist/chrome` (или `dist/opera` / `dist/firefox`)
через страницу расширений соответствующего браузера → «Загрузить распакованное».
После обновления расширения перезагрузите открытые вкладки vk.com (контент-скрипты
MV3 не переинъектятся сами).

---

## Тесты

Тесты на [Vitest](https://vitest.dev) (среда `node`), лежат в `src/__tests__/`.

```bash
npm test               # одноразовый прогон
npm run test:watch     # watch-режим
npx vitest run --coverage   # с покрытием (нужен @vitest/coverage-v8, уже в devDeps)
```

Тесты покрывают чистую бизнес-логику и места, где легко что-то сломать. DOM и
сеть не трогаем: `chrome.*` мокается, где надо — фейковые таймеры.

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
| Сборка | Vite 5, Rollup: раздельно modules (ESM) + classic (IIFE) |
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
