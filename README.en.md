<div align="center">
  <img src=".github/assets/logo.png" alt="VKify" width="96" />

  # VKify

  **A Chrome, Firefox and Opera extension that makes VKontakte more comfortable, beautiful and private**

  [![Website](https://img.shields.io/badge/vkify.ru-0077FF?style=for-the-badge&logo=googlechrome&logoColor=white)](https://vkify.ru)
  [![Telegram](https://img.shields.io/badge/Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/VKify)
  [![VK](https://img.shields.io/badge/VK-4C75A3?style=for-the-badge&logo=vk&logoColor=white)](https://vk.com/vkify)
  [![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/VKify/vkify-extension)

  [![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/vkify/lofggenkgbpdmmplnbgfplnpfjhgljla)
  [![Firefox Add-ons](https://img.shields.io/badge/Firefox_Add--ons-FF7139?style=for-the-badge&logo=firefoxbrowser&logoColor=white)](https://addons.mozilla.org/ru/firefox/addon/vkify/)

  ![Version](https://img.shields.io/badge/version-1.6.0-blue?style=flat-square)
  ![Chrome](https://img.shields.io/badge/Chrome-105+-4285F4?style=flat-square&logo=googlechrome&logoColor=white)
  ![Firefox](https://img.shields.io/badge/Firefox-115+-FF7139?style=flat-square&logo=firefoxbrowser&logoColor=white)
  ![Opera](https://img.shields.io/badge/Opera-Chromium-FF1B2D?style=flat-square&logo=opera&logoColor=white)
  ![Manifest](https://img.shields.io/badge/Manifest-V3-34A853?style=flat-square)
  ![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
  ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
  ![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white)
  ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)

  [Русская версия →](README.md)

  <br/>

  <img src=".github/assets/extension-preview.png" alt="VKify Preview" width="100%" />
</div>

---

## Features

### 🎨 Appearance (`Вид` tab)
- 70+ ready-made themes plus full custom color tweaking
- 60+ fonts and wallpapers — images, videos, animations
- Border radius, content width and page offset adjustments
- Visual filters — grayscale, sepia, invert, high contrast and more
- Compact mode, minimalistic and fixed sidebar
- Custom CSS editor with snippets and syntax highlighting

### 🧩 Elements (`Элементы` tab)
- Hide what you don't need: stories, recommendations, emoji status, mini-chat, "back to top" button, banners, etc.

### 🛡️ Ads (`Реклама` tab)
- Feed ads — two independent filters (one cuts before render, the other cleans whatever slipped through)
- Sidebar banners
- Tracker and analytics blocker
- Custom block-word list and whitelist
- Block log so you can see what was hidden and why

### 🔒 Privacy (`Приватность` tab)
- Message encryption — modern VKify E2E and compatible COFFEE format (Kate Mobile, VK Coffee, Laney, Vika)
- Hide specific dialogs
- Hotkey to instantly hide open dialogs
- Blur the page when the window loses focus

### ⚡ Scripts (`Скрипты` tab)
- Direct links — bypasses the `away.php` redirect
- Auto add friends on a timer
- Keyboard layout converter via hotkey

### 👁️ Online Spy (`Слежка` tab)
- Message activity — typing, reading, deleting, joining calls and so on
- Online monitor with history and weekly charts
- Profile tracker — avatar, status and friend count changes
- Browser notifications, separate list and log per subsystem

### 🗂️ Hub (`Центр` tab) — pages container
A container tab with inner pages (compact left rail, VK-style sections) so the
top bar doesn't keep growing. The **Messages** page now gathers everything
about conversations in one place:
- **Quick copy** — copy button next to every message. Shift-click copies a range
- **Dialog export** to JSON, TXT, HTML, HTML with embedded photos, or ZIP with a `photos/` folder. Built-in search and an option to decrypt with your saved key
- **Message templates** with variables (`%first_name%`, `%time%`, `%date%`, `%br%`) and file attachments; triggers — `/` at line start, hotkey, prefix autocomplete; auto-send option
- **Notes** — a bookmark button saves a message into a local archive with search by text/author/chat; stays only on your device

### 🎧 Media (`Медиа` tab)
- Player hotkeys — pause, switch, seek, speed. Can be made global (work from any browser tab)
- Video and clip downloads with quality picker up to 1080p
- One-click story download (photos and videos)
- Photo or whole album download into a subfolder

### 💻 CSS (`CSS` tab)
- Built-in editor with syntax highlighting and auto-formatting
- Ready-to-use snippets, import/export

### ⚙️ Other (`Ещё` tab)
- Feature tour on first launch
- Export / import / reset settings
- **Function search** — `Ctrl/Cmd+K` opens a palette with every feature. Pick a result and the popup jumps to that section and highlights it
- **⭐ Favorite functions** — star the ones you use the most: they pin to the top of the list
- **Quick actions in the popup header** — search, theme, ads, reload active tab
- **Settings right on the VK page** — open `vk.com/vkify_settings` or pick "VKify settings" from the profile dropdown menu
- Supports vk.com, vk.ru, vkvideo.ru

---

## Installation & Usage

**Prebuilt extension** — install from a store:

- [Chrome Web Store](https://chromewebstore.google.com/detail/vkify/lofggenkgbpdmmplnbgfplnpfjhgljla) — Chrome, Opera and other Chromium browsers
- [Firefox Add-ons](https://addons.mozilla.org/ru/firefox/addon/vkify/) — Firefox

**From source** (for development or manual install):

```bash
git clone https://github.com/VKify/vkify-extension.git
cd vkify-extension
npm install
npm run build          # builds all three: dist/chrome, dist/firefox, dist/opera
```

You can also build individually: `npm run build:chrome` / `build:firefox` / `build:opera`.

Loading the unpacked build:

- **Chrome** — `chrome://extensions` → "Developer mode" → "Load unpacked" → `dist/chrome`.
- **Opera** — `opera://extensions` → "Developer mode" → "Load unpacked" → `dist/opera`.
- **Firefox** — `about:debugging#/runtime/this-firefox` → "Load Temporary Add-on" → `dist/firefox/manifest.json` (or `npm run run:firefox`). A permanent install requires AMO signing.

Refresh any open vk.com tabs afterwards. See [CROSS_BROWSER.md](CROSS_BROWSER.md) for cross-browser details.

**How to use:**

- Click the VKify icon in the browser toolbar — the settings popup opens (11 tabs).
- Or open `vk.com/vkify_settings` (or "VKify settings" in the profile menu) — the same settings right on the VK page.
- `Ctrl/Cmd + K` in the popup — search across every feature.
- Settings apply instantly and stay in sync between the popup and the page.

---

## Architecture

The extension is split into several layers that talk over Chrome Storage and the Message API:

```
┌─────────────────┐     chrome.runtime      ┌──────────────────┐
│  popup (React)  │ ◄──────────────────────  │  background SW   │
│  settings UI    │  ───────────────────────► │  VK API, alarms  │
└─────────────────┘                           └──────────────────┘
                                                       │
                                             chrome.tabs.sendMessage
                                                       │
                                            ┌──────────▼──────────┐
                                            │   content script    │
                                            │   page features     │
                                            └─────────────────────┘
                                                       │
                                            ┌──────────▼──────────┐
                                            │  injected scripts   │
                                            │  page context (spy, │
                                            │  ad blocker, bridge)│
                                            └─────────────────────┘
```

- **background** — service worker: VK API requests, alarm management, browser notifications
- **content** — content scripts: apply CSS/JS to the VK interface, manage features via `FeatureManager`
- **injected** — page context scripts (bypass sandbox): WebSocket event interception (spy), API-level ad blocking, anti-tracking
- **popup** — React app in the extension popup: settings UI across 11 tabs
- **embed** — content script that mounts the same settings UI right on the VK page (`vk.com/vkify_settings` and the profile menu item)
- **site-bridge** — content script for vkify.ru: transfers settings from the website to the extension (on `http://localhost/*` — dev build only)

### Security

- Every setting lives in one registry, `shared/constants/settings-schema.ts`. The whitelists and the shared validator (shared themes, file import, site-bridge) are built from it.
- The `postMessage` channel between content and injected scripts is gated by a per-session nonce; the VK token is not pulled from other requests.
- CSP `script-src 'self'`, and outbound `postMessage` calls target a concrete origin, never `'*'`.
- `http://localhost/*` for site-bridge exists only in the dev manifest.
- Site links (`shared/constants/site.ts`) are injected at build time: `https://vkify.ru` in prod, `http://localhost:5173` in dev. The domain is never hard-coded.

---

## Project Structure

Directories only. File names inside them are left out so the tree stays accurate
when modules get moved around.

```
vkify/
├── .github/                          # Workflows, issue/PR templates, README media
│   ├── assets/
│   ├── ISSUE_TEMPLATE/
│   └── workflows/
├── e2e/                              # Playwright tests for the popup
├── manifest/                         # base.json + chrome / firefox / opera overrides
├── public/
│   ├── icons/                        # Extension icons (16–300 px)
│   ├── styles/                       # Static content-script CSS
│   └── wallpapers/                   # Wallpaper catalog
├── scripts/                          # Build, size checks, packaging
└── src/
    ├── __tests__/                    # Unit tests (Vitest)
    ├── background/                   # Service worker: VK API, alarms, notifications
    │   ├── handlers/
    │   ├── services/
    │   └── utils/
    ├── content/                      # Content scripts
    │   ├── api/
    │   ├── core/                     # FeatureManager, CSS/script injectors, cache
    │   ├── embed/                    # Settings mounted on the VK page (vk.com/vkify_settings)
    │   ├── features/
    │   │   ├── ads-blocking/
    │   │   ├── appearance/
    │   │   │   ├── background/        # Wallpapers: images, videos, web
    │   │   │   ├── filters/           # Visual filters
    │   │   │   ├── font/
    │   │   │   ├── header/
    │   │   │   ├── layout/            # Content width, offset, border radius
    │   │   │   ├── sidebar/
    │   │   │   └── theme/
    │   │   ├── automation/           # away.php, auto friends, layout switch
    │   │   ├── center/               # "Центр" hub
    │   │   │   ├── feed/             # Expand post text
    │   │   │   ├── messages/         # Messages page
    │   │   │   │   ├── _shared/
    │   │   │   │   ├── dialog-export/
    │   │   │   │   ├── pin-note/
    │   │   │   │   ├── quick-copy/
    │   │   │   │   └── templates/
    │   │   │   └── player/
    │   │   ├── custom-css/
    │   │   ├── elements/             # Hide UI blocks
    │   │   │   ├── communities/
    │   │   │   ├── feed/
    │   │   │   ├── friends/
    │   │   │   ├── global/
    │   │   │   ├── menu/
    │   │   │   ├── messenger/
    │   │   │   ├── music/
    │   │   │   └── profile/
    │   │   ├── media/                # Download video / clips / stories / photos / audio
    │   │   │   ├── _shared/
    │   │   │   ├── audio/
    │   │   │   ├── clip/
    │   │   │   ├── photo/
    │   │   │   ├── story/
    │   │   │   └── video/
    │   │   ├── privacy/
    │   │   │   ├── crypto/           # Message encryption (VKify E2E / COFFEE)
    │   │   │   └── dialogs/          # Hide dialogs, hotkeys
    │   │   ├── spy/                  # Online status tracking
    │   │   └── utils/
    │   ├── injected/                 # Page context scripts (spy, ad blocking, bridge)
    │   ├── services/                 # Background comms, SPA navigation, token
    │   ├── ui/
    │   │   └── download-center/      # On-page download center
    │   └── utils/
    ├── popup/                        # React extension UI
    │   ├── components/
    │   │   ├── charts/
    │   │   ├── icons/
    │   │   ├── layout/
    │   │   ├── modals/
    │   │   ├── onboarding/
    │   │   ├── tabs/                 # 11 popup tabs
    │   │   │   ├── appearanceSections/
    │   │   │   ├── center/
    │   │   │   │   ├── feed/
    │   │   │   │   ├── messages/
    │   │   │   │   └── player/
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
    │   │   └── ui/                   # Shared UI primitives
    │   ├── constants/
    │   ├── context/
    │   ├── hooks/
    │   │   ├── core/
    │   │   └── features/
    │   └── utils/
    │       └── css/
    ├── shared/                       # Code shared across all layers
    │   ├── constants/                # settings-schema, defaults, site, storage keys
    │   └── utils/                    # vk-fetch, zip, ttl-cache, page-channel, etc.
    └── types/                        # Project TypeScript types
```

---

## Build & Development

```bash
npm install

npm run build          # typecheck + build all three → dist/{chrome,firefox,opera}
npm run build:chrome   # Chrome only  → dist/chrome
npm run build:firefox  # Firefox only → dist/firefox
npm run build:opera    # Opera only   → dist/opera
npm run build:fast     # quick Chrome build without typecheck
npm run build:dev      # dev Chrome build: localhost bridge + console.* kept
npm run dev            # popup dev server with hot reload
npm run typecheck      # TypeScript type check
npm run test           # run tests (Vitest)
npm run run:firefox    # launch Firefox with the extension (web-ext)
npm run lint:firefox   # validate the package against AMO rules (web-ext lint)
npm run package:chrome # build + package a .zip (same for firefox/opera)
npm run clean          # remove dist/ folder
```

The build is split (`scripts/build.mjs`): popup and background are bundled as
ES modules, while `content.js`, `embed.js`, `site-bridge.js` and `injected/*.js`
are built as standalone IIFE bundles. A classic script can't use ES `import`, and
the bundle still reuses code from `shared/`.

### Cross-browser (Chrome / Firefox / Opera)

One codebase, three packages. Only the manifests and a tiny API-normalisation
layer are browser-specific:

- **Manifests** — a shared `manifest/base.json` plus `manifest/{chrome,firefox,opera}.json`
  overrides, merged at build time into `dist/<browser>/manifest.json`. Firefox gets
  `background.scripts` (event page) instead of a service worker,
  `browser_specific_settings.gecko` and a CSP without `base-uri`; Opera mirrors the Chromium base.
- **API** — code calls `chrome.*` in promise style; on Firefox
  [`src/shared/ext-api.ts`](src/shared/ext-api.ts) points the global `chrome` at the
  native `browser` (promises + working `return true`/`sendResponse`). No-op on Chromium.
  webextension-polyfill is intentionally NOT used (its `onMessage` wrapper breaks the
  `return true` pattern).
- **Targeted engine differences** — via the `IS_FIREFOX` build constant
  ([`src/shared/constants/browser.ts`](src/shared/constants/browser.ts)): e.g. the
  Chrome-only `priority` field in `notifications.create`, and `cloneInto` for
  content→injected events (Firefox isolates the worlds).

Full guide, Firefox specifics (host_permissions, AMO signing) and packaging are in
[CROSS_BROWSER.md](CROSS_BROWSER.md).

- **prod** (`build` / `build:fast`) — `console.*` stripped, no
  `http://localhost/*` in the manifest, `SITE_URL = https://vkify.ru`.
- **dev** (`build:dev`) — `console.*` kept, `http://localhost/*` added to the
  site-bridge match, `manifest.homepage_url` rewritten to the dev URL,
  `SITE_URL = http://localhost:5173`. Every outbound extension link points to
  the local landing automatically.
- **Custom URL** — `VKIFY_SITE_URL=http://localhost:3000 npm run build:dev`
  (when the frontend dev server runs on a non-default port).

After building, load the `dist/chrome` folder (or `dist/opera` / `dist/firefox`)
via your browser's extensions page → "Load unpacked". After reloading the
extension, refresh open vk.com tabs (MV3 content scripts are not re-injected
automatically).

---

## Tests

Tests run on [Vitest](https://vitest.dev) (`node` environment) and live in
`src/__tests__/`.

```bash
npm test               # one-off run
npm run test:watch     # watch mode
npx vitest run --coverage   # with coverage (@vitest/coverage-v8, already in devDeps)
```

Tests cover pure business logic and the spots that are easy to break. DOM and
network stay out of it: `chrome.*` is mocked, with fake timers where needed.

- **Crypto core** (`message-crypto`) — AES-128/256, PBKDF2, COFFEE/VKify, KAT vectors
- **Spy event parser** (`spy-events`) — every LongPoll event type, long-poll URL
  match, direct-vs-group attribution, deleted-message text
- **Settings registry** (`settings-schema`) — type/enum/scope validation,
  prototype-pollution resistance, untrusted-input sanitization
- **VK API** (`vk-api`, `message-handler`) — token flow, retries, message routing
- **Online tracker** (`spy-tracker`) — status polling, alarms, log
- **Utilities** — ZIP writer (`zip`), TTL cache (`ttl-cache`), nonce channel
  (`page-channel`), feature enabling (`should-enable`), CSS highlighting (`highlighter`)

---

## Tech Stack

| Layer | Technologies |
|---|---|
| Extension UI | React 18, TypeScript 5, Tailwind CSS 3 |
| Build | Vite 5, Rollup: split into modules (ESM) + classic (IIFE) |
| Tests | Vitest |
| Content scripts | Vanilla TypeScript |
| Background worker | TypeScript, Chrome Alarms API |

---

## Support the Project

If you enjoy VKify, you can support development:

| Method | Link |
|--------|------|
| 🇷🇺 Russian cards (Visa, MasterCard, МИР) | [Cloudtips](https://pay.cloudtips.ru/p/b59e1765) |
| 🌍 International cards & crypto | [Tribute](https://t.me/tribute/app?startapp=dE4k) |
