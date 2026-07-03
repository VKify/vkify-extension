# Архитектура VKify

Этот документ — финальное описание архитектуры расширения. Цель: новая фича
добавляется **без правок ядра** и без глобальных рефакторингов. Если для фичи
приходится менять `src/content/core/` — что-то пошло не так, перечитай раздел
«Как добавить фичу».

## Карта слоёв

```
src/
├── shared/            ← общий код ВСЕХ миров (типы не тянут DOM/React)
│   ├── constants/     ← settings-schema, defaults, storage-keys,
│   │                    feature-conflicts, presets, perf
│   ├── store/         ← каноничный Zustand-store настроек (кросс-контекстный)
│   └── storage/       ← версионированные миграции chrome.storage (Migrator)
├── background/        ← service worker: сообщения, VK OAuth, shared-theme URL
├── content/
│   ├── core/          ← ЯДРО (не трогать при добавлении фич)
│   │   ├── feature-manager.ts      ← фасад FeatureContext + активация фич
│   │   ├── features/               ← FeatureDefinition, плагины, реестр
│   │   ├── dom/                    ← единый DOM-observer (selectors — рядом)
│   │   ├── services/               ← ServiceContainer (DI) + EventBus
│   │   ├── api/                    ← VKApiService (токен, мост, очередь)
│   │   └── perf/                   ← perfCollector (телеметрия)
│   ├── features/      ← ФИЧИ по доменам (сюда добавляется новое)
│   │   ├── _blueprint/             ← шаблон новой фичи (копируй отсюда)
│   │   ├── appearance/ hiding/ ads-blocking/ privacy/ automation/
│   │   ├── center/ (профиль/сообщения/плеер/загрузки) spy/ custom-css/
│   │   └── performance/
│   └── selectors/     ← централизованные DOM-селекторы VK
├── popup/             ← React + Zustand (store/), вкладки и подстраницы
└── injected/          ← page-world скрипты (мир страницы VK)
```

Правила зависимостей между мирами:

- **popup ↛ content, content ↛ popup** — разные бандлы. Всё общее (типы,
  ключи, конфликты, пресеты) живёт в `src/shared/` и `src/types/`.
- `content/features/*` импортируют ядро только через баррель
  `@/content/core/features/index.js` и тип `FeatureManager`.
- page-world общается с content через CustomEvent (`ctx.sendEvent` /
  `dispatchPageEvent`), «раз-инъектировать» скрипт нельзя — выключение фичи
  шлёт событие с off-настройкой.

## Фича = FeatureDefinition

Единица функциональности — `FeatureDefinition`
([feature-definition.ts](src/content/core/features/feature-definition.ts)):
декларативная метадата (id, name, category, impact, phase, dependencies…) +
набор **плагинов** поведения + необязательные `init`/`destroy`.

**Один API регистрации**: `manager.registerDefinition(def)` /
`registerDefinitions(defs)` в доменном регистраторе
(`src/content/features/<домен>/index.ts`). Других способов нет (legacy
`registerHandlerMap`/`describeFeatures` удалены).

**Инвариант id**: `id` фичи == её ключ настроек; `settings[id]` — тумблер
(семантику «включено» задаёт [should-enable.ts](src/content/core/should-enable.ts):
true / число > 0 / непустая строка / непустой массив). Дополнительные
ключи-значения (слайдер, выпадашка) — это **watch-ключи той же фичи**, а не
отдельные фичи.

### Три хелпера (покрывают ~95% случаев)

| Хелпер | Когда | Пример |
|---|---|---|
| `cssFeature()` | чистый CSS-тумблер: маркер `data-vkify-<id>` + colocated CSS | всё `hiding/`, фильтры, сайдбар |
| `derivedCssFeature()` | N настроек → CSS-переменные/сгенерированный CSS (rAF-коалесинг и дебаунс-персист внутри) | `appearance/layout/widescreen.ts` |
| `handlerFeature()` | императивное ядро enable/disable (пайплайны, page-world, DOM-UI) | загрузки, эквалайзер, spy, фон |

Шаблоны всех трёх с чек-листом — в
[src/content/features/_blueprint/index.ts](src/content/features/_blueprint/index.ts).

### Плагины

Поведение фичи собирается из плагинов
([feature-plugin.ts](src/content/core/features/feature-plugin.ts)) с контрактом
`setup / onEnable / onDisable` (+ `priority`, `dependsOn` — порядок топологический,
teardown в обратном порядке, см. `PluginManager`):

- `cssPlugin(files)` — маркер `data-vkify-<id>` на `<html>`;
- `settingsPlugin(keys)` — изменение любого из `keys` → `ctx.reapply()`
  (собственный id фичи исключается — им управляет FeatureManager);
- `scriptPlugin(name)` — идемпотентная инъекция page-world скрипта;
- `derivedCssPlugin(spec)` — механика derived-CSS (см. хелпер);
- `handlerPlugin(handler)` — адаптер императивного enable/disable.

Новый вид поведения = новый плагин; ядро (compile + FeatureManager) о
конкретных аспектах не знает.

### Жизненный цикл

1. **Фазы инициализации** (`phase`): `early-css` (визуальный CSS, до первой
   отрисовки; мгновенность обеспечивают localStorage-зеркала маркеров и
   inject-CSS на `document_start`) → `dom-ready` (default) → `late`
   (API/LongPoll, активируется в idle-колбэке). Порядок внутри фазы:
   toposort по `dependencies`, тай-брейк `initOrder`. Фича автоматически
   «поднимается» в фазу своей зависимости.
2. **enable**: `setup(все плагины) → onEnable(все) → init(фичи)`. Жёсткий
   re-enable активной фичи делает `disable → enable`, КРОМЕ фич с
   `reapplyOnUpdate` (идемпотентный enable без кадра-сброса — так работают
   цвет/палитра без мерцания).
3. **reapply** (SPA-навигация — `reapplyOnNavigate`; смена watch-ключа —
   `settingsPlugin`): мягкая пересборка на месте, без teardown → без пустого
   кадра. Коалесируется на микротаске.
4. **disable**: `destroy(фичи) → onDisable(плагины, LIFO) → полная очистка
   scope`. Всё, что создано через `ctx` (ScopedFeatureContext: `addCSS`,
   observers, `onSettingChange`…), снимается автоматически — вручную хранить
   unsubscribe не нужно.
5. **Реактивность storage**: FeatureManager слушает `storage.onChange`; смена
   `settings[id]` включает/выключает фичу, смена watch-ключа — reapply. Popup
   пишет настройки через свой Zustand-store → chrome.storage → все вкладки.

### Ошибки и телеметрия

Активация каждой фичи обёрнута (`runEnable`): ошибка одной фичи не валит
остальные, попадает в `getFailedFeatures()` (perf-дашборд), время enable —
в perfCollector. EventBus эмитит `feature:enabled` / `feature:disabled` /
`feature:conflict`.

## Feature Intelligence

- **Конфликты** — единый источник
  [src/shared/constants/feature-conflicts.ts](src/shared/constants/feature-conflicts.ts)
  (пары + причина). Его читают ОБА мира: FeatureRegistry кладёт
  `meta.conflictsWith` и FeatureManager пишет `console.warn` + событие при
  активации второй фичи пары; popup (`ConflictWatcher` +
  `popup/utils/conflicts.ts`) показывает warning-toast в момент включения.
  Конфликт информационный: обе фичи продолжают работать. Добавить конфликт =
  одна запись в `FEATURE_CONFLICTS`. В `FeatureDefinition` поля `conflictsWith`
  нет — намеренно (один источник, без merge-логики).
- **Пресеты** — data-only
  [src/shared/constants/presets.ts](src/shared/constants/presets.ts)
  (`Partial<ExtensionSettings>` — несуществующий ключ не пройдёт typecheck).
  Применяет popup (`PresetsSection`): `replacesAppearance: true` — через
  `buildApplyPatch` (сброс оформления + патч, как профили), иначе — точечный
  merge. Пресеты ≠ профили: профили — пользовательские снимки, пресеты —
  встроенные, версионируются с кодом.

## Настройки

- **Схема trust-границ**: [settings-schema.ts](src/shared/constants/settings-schema.ts)
  — каждый ключ, пересекающий границу доверия (импорт JSON, shared-theme URL,
  site-bridge), объявлен один раз с типом и scope'ами. Все allowlist'ы и
  валидаторы деривируются отсюда.
- **Типы**: `ExtensionSettings` в [src/types/index.ts](src/types/index.ts) —
  добавляя ключ, добавь поле сюда.
- **Дефолты**: [defaults.ts](src/shared/constants/defaults.ts) (сидятся при
  установке/обновлении).
- **Миграции**: версионированная схема storage —
  `src/shared/storage/migrations/` + `Migrator` (см. `CURRENT_SCHEMA_VERSION`).
  Переименование/смена формата ключа = новая миграция, не «умный» код чтения.

## Popup

React + Zustand (`src/popup/store/`); вкладки (`components/tabs/`) +
подстраницы (`SubpageHost`/`DetailPage`/`NavRow`) для фич с большим числом
опций. Каждая функция — запись в
[popup/constants/functions.ts](src/popup/constants/functions.ts) (поиск Ctrl+K);
якорь `data-vkify-anchor` открывает нужную подстраницу.

## Как добавить фичу (кратко)

1. Ключ → `settings-schema.ts` (если пересекает trust-границу) + тип в
   `ExtensionSettings`; дефолт → `defaults.ts` (если нужен).
2. Папка `src/content/features/<домен>/<фича>/` + определение по одному из
   трёх рецептов `_blueprint/index.ts`; colocated CSS рядом.
3. Регистрация в `registerDefinitions(...)` доменного `index.ts`.
4. Popup: тумблер + запись в `functions.ts`; конфликты → `feature-conflicts.ts`.
5. `npm run typecheck && npm run lint && npm test && npm run build` — всё зелёное.

## Верификация

| Команда | Что делает |
|---|---|
| `npm run typecheck` | `tsc -p tsconfig.app.json --noEmit` |
| `npm run lint` | eslint (inline-конфиги игнорируются) |
| `npm test` | vitest (юнит-тесты, включая фичевое ядро) |
| `npm run build` | typecheck + сборка всех браузеров |
| `npm run build:dev` | dev-сборка Chrome |

E2E через `--load-extension` на Chrome 149+ недоступен — финальная проверка
руками: драг слайдеров (ширина/смещение), циклы тумблеров, SPA-навигация,
перезагрузка страницы (self-heal localStorage-зеркал через reconcile).

## Чего НЕ делать

- Не добавлять новые способы регистрации фич и не править ядро под конкретную фичу.
- Не заводить отдельную «фичу» под ключ-значение — это `watch` существующей.
- Не импортировать content из popup (и наоборот) — общее только в `shared/`.
- Не обходить `ctx` при создании ресурсов — иначе утечки на disable/reapply.
- Не хардкодить DOM-селекторы VK в фичах — им место в `src/content/selectors/`.
