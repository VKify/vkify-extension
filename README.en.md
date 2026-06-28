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

  ![Version](https://img.shields.io/badge/version-1.7.0-blue?style=flat-square)
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

VKify packs everything VK usually lacks into one extension: your own look, an ad-free feed, private messaging, media downloads and messaging tools. Settings open in the popup (10 tabs) or right on the page at `vk.com/vkify_settings`. Press `Ctrl/Cmd + K` for search across every function.

### Appearance

- 72 built-in themes across 11 categories (Classic, Soft, AMOLED, Colored, Neon, Nature, Minimal, Retro, Warm, Cool) plus automatic light/dark switching
- Custom accent color for the whole interface palette — with a live preview or auto-derived from the chosen wallpaper
- 60+ fonts via Google Fonts with size, line-height, weight and style controls
- Page wallpapers: images (from a file or a URL), video and HTML animations, with blur, dimming and opacity
- Visual image filters: grayscale, sepia, invert, contrast, blur, dimming
- Adjustable corner radius and avatar shape (drop, leaf, petal, blob)

### Layout & navigation

- Widescreen mode with an adaptive two-column profile
- Custom content width
- Compact mode that removes extra spacing between blocks (classic VK and VKUI)
- Page offset up to ±600 px for wide monitors
- Minimalistic left menu with tooltips and fixed-on-scroll positioning
- Hide individual left-menu items and their counters
- Swap messenger panels: conversation list on the right, open dialog on the left
- Swap the columns on profile and community pages
- Collapsible search, back-to-top button, skeleton mode while loading

### Clean feed & ad blocking

- Block the left ad block
- Block feed ads at the API level and, separately, via a DOM filter with its own keyword list
- Block trackers and analytics: Yandex.Metrica, Google Analytics, Facebook Pixel and others
- Block log with filters, pagination and a JSON snapshot for API blocks

### Hiding interface elements

- Feed stories and the "people you may know" stories on profiles
- The right column in the feed and on profile pages
- The post composer and comments under posts
- Recommendations, the "people you may know" carousel, the emoji status next to your name
- The promo block on profiles and ads in the music section
- Mini-chat, the back-to-top button
- Menu items, counters and the "Settings" menu entry
- Recent communities and recommended channels in the messenger

### Privacy

- Message encryption with two protocols: COFFEE (compatible with Kate Mobile, Laney, Vika) and VKify E2E v2 on AES-256-GCM with PBKDF2; incoming messages are decrypted automatically
- Invisible mode: you stay hidden online and, in turn, can't see others' online status
- Hide "typing…" from the other person and don't mark messages as read
- Hide conversations with a hotkey, plus a list of hidden chats
- Blur the page when the window loses focus

### Center

A hub for messaging, feed and media tools, built like VK's own sections with a left rail and subpages.

- **Messages** — quick-copy a message (Shift+click for a range), export a dialog to JSON, TXT, HTML or ZIP with attachments, plus templates and notes
- **Templates** — an editor with variables (`%first_name%`, `%title%`, `%date%` and more), triggered by "/" or a hotkey, with an optional "send immediately" mode
- **Notes** — tied to dialogs, searchable by content, pinnable, grouped by day with author avatars
- **Feed** — expand long post text, download stories
- **Video** — download with quality selection from 1080p down to 240p
- **Clips** — download VK Clips with quality selection
- **Photo** — download single photos and whole albums as ZIP (up to 1000 per request)
- **Music** — download tracks and albums as MP3 with selectable bitrate (128/192/320), ID3 tags and cover art, lyrics lookup and a filename format; batch-download from the audio page and multi-upload your own files
- **Player** — audio player hotkeys (play/pause, seek, speed), local and global via `chrome.commands`, plus resuming music after a page reload; a 10-band equalizer (Web Audio API) with a preamp, built-in and custom presets, and a collapsible floating panel
- On-page download center: progress, one-click cancel that keeps what's already downloaded, background operation

### Activity tracking

- Message activity via LongPoll interception: typing, voice messages, media, reads, edits, deletions (with the deleted text), incoming messages, calls, invisible-mode changes
- Online monitoring: logins and logouts, history and weekly charts, configurable polling interval
- Profile tracking: avatar, status and friend-count changes
- Browser notifications for every subsystem; add a user from friends, dialogs or by ID

### Automation

- Auto-add friends with limits and delays
- Keyboard layout switcher (ru↔en) on a hotkey
- away.php bypass — external links open directly, skipping VK's redirect

### Tools & settings

- Built-in CSS editor with highlighting, a formatter, live preview and ready-made snippets
- Export and import settings (statistics are preserved on import)
- Shareable themes via link — a `vkify_theme` URL parameter applies a theme in one click
- Built-in settings page on vk.com and a "VKify Settings" item in the profile menu
- Diagnostics panel with a "Copy report" button for bug reports
- Performance dashboard with a Feature Explorer (grouped by load and category) and a floating mini-widget on the page
- Onboarding tour on first launch
- Support for vk.com, vk.ru and vkvideo.ru
- Cross-browser: Chrome, Firefox and Opera from a single codebase

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

- Click the VKify icon in the browser toolbar — the settings popup opens (10 tabs).
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
- **popup** — React app in the extension popup: settings UI across 10 tabs
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
    │   │   ├── center/               # "Центр" hub — pages with media downloads
    │   │   │   ├── _shared/          # Shared download-feature utils + barrel _shared.ts
    │   │   │   ├── feed/             # "Feed": expand post text
    │   │   │   ├── messages/         # "Messages"
    │   │   │   │   ├── _shared/
    │   │   │   │   ├── dialog-export/
    │   │   │   │   ├── pin-note/
    │   │   │   │   ├── quick-copy/
    │   │   │   │   └── templates/
    │   │   │   ├── player/           # "Player": audio player hotkeys + autoplay
    │   │   │   ├── story/            # "Feed": story download
    │   │   │   ├── video/            # "Video": video download
    │   │   │   ├── clip/             # "Clips": VK Clips download
    │   │   │   ├── photo/            # "Photos": photo and album download
    │   │   │   └── music/            # "Music": MP3 download + multi-upload
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
    │   │   ├── tabs/                 # 10 popup tabs
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
