# Кросс-браузерная сборка (Chrome / Firefox / Opera)

VKify собирается из **одной кодовой базы** в три браузерных пакета. Браузеро-специфично
ровно две вещи: **манифесты** и **крошечный слой нормализации API**. Весь код в `src/` общий.

## Сборка

```bash
npm install            # один раз (добавился web-ext для Firefox)

npm run build          # все три: dist/chrome, dist/firefox, dist/opera (+ typecheck)
npm run build:chrome   # только Chrome  → dist/chrome
npm run build:firefox  # только Firefox → dist/firefox
npm run build:opera    # только Opera   → dist/opera
npm run build:dev      # dev-сборка Chrome (с console.*, localhost-мостом)
```

## Слой нормализации API — `src/shared/ext-api.ts`

Код вызывает `chrome.*` в promise-стиле. В Chromium (Chrome/Opera, MV3) это работает
нативно. В Firefox промисы есть только у `browser.*`, а `chrome.*` — callback-only.

`installExtApi()` на Firefox делает `globalThis.chrome = globalThis.browser` (нативный
объект с промисами **и** рабочим `return true`/`sendResponse`), на Chromium — no-op.
Вызывается первой строкой каждой точки входа (background, content, embed, site-bridge,
popup). НЕ подключается в `src/content/injected/*` — те исполняются в page-world.

**Почему не webextension-polyfill:** его обёртка над `runtime.onMessage` не поддерживает
паттерн `return true` + `sendResponse`, который активно используется в проекте.

## Защита инвариантов (CI)

Кросс-браузерные инварианты, на которых исторически спотыкались, защищены машинно —
их нельзя случайно нарушить:

- **Типобезопасные сообщения** ([`src/shared/messaging.ts`](src/shared/messaging.ts)) —
  `sendMessage()` выводит тип ответа из `type` запроса (карта `MessageResponses`).
  Никаких ручных `as`-кастов ответа в попапе.
- **ESLint-guardrails** ([`.eslintrc.cjs`](.eslintrc.cjs), `npm run lint` в CI) —
  AST-правила (`no-restricted-syntax`, `--no-inline-config` → нельзя отключить inline):
  - в попапе запрещён прямой `chrome.tabs.*` (в Firefox embed его нет → только helpers через background);
  - в попапе запрещён сырой `chrome.runtime.sendMessage` (только типобезопасный `sendMessage`);
  - в content запрещён сырой `dispatchEvent(new CustomEvent(...))` к page-world (только `dispatchPageEvent` с `cloneInto`).
- **Build-smoke** ([`scripts/verify-build.mjs`](scripts/verify-build.mjs)) — форма каждого
  манифеста (Firefox event-page + gecko.id + CSP без `base-uri`, нет Chrome-only `global` в командах и т.п.).

## Манифесты — `manifest/`

| Файл | Назначение |
|------|------------|
| `base.json` | общий манифест (Chromium MV3): permissions, content_scripts, commands, WAR, CSP, фоновый service worker |
| `chrome.json` | оверрайд Chrome: `minimum_chrome_version` |
| `opera.json` | оверрайд Opera: пуст (Opera = Chromium); `minimum_chrome_version` намеренно не задаётся |
| `firefox.json` | оверрайд Firefox: `background.scripts` вместо `service_worker`, `browser_specific_settings.gecko`, CSP без `base-uri` |

Сборка делает `dist/<browser>/manifest.json = deepMerge(base, <browser>)` (см.
`vite.config.ts → mergeManifest`). Массивы и ключ `background` заменяются целиком; ключи
с префиксом `_` (заметки) отбрасываются.

### Нюансы Firefox
- Фон — **event-page script-модуль**, а не service worker (стабильная поддержка MV3).
- `host_permissions` в MV3 Firefox по умолчанию **опциональны** — пользователь выдаёт
  доступ к vk.ru через значок расширения / about:addons.
- Требуется `gecko.id` (здесь `vkify@vkify.ru`) для подписи на AMO.

## Тестирование

**Chrome / Opera:** `chrome://extensions` (или `opera://extensions`) → «Загрузить
распакованное» → выбрать `dist/chrome` (или `dist/opera`).

**Firefox:**
```bash
npm run lint:firefox   # web-ext lint
npm run run:firefox    # запустить во временном профиле Firefox
```
или вручную: `about:debugging` → «This Firefox» → «Load Temporary Add-on» → `dist/firefox/manifest.json`.

## Упаковка для сторов

`package:*` сами собирают нужный бандл перед упаковкой (build → web-ext build):

```bash
npm run package:chrome    # dist/packages/vkify-chrome.zip
npm run package:firefox   # dist/packages/vkify-firefox.zip
npm run package:opera     # dist/packages/vkify-opera.zip
```

### Автоматический релиз (тег → артефакты)

Пуш тега `v*` запускает [`.github/workflows/release.yml`](.github/workflows/release.yml):
прогоняет те же quality-gates, собирает все три, пакует `.zip` для каждого стора,
подписывает Firefox-сборку на AMO (если заданы секреты `AMO_JWT_ISSUER` /
`AMO_JWT_SECRET`) и публикует GitHub Release с артефактами.

```bash
# 1. поднять версию в manifest/base.json + package.json
git tag v1.5.0 && git push origin v1.5.0
```

Публикация в Chrome Web Store / Opera — пока вручную из артефактов релиза (CWS
требует OAuth refresh-token; шаг легко добавить в workflow при готовности).

> **Иконки:** AMO требует строго квадратные иконки. Нестандартный размер 24px
> (файл `public/icons/icon24.png` был 25×24) убран из объявлений манифеста —
> Chrome/Opera его в UI не использовали, ошибок не было только из-за их терпимости.
