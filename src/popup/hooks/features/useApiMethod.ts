import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { sendMessage } from '@/shared/messaging.js';

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
  const { t } = useTranslation('settings');
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
          label: t('more.api.no_vk_tab'),
          description: t('more.api.open_vk'),
          color: 'gray',
        });
      } else if (resp.nativeApiAvailable) {
        setApiMethod({
          type: 'native',
          label: 'Native API (vkApi.api)',
          description: t('more.api.native_desc'),
          color: 'green',
        });
      } else if (resp.hasToken) {
        setApiMethod({
          type: 'token',
          label: 'Token API',
          description: t('more.api.token_desc'),
          color: 'blue',
        });
      } else {
        setApiMethod({
          type: 'no_api',
          label: t('more.api.no_api'),
          description: t('more.api.no_api_desc'),
          color: 'red',
        });
      }
    } catch (err) {
      console.error('[VKify] Error checking API method:', err);
      setApiMethod({
        type: 'error',
        label: t('more.api.error'),
        description: (err as Error).message,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    checkApiMethod();
  }, [checkApiMethod]);

  return {
    apiMethod,
    loading,
    refresh: checkApiMethod,
  };
}
