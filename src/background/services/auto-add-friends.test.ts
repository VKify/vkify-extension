import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AutoAddFriendsService } from './auto-add-friends.js';
import { AUTO_ADD_DEFAULTS, AUTO_ADD_LEDGER, AUTO_ADD_STATE, type AutoAddState } from '../../shared/auto-add-friends.js';
import { fetchVKMethod } from '../../shared/utils/vk-fetch.js';
import type { VKTokenManager } from '../utils/vk-api.js';

vi.mock('../../shared/utils/vk-fetch.js', () => ({ fetchVKMethod: vi.fn() }));
let data: Record<string, unknown>;
let service: AutoAddFriendsService;
let tokens: { get: ReturnType<typeof vi.fn>; requestFresh: ReturnType<typeof vi.fn> };
const state = () => data[AUTO_ADD_STATE] as AutoAddState;
const options = { ...AUTO_ADD_DEFAULTS, delayMin: 30, delayMax: 30 };
const settle = async (promise: Promise<unknown>) => { await vi.advanceTimersByTimeAsync(5000); return promise; };
const start = () => settle(service.start(options, true));
const tick = async () => { await vi.advanceTimersByTimeAsync(30000); await settle(service.tick()); };
const mutations = () => vi.mocked(fetchVKMethod).mock.calls.filter(([method]) => method === 'friends.add');

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-02T09:00:00Z'));
  data = { vk_user_id: '1' };
  vi.stubGlobal('chrome', { storage: { local: {
    get: vi.fn(async () => structuredClone(data)),
    set: vi.fn(async (patch: Record<string, unknown>) => { Object.assign(data, structuredClone(patch)); }),
  } }, alarms: { create: vi.fn(async () => undefined), clear: vi.fn(async () => true) } });
  tokens = { get: vi.fn(async () => ({ token: 'token', userId: '1' })), requestFresh: vi.fn() };
  service = new AutoAddFriendsService(tokens as unknown as VKTokenManager);
  vi.mocked(fetchVKMethod).mockReset().mockImplementation(async method => {
    if (method === 'users.get') return [{ id: 1 }];
    if (method === 'friends.get' || method === 'friends.getRequests') return { count: 1, items: [] };
    if (method === 'friends.getSuggestions') return { count: 3, items: [{ id: 2 }, { id: 3 }, { id: 4 }] };
    if (method === 'friends.areFriends') return [{ user_id: 2, friend_status: 1 }, { user_id: 3, friend_status: 2 }, { user_id: 4, friend_status: 0 }];
    if (method === 'friends.add') {
      expect(state().inFlight).toBe(true);
      expect((data[AUTO_ADD_LEDGER] as Record<string, unknown[]>)['1']).toHaveLength(state().attempted);
      return 1;
    }
    throw new Error(method);
  });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('requires explicit risk acknowledgement and rejects settings above hard ceilings', async () => {
  await expect(service.start(options, false)).rejects.toMatchObject({ code: 'INVALID_OPTIONS' });
  await expect(service.start({ ...options, hour: 21 }, true)).rejects.toMatchObject({ code: 'INVALID_OPTIONS' });
  await expect(service.start({ ...options, delayMax: 29 }, true)).rejects.toMatchObject({ code: 'INVALID_OPTIONS' });
  expect(fetchVKMethod).not.toHaveBeenCalled();
});
it('only sends new requests, reserves attempts before dispatch and stops at the run cap', async () => {
  await settle(service.start({ ...options, session: 1 }, true)); await tick();
  expect(mutations()).toHaveLength(1);
  expect(mutations()[0][2]).toEqual({ user_id: 4 });
  expect(state()).toMatchObject({ added: 1, attempted: 1, isRunning: false, reason: 'session_limit' });
  expect(mutations()[0][3]?.strict).toBe(true);
  await tick(); expect(mutations()).toHaveLength(1);
});
it.each(['14', '6', '9', '29', '15', '176', 'API_WARNING', 'TOKEN_EXPIRED'])('stops on %s, counts the failed attempt and never retries', async code => {
  await start();
  const original = vi.mocked(fetchVKMethod).getMockImplementation()!;
  vi.mocked(fetchVKMethod).mockImplementation(async (...args) => {
    if (args[0] === 'friends.add') throw Object.assign(new Error('blocked'), { code });
    return original(...args);
  });
  await tick(); await tick();
  expect(state()).toMatchObject({ added: 0, attempted: 1, isRunning: false, reason: 'error', code });
  expect(mutations()).toHaveLength(1);
});
it.each(['hour', 'day'] as const)('retains the rolling %s limit across a new service and run', async limit => {
  const count = options[limit];
  data[AUTO_ADD_LEDGER] = { '1': Array.from({ length: count }, (_, i) => ({ id: i + 100, at: Date.now() - (limit === 'hour' ? 1000 : 7200000) })) };
  await start();
  service = new AutoAddFriendsService(tokens as unknown as VKTokenManager);
  await service.restore(); await tick();
  expect(state()).toMatchObject({ isRunning: false, reason: limit + '_limit' });
  expect(mutations()).toHaveLength(0);
});
it('stops an interrupted mutation after worker restart without resending', async () => {
  await start(); data[AUTO_ADD_STATE] = { ...state(), inFlight: true, attempted: 1 };
  service = new AutoAddFriendsService(tokens as unknown as VKTokenManager);
  await service.restore(); await tick();
  expect(state()).toMatchObject({ isRunning: false, reason: 'interrupted' });
  expect(mutations()).toHaveLength(0);
});
it('rejects a changed account before sending', async () => {
  await start(); data.vk_user_id = '2'; await tick();
  expect(state()).toMatchObject({ isRunning: false, code: 'ACCOUNT_CHANGED' });
  expect(mutations()).toHaveLength(0);
});
it('cancels while loading candidates without dispatching a mutation', async () => {
  await start(); await vi.advanceTimersByTimeAsync(30000);
  const pending = service.tick(); await vi.advanceTimersByTimeAsync(100);
  const stop = service.stop(); await settle(pending); await stop;
  expect(state()).toMatchObject({ isRunning: false, reason: 'stopped' });
  expect(mutations()).toHaveLength(0);
});
it.each([2, 4, 0])('does not count response %s as a sent request and stops', async result => {
  await start(); const original = vi.mocked(fetchVKMethod).getMockImplementation()!;
  vi.mocked(fetchVKMethod).mockImplementation(async (...args) => args[0] === 'friends.add' ? result : original(...args));
  await tick(); expect(state()).toMatchObject({ added: 0, attempted: 1, isRunning: false, reason: 'error' });
});
it.each([['friends.get', 10000, 'friends_limit'], ['friends.getRequests', 1000, 'outgoing_limit']] as const)('stops at the %s count ceiling', async (method, count, reason) => {
  await start(); const original = vi.mocked(fetchVKMethod).getMockImplementation()!;
  vi.mocked(fetchVKMethod).mockImplementation(async (...args) => args[0] === method ? { count, items: [] } : original(...args));
  await tick(); expect(state()).toMatchObject({ isRunning: false, reason });
  expect(mutations()).toHaveLength(0);
});
it('stops when recommendations are exhausted', async () => {
  await start(); const original = vi.mocked(fetchVKMethod).getMockImplementation()!;
  vi.mocked(fetchVKMethod).mockImplementation(async (...args) => args[0] === 'friends.getSuggestions' ? { count: 0, items: [] } : original(...args));
  await tick(); expect(state()).toMatchObject({ isRunning: false, reason: 'no_candidates' });
  expect(mutations()).toHaveLength(0);
});
it('uses imported IDs in order, skips unavailable/existing profiles and persists the list cursor', async () => {
  const original = vi.mocked(fetchVKMethod).getMockImplementation()!;
  vi.mocked(fetchVKMethod).mockImplementation(async (...args) => {
    if (args[0] === 'users.get' && args[2]?.user_ids) return String(args[2].user_ids).split(',').map(Number).map(id => ({ id, deactivated: id === 2 ? 'deleted' : undefined }));
    if (args[0] === 'friends.areFriends') return String(args[2]?.user_ids).split(',').map(Number).map(id => ({ user_id: id, friend_status: id === 3 ? 1 : 0 }));
    return original(...args);
  });
  await settle(service.start({ ...options, session: 2 }, true, { kind: 'list', ids: [2, 3, 4, 5, 4] }));
  await tick(); expect(state()).toMatchObject({ added: 1, cursor: 3 });
  service = new AutoAddFriendsService(tokens as unknown as VKTokenManager);
  await service.restore(); await tick();
  expect(mutations().map(c => c[2]?.user_id)).toEqual([4, 5]);
  expect(vi.mocked(fetchVKMethod).mock.calls.some(c => c[0] === 'friends.getSuggestions')).toBe(false);
  expect(state()).toMatchObject({ isRunning: false, reason: 'session_limit' });
});
it('advances across batches of existing profiles and stops at list completion without sends', async () => {
  const original = vi.mocked(fetchVKMethod).getMockImplementation()!;
  vi.mocked(fetchVKMethod).mockImplementation(async (...args) => {
    if (args[0] === 'users.get' && args[2]?.user_ids) return String(args[2].user_ids).split(',').map(Number).map(id => ({ id }));
    if (args[0] === 'friends.areFriends') return String(args[2]?.user_ids).split(',').map(Number).map(id => ({ user_id: id, friend_status: 3 }));
    return original(...args);
  });
  await settle(service.start(options, true, { kind: 'list', ids: Array.from({ length: 150 }, (_, i) => i + 10) }));
  await tick(); expect(state()).toMatchObject({ isRunning: true, cursor: 100 });
  await tick(); expect(state()).toMatchObject({ isRunning: false, reason: 'list_complete', cursor: 150 });
  expect(mutations()).toHaveLength(0);
});
it('rejects malformed custom lists and parser lists belonging to another account', async () => {
  await expect(service.start(options, true, { kind: 'list', ids: [0, -1] })).rejects.toThrow('INVALID_USER_LIST');
  await expect(settle(service.start(options, true, { kind: 'list', ids: [4], ownerId: '2' }))).rejects.toMatchObject({ code: 'ACCOUNT_CHANGED' });
  expect(mutations()).toHaveLength(0);
});
