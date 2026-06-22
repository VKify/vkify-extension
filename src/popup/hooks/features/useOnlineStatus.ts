import { useCallback, useEffect, useState } from 'react';
import { StorageKey } from '@/shared/constants/storage-keys.js';

/**
 * Собственный онлайн-статус (невидимка) через приватность VK.
 *
 * Источник истины — СЕРВЕР VK, а не настройки расширения:
 *   • состояние читается из account.getPrivacySettings (key=online);
 *   • переключение пишется через account.setPrivacy(key=online).
 *
 * Чтобы не флудить API, результат кэшируется в chrome.storage
 * (StorageKey.ONLINE_STATUS_HIDDEN, не настройка — см. PRESERVED_KEYS):
 *   • первый запрос к серверу — только если кэша ещё нет;
 *   • дальше берём из кэша до следующего переключения пользователем.
 *
 * VK взаимен: скрывая свой онлайн, вы перестаёте видеть онлайн других.
 */

type CallFn = (method: string, params?: Record<string, unknown>) => Promise<unknown>;

/** Категории приватности, при которых онлайн скрыт от чужих глаз. */
const HIDDEN_CATEGORIES = new Set(['only_me', 'nobody']);

interface PrivacySettingsResponse {
  settings?: Array<{ key?: string; value?: { category?: string } | string }>;
}

function parseOnlineHidden(resp: PrivacySettingsResponse | null): boolean {
  const online = resp?.settings?.find(s => s.key === 'online');
  const category = typeof online?.value === 'string' ? online.value : online?.value?.category;
  return !!category && HIDDEN_CATEGORIES.has(category);
}

export interface OnlineStatusHook {
  /** null — состояние ещё не определено. */
  hidden: boolean | null;
  /** Идёт первичное определение с сервера. */
  loading: boolean;
  /** Идёт смена статуса. */
  busy: boolean;
  /** Переключить (true — скрыть, false — показать). Бросает при ошибке API. */
  toggle: (next: boolean) => Promise<void>;
}

export function useOnlineStatus(hasToken: boolean, call: CallFn): OnlineStatusHook {
  const [hidden, setHidden] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // Первичное определение: кэш → иначе ОДИН запрос к серверу.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const cache = await chrome.storage.local.get(StorageKey.ONLINE_STATUS_HIDDEN);
      const cached = cache[StorageKey.ONLINE_STATUS_HIDDEN];
      if (typeof cached === 'boolean') {
        if (!cancelled) setHidden(cached);   // знаем из кэша — в API не идём
        return;
      }
      if (!hasToken) return;                  // нет токена — определим, когда появится

      setLoading(true);
      try {
        const resp = await call('account.getPrivacySettings') as PrivacySettingsResponse | null;
        const isHidden = parseOnlineHidden(resp);
        if (cancelled) return;
        setHidden(isHidden);
        await chrome.storage.local.set({ [StorageKey.ONLINE_STATUS_HIDDEN]: isHidden });
      } catch {
        // не смогли определить — оставляем null, тумблер покажется выключенным
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [hasToken, call]);

  const toggle = useCallback(async (next: boolean): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      // key=online: only_me — скрыть, all — снова показать всем.
      await call('account.setPrivacy', { key: 'online', value: next ? 'only_me' : 'all' });
      setHidden(next);
      await chrome.storage.local.set({ [StorageKey.ONLINE_STATUS_HIDDEN]: next });
    } finally {
      setBusy(false);
    }
  }, [busy, call]);

  return { hidden, loading, busy, toggle };
}
