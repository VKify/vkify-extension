# История изменений / Changelog

Все значимые изменения VKify перечислены в этом файле.

All notable changes to VKify are documented in this file.

## [1.8.1] — 2026-07-25

### Русский

#### Производительность

- Рендерер PDF-экспорта разбит на ленивые чанки: страница рендера отвечает сразу, а html2canvas и jsPDF грузятся параллельно с передачей диалога, а не до неё.
- html2canvas и jsPDF вынесены в отдельные vendor-чанки — они кэшируются независимо от кода рендерера, и ни один чанк сборки больше не превышает 500 KB.

#### Сборка и инфраструктура

- Обновлена база браузеров `caniuse-lite` — сборка больше не предупреждает об устаревших данных Browserslist.
- Бюджеты размеров переписаны под новую раскладку PDF-чанков, а сами чанки добавлены в проверку состава production-сборки.

### English

#### Performance

- Split the PDF export renderer into lazy chunks: the renderer page becomes responsive immediately, and html2canvas and jsPDF load in parallel with the conversation transfer instead of before it.
- Moved html2canvas and jsPDF into separate vendor chunks — they are cached independently of the renderer code, and no build chunk exceeds 500 KB anymore.

#### Build and infrastructure

- Updated the `caniuse-lite` browser database — the build no longer warns about outdated Browserslist data.
- Reworked the size budgets for the new PDF chunk layout and added those chunks to the production build composition check.

## [1.8.0] — 2026-07-24

### Русский

#### Новые возможности

- Добавлена полная русская и английская локализация интерфейса расширения: popup, страницы настроек, onboarding, виджеты и элементы на страницах VK. Язык можно менять без перезагрузки вкладки.
- Добавлен экспорт диалогов в PDF с выбором сообщений, разбивкой по дням, аватарами, вложениями и кликабельными ссылками.
- Экспорт сообщений теперь поддерживает входящие сообществ (`gim`).
- Для загрузки музыки можно выбрать исходный формат или конвертацию в MP3.
- Расширение и актуальные селекторы интерфейса переведены на `vk.ru`.
- Централизована конфигурация пунктов меню и добавлена корректная логика показа промо Яндекс Браузера.

#### Производительность

- Формирование PDF вынесено из вкладки VK: Chrome и Opera используют offscreen-документ, Firefox — изолированную фоновую вкладку. Добавлены потоковая передача данных, отмена операции и освобождение ресурсов.
- HLS-to-MP3 энкодер исключён из критического пути `document_start` и загружается только при необходимости.
- Облегчена HLS-сборка; тяжёлые вкладки popup и словари локализации разбиты на ленивые чанки.
- Добавлены проверки размера и состава production-сборок.

#### Безопасность

- Удалены небезопасные случаи динамического `innerHTML`; подсветка CSS теперь формируется безопасными React-узлами.
- Усилена проверка URL, CSS и импортируемых настроек/тем.
- Добавлены ограничения отправителей для runtime-сообщений, лимиты и таймауты сетевых операций, более безопасная работа с токенами и storage.
- Уточнены CSP и browser permissions; исправлен несовместимый с Android вызов `permissions.request`.

#### Исправления и совместимость

- Устранены серьёзные зависания вкладки VK и падение FPS во время PDF-экспорта.
- Исправлены селекторы боковой панели и перестановки колонок в интерфейсе сообществ.
- Исправлено отображение баннера Яндекс Браузера в диалогах.
- Улучшена совместимость сборок Chrome, Firefox и Opera; минимальная версия Chrome повышена до 109 для offscreen API.
- Исправлено дублирование permissions из базового manifest при сборке Chrome и Opera.

### English

#### Features

- Added complete Russian and English localization across the popup, settings, onboarding, widgets, and injected VK UI. The language can be switched without reloading the tab.
- Added PDF conversation export with message selection, day separators, avatars, attachments, and clickable links.
- Added community inbox (`gim`) support to message export.
- Added Original/MP3 format selection for music downloads.
- Migrated the extension and current UI selectors to `vk.ru`.
- Centralized menu-item configuration and added correct Yandex Browser promotion visibility rules.

#### Performance

- Moved PDF generation out of the VK tab: Chrome and Opera use an offscreen document, while Firefox uses an isolated background tab. Streaming, cancellation, and resource cleanup were added.
- Removed the HLS-to-MP3 encoder from the `document_start` critical path and load it only when needed.
- Reduced the HLS bundle and split heavy popup tabs and locale dictionaries into lazy chunks.
- Added production bundle composition and size checks.

#### Security

- Removed unsafe dynamic `innerHTML` usage; CSS highlighting is now rendered as safe React nodes.
- Hardened validation of URLs, CSS, and imported settings/themes.
- Added runtime message sender restrictions, network limits and timeouts, and safer token/storage handling.
- Tightened CSP and browser permissions and removed an Android-incompatible `permissions.request` path.

#### Fixes and compatibility

- Fixed severe VK tab freezes and FPS drops during PDF export.
- Updated sidebar and community column-swap selectors.
- Fixed Yandex Browser banner visibility in conversations.
- Improved Chrome, Firefox, and Opera build compatibility; the minimum Chrome version is now 109 for the offscreen API.
- Fixed duplicate base-manifest permissions in Chrome and Opera builds.

[1.8.1]: https://github.com/VKify/vkify-extension/compare/v1.8.0...v1.8.1
[1.8.0]: https://github.com/VKify/vkify-extension/compare/v1.7.1...v1.8.0
