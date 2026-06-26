import React, { useEffect } from 'react';
import { ToastProvider } from './context/ToastContext.js';
import { useVKifyStore } from './store/index.js';
import Layout from './components/layout/Layout.js';

/**
 * Корень popup'а: инициализация стора + глобальные провайдеры + каркас.
 *
 * Настройки и UI-навигация живут в Zustand-сторе (`store/`), поэтому отдельного
 * SettingsProvider больше нет — стор инициализируется здесь (`initStorageSync`:
 * загрузка настроек + подписка на chrome.storage.onChanged) один раз на mount.
 * Роутинг верхнего уровня (`activeTab`) и второй уровень (`SubpageHost` внутри
 * вкладок) сделаны на состоянии осознанно: popup не имеет адресной строки/history.
 */
export default function App(): React.ReactElement {
  useEffect(() => {
    useVKifyStore.getState().initStorageSync();
  }, []);

  return (
    <ToastProvider>
      <Layout />
    </ToastProvider>
  );
}
