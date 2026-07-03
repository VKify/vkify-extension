import React, { useEffect } from 'react';
import { ToastProvider } from './context/ToastContext.js';
import { useVKifyStore } from './store/index.js';
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

  return (
    <ToastProvider>
      <ConflictWatcher />
      <Layout />
    </ToastProvider>
  );
}
