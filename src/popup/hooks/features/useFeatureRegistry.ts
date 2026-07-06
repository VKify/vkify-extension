import { useState, useEffect, useRef, useCallback } from 'react';
import { sendMessage } from '@/shared/messaging.js';
import type { FeatureRegistrySummary } from '@/shared/constants/perf.js';
import i18n from '@/popup/i18n.js';

export interface FeatureRegistryHook {
  summary: FeatureRegistrySummary | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Загружает сводку метадаты реестра фич активной VK-вкладки ОДНОКРАТНО при
 * монтировании (метадата статична в пределах загрузки страницы). В отличие от
 * usePerfTelemetry, здесь нет поллинга — overhead нулевой. `refresh()` доступен
 * для ручного обновления (напр. после переключения вкладки).
 */
export function useFeatureRegistry(): FeatureRegistryHook {
  const [summary, setSummary] = useState<FeatureRegistrySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async (): Promise<void> => {
    try {
      const resp = await sendMessage({ type: 'GET_FEATURE_REGISTRY_SUMMARY' });
      if (!mounted.current) return;
      if (resp?.success && resp.summary) {
        setSummary(resp.summary);
        setError(null);
      } else {
        setError(i18n.t('perf:registry_unavailable'));
      }
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; };
  }, [load]);

  return { summary, loading, error, refresh: load };
}
