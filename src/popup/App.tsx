import React from 'react';
import { SettingsProvider } from './context/SettingsContext.js';
import { ToastProvider } from './context/ToastContext.js';
import Layout from './components/layout/Layout.js';

/**
 * Корень popup'а: только глобальные провайдеры + каркас.
 *
 * Вся навигация и UI вынесены в `components/layout/Layout.tsx` — App держим
 * тонким, чтобы добавление нового провайдера или роутера не задевало логику
 * вкладок. Роутинг верхнего уровня (`activeTab`) и второй уровень (`SubpageHost`
 * внутри вкладок) сделаны на состоянии осознанно: popup не имеет адресной
 * строки/history, поэтому URL-роутер (react-router) тут не нужен.
 */
export default function App(): React.ReactElement {
  return (
    <SettingsProvider>
      <ToastProvider>
        <Layout />
      </ToastProvider>
    </SettingsProvider>
  );
}
