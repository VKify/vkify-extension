import { useCallback, useEffect, useState } from 'react';
import { sendMessage } from '@/shared/messaging.js';
import { emptyDialogStats, isFreshReport } from '@/shared/dialog-stats.js';

export function useDialogStats() {
  const [state, setState] = useState(emptyDialogStats);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async (initial = false): Promise<void> => {
      try {
        const response = await sendMessage({ type: 'GET_DIALOG_STATS' });
        if (disposed) return;
        if (!response?.success || !response.state) {
          setState(emptyDialogStats());
          setError(response?.error ?? 'UNAVAILABLE');
        } else {
          setState(response.state);
          setError(undefined);
          if (initial && (response.state.status === 'idle'
            || response.state.status === 'completed' && !isFreshReport(response.state, response.state.ownerId))) {
            await sendMessage({ type: 'START_DIALOG_STATS' });
          }
        }
      } catch {
        if (!disposed) setError('UNAVAILABLE');
      } finally {
        if (!disposed) timer = setTimeout(() => void poll(), 1000);
      }
    };
    void poll(true);
    return () => { disposed = true; clearTimeout(timer); };
  }, []);

  const action = useCallback(async (kind: 'refresh' | 'exact' | 'cancel', peerIds?: number[]): Promise<void> => {
    setPending(true);
    setError(undefined);
    try {
      const response = await sendMessage(kind === 'cancel' ? { type: 'CANCEL_DIALOG_STATS' }
        : { type: 'START_DIALOG_STATS', refresh: kind === 'refresh', ...(kind === 'exact' ? { peerIds } : {}) });
      if (!response?.success) throw new Error(response?.error ?? 'UNAVAILABLE');
      const latest = await sendMessage({ type: 'GET_DIALOG_STATS' });
      if (latest?.success && latest.state) setState(latest.state);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }, []);

  return { state, error: error ?? state.error, pending, action };
}
