import { useState, useEffect, useRef, useCallback } from 'react';
import { sendMessage } from '@/shared/messaging.js';
import { readHeap } from '@/shared/utils/perf-memory.js';
import type { PerfSnapshot } from '@/shared/constants/perf.js';
import i18n from '@/popup/i18n.js';

/** Точка истории для sparkline-графиков. */
export interface PerfHistoryPoint {
  apiCallsLastMin: number;
  observerSubs: number;
  /** Кумулятивное число флашей observer'а (rate считается как дельта в графике). */
  mutationFlushes: number;
  heapUsedBytes: number;
}

const MAX_HISTORY = 30;

export interface PerfTelemetryHook {
  snapshot: PerfSnapshot | null;
  history: PerfHistoryPoint[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Поллит снимок телеметрии у background раз в `intervalMs`, пока компонент
 * смонтирован (дашборд открыт). Поллинг живёт ровно столько, сколько открыт
 * дашборд — при закрытии интервал снимается, overhead в простое нулевой.
 *
 * `inFlight` гарантирует, что медленный ответ не накладывается на следующий тик;
 * `mounted` отбрасывает ответы, пришедшие после размонтирования.
 */
export function usePerfTelemetry(intervalMs = 1000): PerfTelemetryHook {
  const [snapshot, setSnapshot] = useState<PerfSnapshot | null>(null);
  const [history, setHistory] = useState<PerfHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  const inFlight = useRef(false);

  const poll = useCallback(async (): Promise<void> => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const resp = await sendMessage({ type: 'GET_PERF_TELEMETRY' });
      if (!mounted.current) return;

      if (resp?.success && resp.snapshot) {
        const snap = resp.snapshot;
        // popup-heap читаем локально: background не видит heap popup-контекста.
        snap.popup.heapUsedBytes = readHeap().usedBytes;
        setSnapshot(snap);
        setError(null);
        setHistory((prev) => [
          ...prev,
          {
            apiCallsLastMin: snap.context.apiCallsLastMin,
            observerSubs: snap.context.observerSubs,
            mutationFlushes: snap.context.mutationFlushes,
            heapUsedBytes: snap.context.heapUsedBytes ?? 0,
          },
        ].slice(-MAX_HISTORY));
      } else {
        setError(i18n.t('perf:no_telemetry'));
      }
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      inFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void poll();
    const id = window.setInterval(() => void poll(), intervalMs);
    return () => {
      mounted.current = false;
      window.clearInterval(id);
    };
  }, [poll, intervalMs]);

  return { snapshot, history, loading, error, refresh: poll };
}
