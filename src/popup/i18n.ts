/**
 * Инициализация i18next для popup'а.
 *
 * Импортируется первым в `main.tsx`. Словари грузятся ЛЕНИВО, по требованию:
 * `resourcesToBackend` + dynamic `import()` — Vite дробит каждый файл
 * `locales/<lang>/<ns>.json` в отдельный чанк, поэтому в память попадают только
 * namespace активного языка (+ fallback), а не все языки сразу. Компоненты
 * подписаны через `useTranslation` и приостанавливаются на `<Suspense>` (см.
 * main.tsx), пока нужный словарь догружается.
 *
 * Стартовый язык: явный выбор пользователя из настроек приоритетнее авто-детекта
 * браузера. На момент импорта settingsStore может быть ещё не гидратирован —
 * тогда стартуем на детекте, а App синхронизирует язык после гидрации
 * (useEffect в App.tsx).
 *
 * Голый инстанс `i18n` экспортируется по умолчанию: `i18n.t('music:…')` работает
 * и вне React (напр. при будущем выносе строк в vanilla-виджеты).
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import { settingsStore } from '@/shared/store/index.js';
import {
  PRELOAD_NAMESPACES,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  detectBrowserLanguage,
  isSupportedLanguage,
} from '@/locales/index.js';

function resolveInitialLanguage(): string {
  const saved = settingsStore.getState().settings.language;
  return isSupportedLanguage(saved) ? saved : detectBrowserLanguage();
}

void i18n
  // Ленивый загрузчик словарей: динамический импорт per (язык, namespace).
  // Шаблон с `.json` на конце даёт Vite статический glob `../locales/*/*.json`,
  // так что все словари известны сборщику и выносятся в отдельные чанки.
  .use(
    resourcesToBackend(
      (language: string, namespace: string) =>
        import(`../locales/${language}/${namespace}.json`),
    ),
  )
  .use(initReactI18next)
  .init({
    lng: resolveInitialLanguage(),
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    // Только базовый код языка (`en`, а не `en-US`) — subtags к словарям не
    // привязаны, иначе backend искал бы несуществующий `en-US/…`.
    load: 'languageOnly',
    // На init грузим только каркасные namespace активного языка (common+settings);
    // пер-табные (music, ads, …) догружаются лениво по useTranslation в своём
    // Suspense. Другие ЯЗЫКИ не грузятся вовсе, пока их не выберут.
    ns: PRELOAD_NAMESPACES,
    defaultNS: 'common',
    interpolation: {
      // React сам экранирует значения при рендере — двойное экранирование ломает
      // строки вроде «Исполнитель — Название».
      escapeValue: false,
    },
    returnNull: false,
    // Suspense: потребители ждут догрузки словаря на <Suspense> вместо мигания
    // ключами (react-i18next по умолчанию так и делает — фиксируем явно).
    react: { useSuspense: true },
  });

export default i18n;
