<div align="center">
  <img src=".github/assets/logo.png" alt="VKify" width="96" />
  <h1>VKify</h1>

  A Chromium and Firefox extension for VK: appearance, privacy and everyday tools.

  [Website](https://vkify.ru) · [Chrome Web Store](https://chromewebstore.google.com/detail/vkify/lofggenkgbpdmmplnbgfplnpfjhgljla) · [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/vkify/) · [Русский](README.md)

  [![CI](https://github.com/VKify/vkify-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/VKify/vkify-extension/actions/workflows/ci.yml)

  <img src=".github/assets/extension-preview.png" alt="VKify settings" width="100%" />
</div>

## Features

- **Appearance:** themes, accent colors, fonts, layout controls, image, video and web wallpapers, including Wallpaper Engine HTML projects. Appearance profiles, theme links and a CSS editor.
- **Clean interface:** ad and tracker blocking, post filters with keywords and exceptions, separate recommendation controls, and options to hide blocks and menu items. Blocking statistics and logs.
- **Privacy:** invisible mode, controls for read receipts and typing indicators, hidden dialogs, blur on focus loss, and message encryption (COFFEE and VKify E2E).
- **Media and music:** download photos, albums, stories, videos and clips; save music as MP3. Mini player, equalizer, keyboard shortcuts, autoplay, visualizer and synchronized lyrics.
- **Center:** account and dialog export, including PDF dialogs; profile and conversation statistics, attachment tools, friend auditing and adding, friend request management, subscription management and community member collection. Bulk actions include selection review, delays and stop controls.
- **Widgets:** clock, player, equalizer, visualizer, lyrics, download center and performance metrics, with visibility and positioning controls.
- **Messages and notifications:** templates and notes, activity, online and profile change tracking, browser notifications and notifications through a Telegram bot.
- **Settings:** Russian and English UI, feature search, settings import and export, diagnostics and performance metrics.

Works on `vk.ru` and `vkvideo.ru`. Open settings from the extension icon or at `https://vk.ru/vkify_settings`. Press `Ctrl/Cmd + K` in settings to search for a feature. Most changes apply immediately; switching the API ad filter may require a page refresh.

## Installation

Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/vkify/lofggenkgbpdmmplnbgfplnpfjhgljla) or [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/vkify/). Archives and version history are available in [GitHub Releases](https://github.com/VKify/vkify-extension/releases).

The manifests specify Chromium 109 and Firefox 115 as the minimum versions.

### From source

Use Node.js 22 and npm for development, matching the Node.js version used in CI.

```bash
git clone https://github.com/VKify/vkify-extension.git
cd vkify-extension
npm ci
npm run build
```

The build creates `dist/chrome` and `dist/firefox`.

- **Chromium:** open `chrome://extensions`, enable Developer mode, click “Load unpacked” and select `dist/chrome`.
- **Firefox:** open `about:debugging#/runtime/this-firefox`, click “Load Temporary Add-on” and select `dist/firefox/manifest.json`. Permanent installation requires Mozilla signing.

Refresh open VK pages after installing or reloading the extension.

## Development and checks

The UI uses React and TypeScript; page scripts and background services use TypeScript. Vite handles builds, with Vitest and Playwright for testing.

| Command | Purpose |
|---|---|
| `npm run dev` | Settings UI development server |
| `npm run build` | Typecheck and build both browsers |
| `npm run build:chrome` / `npm run build:firefox` | Build one browser without typechecking |
| `npm run build:dev` | Chrome build with the localhost bridge and logs |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint guardrails and browser compatibility |
| `npm test` | Unit and component tests |
| `npm run verify:build` | Check build structure and manifests |
| `npm run check:size` | Check gzip bundle size budgets |
| `npm run lint:firefox` | Check the Firefox build with web-ext |
| `npm run test:e2e` | Chromium E2E tests; requires both browser builds and Playwright Chromium |
| `npm run package:chrome` / `npm run package:firefox` | Build and package ZIPs in `dist/packages` |

CI runs typechecking, ESLint, tests, both browser builds, structure and size checks, Firefox lint and Chromium E2E. To run the full sequence locally:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run verify:build
npm run check:size
npm run lint:firefox
npx playwright install chromium
npm run test:e2e
```

On Linux, install system dependencies with `npx playwright install --with-deps chromium` and run E2E with `xvfb-run -a npm run test:e2e`, as in [CI](.github/workflows/ci.yml).

## Project structure

- `src/popup` — settings UI.
- `src/background` — API, downloads and notifications.
- `src/content` — features on VK pages, embedded settings and page context scripts.
- `src/shared` — settings, migrations and shared code.
- `manifest` and `scripts` — browser manifests and build tooling.
- `e2e` — browser tests; Vitest tests live in `src`.

Details: [architecture](ARCHITECTURE.md), [browser differences](CROSS_BROWSER.md), [contributing](CONTRIBUTING.md), [release notes](.github/release-notes). The architecture and contributing guides are in Russian.

## Feedback and support

[Report a bug](https://github.com/VKify/vkify-extension/issues) · [Telegram](https://t.me/VKify) · [VK community](https://vk.ru/vkify)

Support development: [Cloudtips](https://pay.cloudtips.ru/p/b59e1765) · [Tribute](https://t.me/tribute/app?startapp=dE4k).
