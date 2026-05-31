import { useState, useEffect, useCallback } from 'react';
import { sendMessage } from '../../../shared/messaging.js';

export interface ApiMethodInfo {
  type: 'native' | 'token' | 'no_api' | 'no_vk_tab' | 'unknown' | 'error';
  label: string;
  description: string;
  color: 'green' | 'blue' | 'red' | 'gray';
}

export interface ApiMethodHook {
  apiMethod: ApiMethodInfo | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useApiMethod(): ApiMethodHook {
  const [apiMethod, setApiMethod] = useState<ApiMethodInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const checkApiMethod = useCallback(async (): Promise<void> => {
    setLoading(true);

    // Опрос вкладок делает background: у popup в embed-режиме Firefox нет своего
    // chrome.tabs, а chrome.runtime.sendMessage доступен в обоих контекстах.
    try {
      const resp = await sendMessage({ type: 'GET_API_METHOD' });

      if (!resp?.hasVKTab) {
        setApiMethod({
          type: 'no_vk_tab',
          label: 'Нет открытых вкладок VK',
          description: 'Откройте vk.com для определения метода API',
          color: 'gray',
        });
      } else if (resp.nativeApiAvailable) {
        setApiMethod({
          type: 'native',
          label: 'Native API (vkApi.api)',
          description: 'Использует встроенный VK API без токена',
          color: 'green',
        });
      } else if (resp.hasToken) {
        setApiMethod({
          type: 'token',
          label: 'Token API',
          description: 'Использует токен доступа для запросов',
          color: 'blue',
        });
      } else {
        setApiMethod({
          type: 'no_api',
          label: 'API недоступен',
          description: 'Нет токена и нативный API недоступен',
          color: 'red',
        });
      }
    } catch (err) {
      console.error('[VKify] Error checking API method:', err);
      setApiMethod({
        type: 'error',
        label: 'Ошибка',
        description: (err as Error).message,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkApiMethod();
  }, [checkApiMethod]);

  return {
    apiMethod,
    loading,
    refresh: checkApiMethod,
  };
}