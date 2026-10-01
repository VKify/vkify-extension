import { useCallback, useEffect, useRef, useState } from 'react';
import type { FriendsAuditSnapshot } from '@/shared/friends-audit.js';
import { auditCall, fetchFriendsAudit, readFriendsAudit, writeFriendsAudit, type AuditProgress } from '@/popup/utils/friendsAudit.js';
import { setStorage } from '@/popup/utils/storageClient.js';
import type { AuditSection } from '@/shared/friends-audit.js';

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
  const applyAction = (section: AuditSection, id: number, accepted: boolean) => {
    if (userId) void setStorage({ [`friends_audit_v2_${userId}`]: null }).catch(() => setCacheFailed(true));
    setSnapshot(old => {
      if (!old || old.userId !== userId) return old;
      const user = old[section].find(profile => profile.id === id);
      return { ...old, [section]: old[section].filter(profile => profile.id !== id),
        ...(accepted && user ? { friends: [...old.friends.filter(profile => profile.id !== id), user] } : {}) };
    });
  };
  return { snapshot: ready && snapshot?.userId === userId ? snapshot : null, loading, error, cacheFailed, progress, refresh: () => load(true), applyAction };
}
