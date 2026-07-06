import React, { useEffect } from 'react';
import i18n from 'i18next';
import { ToastProvider } from './context/ToastContext.js';
import { useVKifyStore } from './store/index.js';
import { isSupportedLanguage } from '@/locales/index.js';
import Layout from './components/layout/Layout.js';
import ConflictWatcher from './components/ConflictWatcher.js';

/**
 * Корень popup'а: инициализация стора + глобальные провайдеры + каркас.
 *
 * Настройки и UI-навигация живут в Zustand-сторе (`store/`), поэтому отдельного
 * SettingsProvider больше нет. На mount `initStorageSync` навешивает зеркало
 * каноничного settingsStore (`@/shared/store`) → popup-store; сами миграции и
 * подписку на chrome.storage.onChanged держит settingsStore (стартует при импорте).
 * Роутинг верхнего уровня (`activeTab`) и второй уровень (`SubpageHost` внутри
 * вкладок) сделаны на состоянии осознанно: popup не имеет адресной строки/history.
 */
export default function App(): React.ReactElement {
  useEffect(() => {
    useVKifyStore.getState().initStorageSync();
  }, []);

  // Мост стор → i18next: язык хранится в настройках (переживает reload и
  // синхронится между контекстами), i18next держит его как рантайм-состояние.
  // Подписка узкая — ре-рендерит только на смену языка; react-i18next сам
  // перерисует потребителей по событию `languageChanged`. При гидратации store
  // это же выставит сохранённый язык поверх стартового детекта из i18n.ts.
  const language = useVKifyStore((s) => s.settings.language);
  useEffect(() => {
    if (isSupportedLanguage(language) && i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
  }, [language]);

  return (
    <ToastProvider>
      <ConflictWatcher />
      <Layout />
    </ToastProvider>
  );
}
