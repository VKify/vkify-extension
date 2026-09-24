import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUDIT_TTL, auditFriend, normalizeFriend, summarizeFriends } from '@/shared/friends-audit.js';
import { auditCall, fetchFriendsAudit, readFriendsAudit, writeFriendsAudit } from '@/popup/utils/friendsAudit.js';
import { sendMessage } from '@/shared/messaging.js';
import { getStorage, setStorage } from '@/popup/utils/storageClient.js';

vi.mock('@/shared/messaging.js', () => ({ sendMessage: vi.fn() }));
vi.mock('@/popup/utils/storageClient.js', () => ({ getStorage: vi.fn(), setStorage: vi.fn() }));
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe('friends audit classification', () => {
  it('uses privacy-aware online_info without inventing dates for approximate statuses', () => {
    expect(normalizeFriend({ id: 1, online_info: { visible: true, last_seen: 1700000000, is_online: true } }))
      .toMatchObject({ lastSeen: 1700000000, online: true });
    for (const status of ['recently', 'last_week', 'last_month', 'long_ago', 'not_show'] as const) {
      const profile = normalizeFriend({ id: 1, online: 1, last_seen: { time: 100 },
        online_info: { visible: false, last_seen: 100, is_online: true, status } });
      expect(profile).toMatchObject({ online: false, lastSeen: undefined, activityHidden: true, approximateStatus: status });
      expect(auditFriend(profile, 90)).toMatchObject({ hiddenLastSeen: true, inactive: false });
    }
    for (const time of [0, -1, NaN, Infinity]) {
      expect(normalizeFriend({ id: 1, last_seen: { time } }).lastSeen).toBeUndefined();
    }
  });
  it('distinguishes hidden activity, deactivation and online profiles', () => {
    const hidden = normalizeFriend({ id: 1 });
    expect(auditFriend(hidden, 180)).toMatchObject({ hiddenLastSeen: true, inactive: false });
    expect(auditFriend(hidden, 180).inactive).toBe(false);
    expect(auditFriend(normalizeFriend({ id: 1, deactivated: 'deleted' }), 180))
      .toMatchObject({ hiddenLastSeen: true, inactive: false, deactivated: 'deleted' });
    expect(auditFriend(normalizeFriend({ id: 1, online: 1, last_seen: { time: 1 } }), 180).inactive).toBe(false);
  });
  it('uses selected thresholds and recognizes VK placeholder photos', () => {
    const now = 2000000000000;
    const profile = normalizeFriend({ id: 1, last_seen: { time: (now - 181 * 86400000) / 1000 } });
    expect(auditFriend(profile, 180, now).inactive).toBe(true);
    expect(auditFriend(profile, 365, now).inactive).toBe(false);
    for (const photo of [undefined, 'https://vk.ru/images/camera_200.png', 'https://vk.ru/images/camera_100.png?x=1']) {
      expect(normalizeFriend({ id: 1, photo_100: photo }).noAvatar).toBe(true);
    }
    expect(normalizeFriend({ id: 1, photo_200: 'https://sun.userapi.com/photo.jpg' }).noAvatar).toBe(false);
    expect(normalizeFriend({ id: 1, has_photo: 0, photo_200: 'https://sun.userapi.com/photo.jpg' }).noAvatar).toBe(true);
  });
});

describe('friends audit loading', () => {
  it('resolves omitted activity in batches and keeps private, deleted and unresolved profiles', async () => {
    const call = vi.fn(async (method: string, params: Record<string, unknown>) => {
      if (method === 'friends.get') return { count: 4, items: [
        { id: 1, first_name: 'Exact' }, { id: 2, online_info: { visible: false, status: 'recently' } },
        { id: 3, deactivated: 'deleted' }, { id: 4, first_name: 'Unknown' },
      ] };
      if (method === 'users.get') {
        expect(params.user_ids).toBe('1,4');
        expect(params.fields).toContain('online_info');
        return [{ id: 1, online_info: { visible: true, last_seen: 1000000 } }, { id: 4 }];
      }
      return { count: 0, items: [] };
    });
    const snapshot = await fetchFriendsAudit('10', call, new AbortController().signal, vi.fn());
    expect(snapshot.friends).toHaveLength(4);
    expect(snapshot.friends[0]).toMatchObject({ name: 'Exact', lastSeen: 1000000 });
    expect(snapshot.friends[3]).toMatchObject({ name: 'Unknown', lastSeen: undefined });
    expect(snapshot.enrichmentFailed).toBeUndefined();
    expect(summarizeFriends(snapshot.friends.map(user => auditFriend(user, 180)), snapshot))
      .toMatchObject({ total: 4, inactive: 1, hiddenLastSeen: 3, deactivated: 1 });
  });
  it('retains the friends audit when optional enrichment or request lists fail, without caching partial data', async () => {
    const call = vi.fn(async (method: string) => {
      if (method === 'friends.get') return { count: 1, items: [{ id: 1, first_name: 'Still here' }] };
      throw new Error('Access denied');
    });
    const snapshot = await fetchFriendsAudit('10', call, new AbortController().signal, vi.fn());
    expect(snapshot.friends[0].name).toBe('Still here');
    expect(snapshot.enrichmentFailed).toBe(true);
    expect(summarizeFriends(snapshot.friends.map(user => auditFriend(user, 180)), snapshot))
      .toMatchObject({ hiddenLastSeen: 1, incoming: null, outgoing: null });
    await writeFriendsAudit(snapshot);
    expect(setStorage).not.toHaveBeenCalled();
  });
  it('invalidates old caches that do not contain online_info-derived activity', async () => {
    vi.mocked(getStorage).mockResolvedValue({ friends_audit_v1_10: {
      version: 1, userId: '10', fetchedAt: Date.now(), friends: [], incoming: [], outgoing: [],
    } });
    expect(await readFriendsAudit('10')).toBeNull();
  });
  it('paginates, deduplicates and hydrates both request directions', async () => {
    const call = vi.fn(async (method: string, params: Record<string, unknown>) => {
      if (method === 'friends.get') return params.offset === 0
        ? { count: 3, items: [{ id: 1 }, { id: 2 }] } : { count: 3, items: [{ id: 2 }] };
      if (method === 'friends.getRequests') return { count: 1, items: [params.out ? 4 : 3] };
      return String(params.user_ids).split(',').map(id => ({ id: Number(id), first_name: 'Test' }));
    });
    const progress = vi.fn();
    const result = await fetchFriendsAudit('10', call, new AbortController().signal, progress);
    expect(result.friends.map(x => x.id)).toEqual([1, 2]);
    expect(result.incoming[0]).toMatchObject({ id: 3, name: 'Test' });
    expect(result.outgoing[0].id).toBe(4);
    expect(call.mock.calls[1][1].offset).toBe(2);
    expect(call.mock.calls.every(([method]) => ['friends.get', 'friends.getRequests', 'users.get'].includes(method))).toBe(true);
    expect(progress).toHaveBeenCalledWith({ section: 'outgoing', loaded: 1, total: 1 });
  });
  it('rejects incomplete pages and cancels before another request', async () => {
    const call = vi.fn().mockResolvedValue({ count: 10, items: [] });
    await expect(fetchFriendsAudit('1', call, new AbortController().signal, vi.fn())).rejects.toThrow('Incomplete');
    const controller = new AbortController();
    controller.abort();
    call.mockClear();
    await expect(fetchFriendsAudit('1', call, controller.signal, vi.fn())).rejects.toThrow('Aborted');
    expect(call).not.toHaveBeenCalled();
  });
  it('isolates caches by account and expires after three hours', async () => {
    const snapshot = { version: 2 as const, userId: '10', fetchedAt: Date.now(), friends: [], incoming: [], outgoing: [] };
    vi.mocked(getStorage).mockResolvedValue({ friends_audit_v2_10: snapshot });
    expect(await readFriendsAudit('10')).toEqual(snapshot);
    expect(await readFriendsAudit('11')).toBeNull();
    await writeFriendsAudit(snapshot);
    expect(setStorage).toHaveBeenCalledWith({ friends_audit_v2_10: snapshot });
    snapshot.fetchedAt -= AUDIT_TTL;
    expect(await readFriendsAudit('10')).toBeNull();
  });
  it('paces calls and retries only flood failures', async () => {
    vi.useFakeTimers();
    vi.mocked(sendMessage).mockResolvedValueOnce({ success: false, code: '6', error: 'Rate limit' })
      .mockResolvedValueOnce({ success: true, data: { count: 0, items: [] } });
    const result = auditCall('friends.get', {});
    await vi.runAllTimersAsync();
    await expect(result).resolves.toEqual({ count: 0, items: [] });
    expect(sendMessage).toHaveBeenCalledTimes(2);
    vi.mocked(sendMessage).mockResolvedValueOnce({ success: false, code: '7', error: 'Access denied' });
    const failure = expect(auditCall('friends.get', {})).rejects.toThrow('Access denied');
    await vi.runAllTimersAsync();
    await failure;
    expect(sendMessage).toHaveBeenCalledTimes(3);
  });
  it('does not issue queued requests after cancellation or an account switch', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    vi.mocked(getStorage).mockResolvedValue({ vk_user_id: 'other' });
    const switched = expect(auditCall('friends.get', {}, { userId: '10', signal: controller.signal })).rejects.toThrow('account changed');
    await vi.runAllTimersAsync();
    await switched;
    controller.abort();
    await expect(auditCall('friends.get', {}, { userId: '10', signal: controller.signal })).rejects.toThrow('Aborted');
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
