import { useCallback, useEffect, useRef, useState } from 'react';
import type { FriendsAuditSnapshot } from '@/shared/friends-audit.js';
import { auditCall, fetchFriendsAudit, readFriendsAudit, writeFriendsAudit, type AuditProgress } from '@/popup/utils/friendsAudit.js';

export function useFriendsAudit(userId: string | null, ready: boolean) {
  const [snapshot, setSnapshot] = useState<FriendsAuditSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheFailed, setCacheFailed] = useState(false);
  const [progress, setProgress] = useState<AuditProgress | null>(null);
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async (force = false) => {
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    if (!userId || !ready) { setLoading(false); return; }
    setLoading(true); setError(null); setProgress(null); setCacheFailed(false);
    try {
      const cached = force ? null : await readFriendsAudit(userId).catch(() => null);
      if (active.signal.aborted) return;
      const result = cached ?? await fetchFriendsAudit(userId,
        (method, params) => auditCall(method, params, { userId, signal: active.signal }), active.signal, setProgress);
      if (active.signal.aborted) return;
      setSnapshot(result);
      if (!cached) await writeFriendsAudit(result).catch(() => { if (!active.signal.aborted) setCacheFailed(true); });
    } catch (err) {
      if (!active.signal.aborted) setError((err as Error).message);
    } finally {
      if (!active.signal.aborted) setLoading(false);
    }
  }, [userId, ready]);
  useEffect(() => {
    setSnapshot(null);
    void load();
    return () => controller.current?.abort();
  }, [load]);
  return { snapshot: ready && snapshot?.userId === userId ? snapshot : null, loading, error, cacheFailed, progress, refresh: () => load(true) };
}
