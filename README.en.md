<div align="center">
  <img src=".github/assets/logo.png" alt="VKify" width="96" />

  # VKify

  **A Chrome extension that makes VKontakte more comfortable, beautiful and private**

  [![Website](https://img.shields.io/badge/vkify.ru-0077FF?style=for-the-badge&logo=googlechrome&logoColor=white)](https://vkify.ru)
  [![Telegram](https://img.shields.io/badge/Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/VKify)
  [![VK](https://img.shields.io/badge/VK-4C75A3?style=for-the-badge&logo=vk&logoColor=white)](https://vk.com/vkify)
  [![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/VKify/vkify-extension)

  ![Version](https://img.shields.io/badge/version-1.2.0-blue?style=flat-square)
  ![Chrome](https://img.shields.io/badge/Chrome-105+-4285F4?style=flat-square&logo=googlechrome&logoColor=white)
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
- **72 built-in themes** across 11 categories: Classic, Soft, AMOLED, Colored, Neon, Nature, Minimal, Retro, Warm, Cool
- Custom background color and accent color
- 60+ fonts via Google Fonts
- Wallpapers — static (IMAGE), video (VIDEO), and HTML animations (WEB)
- Page offset up to ±600 px — great for ultrawide monitors
- Border radius, visual filters (grayscale, sepia, invert, etc.)
- Compact mode — removes spacing between VK blocks (classic VK and VKUI)
- Compact / fixed sidebar, collapsible search bar
- Custom CSS editor with syntax highlighting and snippets

### 🧩 Elements (`Элементы` tab)
- Hide individual interface blocks: stories, recommendations, music, clips, online statuses, story ads, banners

### 🛡️ Ads (`Реклама` tab)
Four independent filters, each toggled separately:

- **Sidebar banners** — CSS hides ad widgets in the left column
- **Feed · API filter** — intercepts the `newsfeed.get` response before rendering; strips items with `type=ads*` and flags `marked_as_ads` / `is_ad` / `ad_id`; zero latency, posts never flash in the UI
- **Feed · DOM filter** — second layer on top of the API filter:
  - persistent CSS `:has()` rules for instant hiding by ERID classes, `[data-testid="post-header-subscription-button"]`, and ad CDN domains in `img[src]`
  - JS heuristics (MutationObserver + interval): hard markers (`erid`, sponsor labels, "на правах рекламы"), ad CDN images, `aria-label` with "реклам", CTA phrases + external links, HTML obfuscation of the word "реклама"
  - `closest()` on `data-ad-checked` prevents double-processing of nested selectors
  - `WeakSet` protects the log from duplicates across `reapplyOnNavigate` cycles
- **Keywords** — expand directly under the DOM filter toggle (MediaTab pattern): block-word list and allow-list; applied in real time without page reload
- **Tracker blocker** — network interception (`fetch` / `sendBeacon` / `WebSocket` / `Image.prototype.src`) + DOM cleanup of tracking pixels; neutralizes analytics globals (`window.ym`, `window.gtag`, `window.fbq`, `VK.Retargeting`) on each new `<script>` inserted into the DOM; single list of 46+ domains (`TRACKER_DOMAINS` in `config.ts`) — source of truth for both layers
- **Block log** (100 entries): filter All / Ads / Trackers, pagination of 10; expandable details — JSON snapshot of the blocked API post with a copy button, DOM post text snippet, or tracker URL; color-coded block trigger label
- Counters and log are device-local and excluded from settings export/import

### 🔒 Privacy (`Приватность` tab)
- Hide specific dialogs by user ID
- Hotkey to instantly hide open dialogs
- Blur page on window focus loss
- Skeleton loading mode

### ⚡ Automation (`Скрипты` tab)
- Away.php bypass — external links open directly without VK redirect
- Auto-add friends
- Keyboard layout switcher

### 👁️ Online Spy (`Слежка` tab)
Three independent subsystems, each with its **own** tracked-users list and log:
- **Message activity** — typing, voice, media uploads (photo/video/file),
  reads, edits, deletions, incoming messages, calls, chat events
  (join/leave/kick), friend invisibility toggle (LongPoll v19 interception)
- **Online monitor** — sign-in/sign-out events, configurable VK API polling
  interval, activity history and weekly charts
- **Profile tracker** — periodically checks for avatar / status / friend-count
  changes via `users.get(fields=photo_100,status,counters)`; separate list,
  log and polling interval
- Browser notifications; adding a user to one subsystem doesn't affect the
  others — each has its own list and its own log
- The "Add user" modal supports all three subsystems with three sources:
  from friends, from current dialogs, manual by ID

### 💬 Templates (`Шаблоны` tab)
- CRUD editor: add, edit and delete message templates
- **Triggers** (toggled independently): `/` at the start of the input field,
  a configurable hotkey (`HotkeyPicker`), prefix-based autocomplete
- **Variables**: `%first_name%`, `%last_name%`, `%my_first_name%`,
  `%my_last_name%`, `%title%`, `%peer_id%`, `%time%`, `%date%`, `%br%`
- Resolves the peer from the VK Messenger Engine URL (`/im/convo/<id>`),
  resolves vanity URLs via `utils.resolveScreenName` (with a TTL cache),
  DOM fallback through `.ConvoHeader__info` / `.ConvoTitle__author`
- "Auto-send" option — click/Enter sends the message into VK directly via
  `messages.send`, no confirmation step
- Shadow-styled picker: SVG logo, ↑↓ navigation, auto dark-theme detection

### 🎧 Media (`Медиа` tab)
- Local hotkeys on vk.com: play/pause, next, prev, seek, playback speed
  (via `HotkeyPicker`)
- **Global** hotkeys via `chrome.commands` — work from **any** active tab in
  the browser (the background service worker rebroadcasts the command to
  every open VK tab, and the injected `player-control.js` drives `window.ap`)
- No preset values in the manifest: the user assigns shortcuts in
  `chrome://extensions/shortcuts` (the popup has a deeplink button)

### 💻 CSS (`CSS` tab)
- Built-in editor with syntax highlighting
- Live preview
- Code formatter
- Import / export
- Ready-to-use snippets

### ⚙️ Other (`Ещё` tab)
- Onboarding tour on first launch — 6 steps covering all key features
- Export / import all settings
- Quick actions in popup header (theme, ads, reload page)
- Popup window: 680 × 660 px — more content without scrolling
- Supports vk.com, vk.ru, vkvideo.ru

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
│   │   ├── highlighter.test.ts
│   │   ├── message-handler.test.ts
│   │   ├── message-handler-theme.test.ts
│   │   ├── should-enable.test.ts
│   │   ├── spy-tracker.test.ts
│   │   └── vk-api.test.ts
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
│   │   │   ├── custom-css/
│   │   │   │   └── custom-css.ts           # Custom CSS injection
│   │   │   ├── privacy/
│   │   │   │   ├── anti-tracking.ts        # Anti-tracking
│   │   │   │   ├── blur-on-unfocus.ts      # Blur on focus loss
│   │   │   │   ├── hide-dialogs-hotkey.ts  # Hotkey dialog hiding
│   │   │   │   ├── hide-specific-dialogs.ts# Hide dialogs by user ID
│   │   │   │   └── skeleton.ts             # Skeleton loading mode
│   │   │   └── spy/
│   │   │       └── index.ts                # Online status tracking
│   │   ├── injected/                       # Page context scripts
│   │   │   ├── ad-feed-blocker.ts          # Response hook: filters ads* from newsfeed.get, sends JSON snapshot to log
│   │   │   ├── anti-tracking.ts            # Anti-fingerprinting: blocks typing/read status leaks
│   │   │   ├── injected-vk-api.ts          # Access to VK's internal API
│   │   │   ├── spy.ts                      # VK WebSocket event interceptor
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
│   │   │   │   ├── OnlineSpyTab.tsx        # Online spy
│   │   │   │   ├── CSSEditorTab.tsx        # CSS editor
│   │   │   │   ├── MoreTab.tsx             # Import/export, more
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
│   │   │   ├── SettingsContext.tsx          # Global settings store
│   │   │   └── ToastContext.tsx             # In-popup notifications
│   │   ├── hooks/
│   │   │   ├── core/
│   │   │   │   ├── useHeaderNotifications.ts
│   │   │   │   ├── usePopupTheme.ts         # Popup dark/light theme
│   │   │   │   ├── useStorage.ts            # chrome.storage subscription
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
│   │   │   ├── event-emitter.ts
│   │   │   ├── fetch-hooks.ts              # Single window.fetch coordinator
│   │   │   ├── page-channel.ts             # Per-session nonce for the postMessage channel
│   │   │   ├── token.ts
│   │   │   ├── ttl-cache.ts                # Bounded cache with TTL
│   │   │   └── vk-fetch.ts                 # Single VK API call implementation
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

npm run build        # typecheck + build (prod) → dist/
npm run build:fast   # build (prod) without typecheck
npm run build:dev    # build (dev): localhost bridge + console.* kept
npm run dev          # popup dev server with hot reload
npm run typecheck    # TypeScript type check
npm run test         # run tests (Vitest)
npm run test:watch   # tests in watch mode
npm run clean        # remove dist/ folder
```

The build is split (`scripts/build.mjs`): popup and background are bundled as
ES modules, while `content.js`, `site-bridge.js` and `injected/*.js` are built
as standalone IIFE bundles (classic scripts cannot contain ES `import`; this
lets them reuse code from `shared/`).

- **prod** (`build` / `build:fast`) — `console.*` stripped, no
  `http://localhost/*` in the manifest, `SITE_URL = https://vkify.ru`.
- **dev** (`build:dev`) — `console.*` kept, `http://localhost/*` added to the
  site-bridge match, `manifest.homepage_url` rewritten to the dev URL,
  `SITE_URL = http://localhost:5173`. Every outbound extension link points to
  the local landing automatically.
- **Custom URL** — `VKIFY_SITE_URL=http://localhost:3000 npm run build:dev`
  (when the frontend dev server runs on a non-default port).

After building, load the `dist/` folder in Chrome via `chrome://extensions` →
"Load unpacked". After reloading the extension, refresh open vk.com tabs (MV3
content scripts are not re-injected automatically).

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
