<div align="center">
  <img src=".github/assets/logo.png" alt="VKify" width="96" />

  # VKify

  **A Chrome, Firefox and Opera extension that makes VKontakte more comfortable, beautiful and private**

  [![Website](https://img.shields.io/badge/vkify.ru-0077FF?style=for-the-badge&logo=googlechrome&logoColor=white)](https://vkify.ru)
  [![Telegram](https://img.shields.io/badge/Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/VKify)
  [![VK](https://img.shields.io/badge/VK-4C75A3?style=for-the-badge&logo=vk&logoColor=white)](https://vk.com/vkify)
  [![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/VKify/vkify-extension)

  ![Version](https://img.shields.io/badge/version-1.5.0-blue?style=flat-square)
  ![Chrome](https://img.shields.io/badge/Chrome-105+-4285F4?style=flat-square&logo=googlechrome&logoColor=white)
  ![Firefox](https://img.shields.io/badge/Firefox-115+-FF7139?style=flat-square&logo=firefoxbrowser&logoColor=white)
  ![Opera](https://img.shields.io/badge/Opera-Chromium-FF1B2D?style=flat-square&logo=opera&logoColor=white)
  ![Manifest](https://img.shields.io/badge/Manifest-V3-34A853?style=flat-square)
  ![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
  ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
  ![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite&logoColor=white)
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

**Prebuilt extension** — install from the [Chrome Web Store](https://vkify.ru) (the link to the current version is on the project site).

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

The extension has four independent layers communicating via Chrome Storage and Message API:

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
- **site-bridge** — content script for vkify.ru: transfers settings from the website to the extension (on `http://localhost/*` — **dev build only**)

### Security

- **Canonical settings registry** `shared/constants/settings-schema.ts` — single source of truth: every whitelist and one shared validator (shared themes, file import, site-bridge) are derived from it
- **Per-session nonce** on the token / native-API `postMessage` channel between content and injected scripts; the VK token is no longer scraped out of VK's own fetch bodies
- **CSP** `script-src 'self'`; every outbound `postMessage` is pinned to a concrete origin (no `'*'`)
- **`http://localhost/*`** for site-bridge is present only in the dev manifest, never in production
- Single shared `fetch` coordinator (one wrapper for all injected scripts instead of a 4-deep chain)
- **Env-aware companion-site links** (`shared/constants/site.ts`): `SITE_URL` is injected at build time via Vite `define` (`__VKIFY_SITE_URL__`). Every outbound link (welcome / changelog / uninstall / theme share / popup site button / wallpaper catalog) and `manifest.homepage_url` point to `http://localhost:5173` in dev and `https://vkify.ru` in prod. No hard-coded domain anywhere

---

## Project Structure

```
vkify/
├── src/
│   ├── __tests__/                          # Tests (Vitest)
│   │   ├── highlighter.test.ts             # CSS highlighting
│   │   ├── message-crypto.test.ts          # FIPS 197 / NIST KATs / GCM integrity (100 cases)
│   │   ├── message-handler.test.ts         # Background message routing
│   │   ├── message-handler-theme.test.ts   # Shared-theme apply (decode + sanitize)
│   │   ├── page-channel.test.ts            # postMessage channel nonce gate
│   │   ├── settings-schema.test.ts         # Per-scope settings validation/sanitization
│   │   ├── should-enable.test.ts           # Feature-enable logic
│   │   ├── spy-events.test.ts              # LongPoll event parser (spy)
│   │   ├── spy-tracker.test.ts             # Online tracker (background)
│   │   ├── ttl-cache.test.ts               # TTL cache: expiry, eviction
│   │   ├── vk-api.test.ts                  # VK API token flow
│   │   └── zip.test.ts                     # ZIP writer: CRC-32, archive structure
│   │
│   ├── background/                         # Service worker
│   │   ├── handlers/
│   │   │   └── message-handler.ts          # Incoming message router
│   │   ├── services/
│   │   │   ├── alarm-manager.ts            # Spy polling schedule
│   │   │   ├── notification-service.ts     # Browser notifications
│   │   │   └── spy-tracker.ts              # User tracking logic
│   │   ├── utils/
│   │   │   ├── storage.ts                  # chrome.storage wrapper
│   │   │   ├── tabs.ts                     # Tab management
│   │   │   └── vk-api.ts                   # VK API wrapper
│   │   └── index.ts
│   │
│   ├── content/                            # Content scripts
│   │   ├── api/
│   │   │   └── vk-api-client.ts            # HTTP client for VK API (via shared/utils/vk-fetch)
│   │   ├── core/
│   │   │   ├── app.ts                      # Entry point, initialization
│   │   │   ├── feature-manager.ts          # Feature registry and lifecycle
│   │   │   ├── css-manager.ts              # CSS injection and removal
│   │   │   ├── script-injector.ts          # Injects scripts into page context
│   │   │   ├── should-enable.ts            # Feature applicability check
│   │   │   └── storage.ts                  # Local settings cache
│   │   ├── features/
│   │   │   ├── appearance/
│   │   │   │   ├── background.ts           # Wallpapers (image/video/web)
│   │   │   │   ├── border-radius.ts        # Element border radius
│   │   │   │   ├── compact-spacing.ts      # Compact mode
│   │   │   │   ├── filters.ts              # Visual filters
│   │   │   │   ├── fontManager.ts          # Font loading
│   │   │   │   ├── header.ts               # VK header settings
│   │   │   │   ├── hide-elements.ts        # UI block hiding
│   │   │   │   ├── page-offset.ts          # Page offset
│   │   │   │   ├── sidebar.ts              # Compact/fixed sidebar
│   │   │   │   ├── theme.ts                # Color theme application
│   │   │   │   └── widescreen.ts           # Widescreen mode
│   │   │   ├── ads-blocking/
│   │   │   │   ├── config.ts               # TRACKER_DOMAINS (46+ domains), CONFIG, TRACKER_DOM_CONFIG
│   │   │   │   ├── shared.ts               # Shared context: stats (limit 100), ref-counted listener
│   │   │   │   ├── feed-api.ts             # API-level feed ad filter (block_feed_ads_api)
│   │   │   │   ├── feed-dom.ts             # DOM heuristics: CSS + JS analysis (block_feed_ads_dom)
│   │   │   │   ├── trackers.ts             # DOM cleanup of tracking pixels (block_trackers)
│   │   │   │   └── index.ts                # Entry point: registerMultiple into FeatureManager
│   │   │   ├── automation/
│   │   │   │   ├── auto-add-friends.ts     # Auto friend requests
│   │   │   │   ├── bypass-away-links.ts    # Away.php bypass
│   │   │   │   └── keyboard-layout.ts      # Layout switcher
│   │   │   ├── center/                     # Hub tab features (mirrors the hub pages)
│   │   │   │   ├── messages/               # Messages page: everything about chats
│   │   │   │   │   ├── quick-copy.ts       # Quick message copy
│   │   │   │   │   ├── dialog-export.ts    # Dialog export (JSON/TXT/HTML/ZIP)
│   │   │   │   │   ├── pin-note.ts         # Notes from messages
│   │   │   │   │   ├── templates.ts        # Message templates
│   │   │   │   │   └── index.ts            # registerMessagesFeatures
│   │   │   │   ├── player/                 # Player page
│   │   │   │   │   ├── player-control.ts   # VK audio player control (window.ap)
│   │   │   │   │   └── index.ts            # registerPlayerFeatures
│   │   │   │   └── index.ts                # registerCenterFeatures — single entry
│   │   │   ├── custom-css/
│   │   │   │   └── custom-css.ts           # Custom CSS injection
│   │   │   ├── media/
│   │   │   │   ├── video-download.ts       # Video download on vkvideo.ru
│   │   │   │   ├── story-download.ts       # Story download on vk.com
│   │   │   │   ├── clip-download.ts        # Clip download on vk.com / vkvideo.ru
│   │   │   │   ├── photo-download.ts       # Photo and full-album download on vk.com
│   │   │   │   └── index.ts                # Entry point: media feature registration
│   │   │   ├── privacy/
│   │   │   │   ├── anti-tracking.ts        # Anti-tracking
│   │   │   │   ├── blur-on-unfocus.ts      # Blur on focus loss
│   │   │   │   ├── hide-dialogs-hotkey.ts  # Hotkey dialog hiding
│   │   │   │   ├── hide-specific-dialogs.ts# Hide dialogs by user ID
│   │   │   │   ├── message-crypto.ts       # Feature: DOM, composer button, auto-decrypt
│   │   │   │   └── message-crypto-core.ts  # Crypto core: AES-128/256, PBKDF2, COFFEE/VKify
│   │   │   └── spy/
│   │   │       └── index.ts                # Online status tracking
│   │   ├── injected/                       # Page context scripts
│   │   │   ├── ad-feed-blocker.ts          # Response hook: filters ads* from newsfeed.get, sends JSON snapshot to log
│   │   │   ├── anti-tracking.ts            # Anti-fingerprinting: blocks typing/read status leaks
│   │   │   ├── injected-vk-api.ts          # Access to VK's internal API
│   │   │   ├── spy.ts                      # VK LongPoll response interceptor (spy feature)
│   │   │   ├── spy-events.ts               # Pure LongPoll event parser (unit-tested)
│   │   │   ├── tracker-blocker.ts          # fetch/sendBeacon/WS/Image.src + neutralizeGlobals; domains from TRACKER_DOMAINS
│   │   │   └── vk-api-bridge.ts            # Bridge: content ↔ page context
│   │   ├── services/
│   │   │   ├── message-service.ts          # Background communication
│   │   │   ├── navigation-service.ts       # SPA navigation tracking
│   │   │   └── token-service.ts            # VK token retrieval
│   │   ├── ui/
│   │   │   └── welcome-modal.ts            # Welcome modal
│   │   ├── utils/
│   │   │   ├── context-guard.ts            # Re-initialization guard
│   │   │   └── injected-ready.ts           # Script injection sync
│   │   ├── index.ts
│   │   └── site-bridge.ts                  # Bridge: vkify.ru ↔ extension
│   │
│   ├── popup/                              # React extension UI (680×660 px)
│   │   ├── components/
│   │   │   ├── charts/
│   │   │   │   ├── ActivityChart.tsx       # Daily activity chart
│   │   │   │   └── WeeklyActivityChart.tsx # Weekly activity chart
│   │   │   ├── icons/
│   │   │   │   └── Icons.tsx               # Tab and element icons
│   │   │   ├── layout/
│   │   │   │   ├── Header.tsx              # Popup header with quick actions
│   │   │   │   ├── NotificationPanel.tsx   # Notification panel
│   │   │   │   ├── QuickActions.tsx        # Quick actions (theme, ads)
│   │   │   │   ├── TabContent.tsx          # Tab content area
│   │   │   │   └── Tabs.tsx                # Navigation tabs
│   │   │   ├── modals/
│   │   │   │   ├── ActivityComparisonModal.tsx
│   │   │   │   ├── AddUserModal.tsx        # Add user to spy tracking
│   │   │   │   ├── OverallActivityModal.tsx
│   │   │   │   ├── SpyLogModal.tsx         # Spy event log
│   │   │   │   └── UserActivityModal.tsx
│   │   │   ├── onboarding/
│   │   │   │   └── OnboardingTour.tsx      # 6-step first-launch tour
│   │   │   ├── tabs/
│   │   │   │   ├── AppearanceTab.tsx       # Themes, fonts, backgrounds
│   │   │   │   ├── ElementsTab.tsx         # Hide UI blocks
│   │   │   │   ├── PrivacyTab.tsx          # Privacy settings
│   │   │   │   ├── AdsTab.tsx              # Ad blocking
│   │   │   │   ├── AutomationTab.tsx       # Automation scripts
│   │   │   │   ├── MediaTab.tsx            # Media: player hotkeys, video/story download
│   │   │   │   ├── OnlineSpyTab.tsx        # Online spy (section orchestrator)
│   │   │   │   ├── NotesTab.tsx            # Notes: saved messages archive
│   │   │   │   ├── CSSEditorTab.tsx        # CSS editor
│   │   │   │   ├── MoreTab.tsx             # Import/export, more
│   │   │   │   ├── appearanceSections/     # Sections of the Appearance tab
│   │   │   │   │   ├── BackgroundSection.tsx
│   │   │   │   │   ├── DisplayModeSection.tsx
│   │   │   │   │   ├── FontSection.tsx
│   │   │   │   │   ├── ShareSection.tsx
│   │   │   │   │   ├── ThemeSection.tsx
│   │   │   │   │   └── VisualFiltersSection.tsx
│   │   │   │   ├── spySections/            # Sections of the Online Spy tab
│   │   │   │   │   ├── ActivitySpySection.tsx
│   │   │   │   │   ├── OnlineSpySection.tsx
│   │   │   │   │   ├── ProfileSpySection.tsx
│   │   │   │   │   ├── SpyAddUserModal.tsx · SpyLogButtons.tsx · TrackedUserRow.tsx
│   │   │   │   │   └── types.ts
│   │   │   │   └── center/                  # "Центр" hub tab (subfolder = page)
│   │   │   │       ├── CenterTab.tsx       # Shell: rail + active page
│   │   │   │       ├── pages.tsx           # Hub page registry + search anchor map
│   │   │   │       ├── messages/           # Messages page
│   │   │   │       │   ├── MessagesPage.tsx
│   │   │   │       │   └── TemplatesBlock.tsx
│   │   │   │       └── player/             # Player page
│   │   │   │           └── PlayerPage.tsx
│   │   │   ├── ui/
│   │   │   │   ├── Modal.tsx                # Single modal (embed-aware)
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
│   │   │   ├── SettingsContext.tsx          # Global settings store
│   │   │   └── ToastContext.tsx             # In-popup notifications
│   │   ├── hooks/
│   │   │   ├── core/
│   │   │   │   ├── useHeaderNotifications.ts
│   │   │   │   ├── usePopupTheme.ts         # Popup dark/light theme
│   │   │   │   ├── useStorage.ts            # chrome.storage subscription
│   │   │   │   ├── useStorageReload.ts      # Reload on storage.onChanged
│   │   │   │   ├── useVKList.ts             # Load-once + searchable list scaffold
│   │   │   │   ├── useEmbedViewport.ts      # iframe visible band (embed)
│   │   │   │   └── useVKApi.ts              # VK API calls from popup
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
│   │   │       ├── useSpyTarget.ts          # Tracked-users list (online/activity/profile)
│   │   │       ├── useTrackedUsers.ts
│   │   │       ├── useVisualFilters.ts
│   │   │       └── useVKTheme.ts
│   │   ├── constants/
│   │   │   ├── appearance.ts               # Themes, fonts, categories, presets
│   │   │   ├── links.ts                    # External links
│   │   │   └── tabs.ts                     # 10-tab configuration
│   │   └── utils/
│   │       ├── css/
│   │       │   ├── formatter.ts
│   │       │   ├── highlighter.ts
│   │       │   ├── index.ts
│   │       │   └── templates.ts
│   │       ├── embedViewport.ts            # iframe visible-band store
│   │       ├── spyLog.ts                   # Spy-log formatting / filename
│   │       └── videoEmbed.ts               # Video URL parser (YouTube, VK, etc.)
│   │
│   ├── shared/                             # Code shared across all layers
│   │   ├── constants/
│   │   │   ├── alarms.ts                   # Alarm names
│   │   │   ├── defaults.ts                 # Default settings
│   │   │   ├── messages.ts                 # Message types
│   │   │   ├── settings-schema.ts          # Canonical settings registry + validator
│   │   │   ├── site.ts                     # Env-aware SITE_URL/siteUrl()/SITE_HOST
│   │   │   └── storage-keys.ts             # chrome.storage keys
│   │   ├── utils/
│   │   │   ├── download.ts                 # File download (downloadBlob/downloadText)
│   │   │   ├── event-emitter.ts
│   │   │   ├── fetch-hooks.ts              # Single window.fetch coordinator
│   │   │   ├── html.ts                     # escapeHtml (safe HTML insertion)
│   │   │   ├── page-channel.ts             # Per-session nonce for the postMessage channel
│   │   │   ├── token.ts
│   │   │   ├── ttl-cache.ts                # Bounded cache with TTL
│   │   │   ├── vk-fetch.ts                 # Single VK API call implementation
│   │   │   └── zip.ts                      # ZIP writer (STORE) for dialog export
│   │   └── videoEmbed.ts                   # Shared video URL parser
│   │
│   └── types/
│       └── index.ts                        # All TypeScript types
│
├── public/                                 # Extension icons (16–300 px)
├── .github/assets/                         # README media files
├── scripts/
│   ├── build.mjs                           # Build orchestrator (modules ESM + classic IIFE)
│   └── classic-entries.mjs                 # Classic entry list (single source)
├── manifest.json                           # Chrome Extension Manifest V3 (+ CSP)
├── vite.config.ts                          # Config: target modules | classic:<name>
└── tailwind.config.ts                      # Tailwind configuration
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
ES modules, while `content.js`, `site-bridge.js` and `injected/*.js` are built
as standalone IIFE bundles (classic scripts cannot contain ES `import`; this
lets them reuse code from `shared/`).

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

Coverage targets pure business logic and risk areas first (places where past
edits broke behavior), without DOM/network — using `chrome.*` mocks and fake
timers where needed:

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
| Build | Vite 7, Rollup — split: modules (ESM) + classic (IIFE) |
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
