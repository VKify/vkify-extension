import { useState, useCallback } from 'react';
import { useToast } from '../../context/ToastContext.js';

/**
 * Общий каркас для подгружаемого один раз и фильтруемого по строке списка
 * VK-сущностей (друзья, диалоги). Инкапсулирует loading/search/filtered и
 * guard «не грузим повторно». Конкретный запрос+маппинг задаёт `fetcher`.
 *
 * `fetcher` должен быть стабильным (useCallback) — он входит в зависимости
 * колбэка `load`.
 */
export function useVKList<T extends { id: number; name: string }>(
  hasToken: boolean,
  fetcher: () => Promise<T[]>,
  errorMessage: string,
) {
  const { showToast } = useToast();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async (): Promise<void> => {
    if (!hasToken || items.length > 0) return;

    setLoading(true);
    try {
      setItems(await fetcher());
    } catch {
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [hasToken, items.length, fetcher, showToast, errorMessage]);

  const filtered = search.trim()
    ? items.filter(i => {
        const q = search.toLowerCase();
        return i.name.toLowerCase().includes(q) || String(i.id).includes(q);
      })
    : items;

  const reset = useCallback((): void => {
    setSearch('');
  }, []);

  return { items, filtered, loading, search, setSearch, load, reset };
}
