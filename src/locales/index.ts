/**
 * Метаданные локализации (языки, namespace, детект). Сами словари сюда НЕ
 * импортируются статически — иначе все языки попали бы в один чанк и lazy-load
 * не имел бы смысла. Загрузку JSON по требованию делает backend в
 * `src/popup/i18n.ts` (dynamic import → Vite дробит на чанки per lang+ns).
 *
 * Добавить язык = завести папку `src/locales/<code>/` с теми же namespace-
 * файлами и дописать её в `SUPPORTED_LANGUAGES` ниже (backend подхватит файлы
 * по glob-паттерну автоматически).
 *
 * Namespace добавляется симметрично: новый `*.json` в каждом языке + строка в
 * `NAMESPACES`.
 */

/** Все подключённые namespace. `common` — дефолтный (см. i18n.ts). */
export const NAMESPACES = ['common', 'settings', 'functions', 'appearance', 'ads', 'automation', 'css', 'hiding', 'notes', 'privacy', 'spy', 'center', 'modals', 'onboarding', 'music', 'perf'] as const;
export type Namespace = (typeof NAMESPACES)[number];

/**
 * Namespace, предзагружаемые на init — всегда видимый каркас (шапка, вкладки,
 * быстрые действия, поиск). `functions` — реестр Ctrl+K-палитры: она всегда
 * смонтирована в Layout, поэтому её словарь грузим сразу (иначе useTranslation
 * приостановил бы весь попап на старте). Остальные (`music`, `ads`, appearance,
 * будущие пер-табные) грузятся ЛЕНИВО при первом `useTranslation('<ns>')` и
 * приостанавливаются на ближайшем `<Suspense>` (у контента вкладки — свой).
 */
export const PRELOAD_NAMESPACES = ['common', 'settings', 'functions'] as const;

/**
 * Поддерживаемые языки с нативными названиями — рендерятся как есть в
 * переключателе (нативное название не переводится: «Русский» всегда «Русский»).
 * Порядок в массиве = порядок в списке выбора.
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'ru', nativeName: 'Русский' },
  { code: 'en', nativeName: 'English' },
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]['code'];

/** Дефолтный язык и язык-фолбэк для отсутствующих ключей. */
export const DEFAULT_LANGUAGE: SupportedLanguage = 'ru';

const SUPPORTED_SET = new Set<string>(SUPPORTED_LANGUAGES.map((l) => l.code));

/** True, если строка — один из поддерживаемых кодов языка. */
export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === 'string' && SUPPORTED_SET.has(value);
}

/**
 * Определение языка по браузеру для ПЕРВОГО запуска (когда пользователь ещё не
 * выбрал язык явно). Берём базовый subtag из `navigator.language`
 * (`en-US` → `en`); если он не поддержан — дефолт `ru`.
 */
export function detectBrowserLanguage(): SupportedLanguage {
  const raw = (typeof navigator !== 'undefined' && navigator.language) || '';
  const base = raw.toLowerCase().split('-')[0];
  return isSupportedLanguage(base) ? base : DEFAULT_LANGUAGE;
}
