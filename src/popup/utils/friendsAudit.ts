import { sendMessage } from '@/shared/messaging.js';
import { StorageKey } from '@/shared/constants/storage-keys.js';
import { AUDIT_TTL, normalizeFriend, type AuditSection, type AuditUserRaw, type FriendProfile, type FriendsAuditSnapshot } from '@/shared/friends-audit.js';
import { getStorage, setStorage } from './storageClient.js';

export type AuditCall = (method: string, params: Record<string, unknown>) => Promise<unknown>;
export interface AuditProgress { section: AuditSection; loaded: number; total: number; phase?: 'activity' }
// deactivated is a base user property, not a users_fields enum value.
const fields = 'photo_100,photo_200,has_photo,last_seen,online,online_info,domain,nickname,sex';
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
let queue: Promise<unknown> = Promise.resolve();

// One paced queue shared by audit instances; existing background bridge owns auth.
export function auditCall(method: string, params: Record<string, unknown>, context?: { userId: string; signal: AbortSignal }): Promise<unknown> {
  const checkContext = async (): Promise<void> => {
    if (!context) return;
    if (context.signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const auth = await getStorage([StorageKey.VK_USER_ID]);
    if (String(auth[StorageKey.VK_USER_ID]) !== context.userId) throw Object.assign(new Error('VK account changed'), { code: 'ACCOUNT_CHANGED' });
  };
  const job = queue.catch(() => undefined).then(async () => {
    for (let attempt = 0; ; attempt++) {
      await checkContext();
      await sleep(attempt ? 1000 * 2 ** attempt : 400);
      await checkContext();
      const result = await sendMessage({ type: 'VK_API_CALL', method, params });
      await checkContext();
      if (result.success) return result.data;
      if (attempt < 3 && ['6', '9'].includes(String(result.code))) continue;
      throw Object.assign(new Error(result.error || 'VK API error'), { code: result.code });
    }
  });
  queue = job;
  return job;
}

export async function fetchFriendsAudit(userId: string, call: AuditCall, signal: AbortSignal,
  progress: (value: AuditProgress) => void): Promise<FriendsAuditSnapshot> {
  const snapshot: FriendsAuditSnapshot = { version: 2, userId, fetchedAt: 0, friends: [], incoming: [], outgoing: [] };
  const check = (): void => { if (signal.aborted) throw new DOMException('Aborted', 'AbortError'); };
  const rethrowFatal = (error: unknown): void => {
    check();
    const code = String((error as { code?: string })?.code ?? '');
    if (code === 'ACCOUNT_CHANGED' || /TOKEN|NO_VK_TAB/.test(code) || code === '5') throw error;
  };
  const checkedCall: AuditCall = async (method, params) => {
    check();
    const result = await call(method, params);
    check();
    return result;
  };
  for (const section of ['friends', 'incoming', 'outgoing'] as const) {
    try {
      const users = new Map<number, FriendProfile>();
      let offset = 0;
      for (;;) {
        const raw = await checkedCall(section === 'friends' ? 'friends.get' : 'friends.getRequests', {
          count: 500, offset,
          ...(section === 'friends' ? { user_id: userId, fields, order: 'name' } : { out: section === 'outgoing' ? 1 : 0, extended: 0, need_viewed: 1 }),
        }) as { count: number; items: (AuditUserRaw | number)[] } | null;
        if (!raw || !Array.isArray(raw.items) || !Number.isFinite(raw.count)) throw new Error('Invalid VK API response');
        const profiles: AuditUserRaw[] = [];
        if (section === 'friends') profiles.push(...raw.items as AuditUserRaw[]);
        else {
          const ids = raw.items.map(item => typeof item === 'number' ? item : item.id);
          for (let i = 0; i < ids.length; i += 100) {
            const batch = ids.slice(i, i + 100);
            const response = await checkedCall('users.get', { user_ids: batch.join(','), fields });
            if (!Array.isArray(response)) throw new Error('Invalid VK API response');
            const byId = new Map((response as AuditUserRaw[]).map(user => [user.id, user]));
            profiles.push(...batch.map(id => byId.get(id) ?? { id }));
          }
        }
        for (const user of profiles) {
          if (!Number.isSafeInteger(user.id) || user.id <= 0) throw new Error('Invalid VK user');
          users.set(user.id, normalizeFriend(user));
        }
        offset += raw.items.length;
        progress({ section, loaded: offset, total: raw.count });
        if (offset >= raw.count) break;
        if (!raw.items.length) throw new Error('Incomplete VK API response');
      }
      snapshot[section] = [...users.values()];
      if (section === 'friends') {
        // Resolve omitted activity once in bounded batches, never probe profiles
        // that VK explicitly marks as hidden.
        const missing = snapshot.friends.filter(user => !user.lastSeen && !user.online && !user.deactivated && !user.activityHidden);
        for (let i = 0; i < missing.length; i += 100) {
          try {
            const batch = missing.slice(i, i + 100);
            const response = await checkedCall('users.get', { user_ids: batch.map(user => user.id).join(','), fields });
            if (!Array.isArray(response)) throw new Error('Invalid VK API response');
            const returned = new Set<number>();
            for (const raw of response as AuditUserRaw[]) {
              if (!batch.some(user => user.id === raw.id)) continue;
              returned.add(raw.id);
              const profile = users.get(raw.id)!;
              const activity = normalizeFriend(raw);
              users.set(raw.id, { ...profile, online: activity.online, lastSeen: activity.lastSeen,
                activityHidden: activity.activityHidden, approximateStatus: activity.approximateStatus,
                deactivated: activity.deactivated ?? profile.deactivated });
            }
            if (returned.size !== batch.length) snapshot.enrichmentFailed = true;
            progress({ section, loaded: Math.min(i + batch.length, missing.length), total: missing.length, phase: 'activity' });
          } catch (error) {
            rethrowFatal(error);
            snapshot.enrichmentFailed = true;
            break;
          }
        }
        snapshot.friends = [...users.values()];
      }
    } catch (error) {
      rethrowFatal(error);
      if (section === 'friends') throw error;
      // Failed request lists are unavailable, not empty; friends remain usable.
      snapshot.requestErrors = { ...snapshot.requestErrors, [section]: (error as Error).message };
    }
  }
  snapshot.fetchedAt = Date.now();
  return snapshot;
}

const cacheKey = (userId: string): string => `friends_audit_v2_${userId}`;
export async function readFriendsAudit(userId: string): Promise<FriendsAuditSnapshot | null> {
  const key = cacheKey(userId);
  const data = (await getStorage<Record<string, FriendsAuditSnapshot>>([key]))[key];
  if (!data || data.version !== 2 || data.userId !== userId || !Number.isFinite(data.fetchedAt)
    || data.enrichmentFailed || Object.keys(data.requestErrors ?? {}).length > 0
    || Date.now() < data.fetchedAt || Date.now() - data.fetchedAt >= AUDIT_TTL
    || !['friends', 'incoming', 'outgoing'].every(section => Array.isArray(data[section as AuditSection])
      && data[section as AuditSection].every(user => user && Number.isSafeInteger(user.id) && typeof user.name === 'string')))
    return null;
  return data;
}
export async function writeFriendsAudit(snapshot: FriendsAuditSnapshot): Promise<void> {
  if (snapshot.enrichmentFailed || Object.keys(snapshot.requestErrors ?? {}).length > 0) return;
  await setStorage({ [cacheKey(snapshot.userId)]: snapshot });
}
