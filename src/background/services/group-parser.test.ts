import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GroupParserService } from './group-parser.js';
import { GROUP_PARSER_LEDGER, GROUP_PARSER_STATE, type GroupParserState } from '../../shared/group-parser.js';
import { fetchVKMethod } from '../../shared/utils/vk-fetch.js';
import type { VKTokenManager } from '../utils/vk-api.js';

vi.mock('../../shared/utils/vk-fetch.js', () => ({ fetchVKMethod: vi.fn() }));
let data: Record<string, unknown>, service: GroupParserService;
let tokens: { get: ReturnType<typeof vi.fn>; requestFresh: ReturnType<typeof vi.fn> };
let members: number[];
const state = () => data[GROUP_PARSER_STATE] as GroupParserState;
const settle = async (promise: Promise<unknown>) => { await vi.advanceTimersByTimeAsync(5000); return promise; };
const tick = async () => { await vi.advanceTimersByTimeAsync(30000); await settle(service.tick()); };
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-02T09:00:00Z'));
  data = {}; members = Array.from({ length: 2001 }, (_, i) => i + 10);
  vi.stubGlobal('chrome', { storage: { local: {
    get: vi.fn(async () => structuredClone(data)), set: vi.fn(async (patch) => { Object.assign(data, structuredClone(patch)); }),
  } }, alarms: { create: vi.fn(async () => undefined), clear: vi.fn(async () => true) } });
  tokens = { get: vi.fn(async () => ({ token: 'token', userId: '1' })), requestFresh: vi.fn() };
  service = new GroupParserService(tokens as unknown as VKTokenManager);
  vi.mocked(fetchVKMethod).mockReset().mockImplementation(async (method, _token, params) => {
    if (method === 'users.get') return [{ id: 1 }];
    if (method === 'groups.getById') return { groups: [{ id: 100, name: 'Community' }] };
    if (method === 'groups.get') return { count: 1, items: [{ id: 100, name: 'Community' }] };
    if (method === 'groups.getMembers') return { count: members.length, items: members.slice(Number(params?.offset), Number(params?.offset) + Number(params?.count)) };
    throw new Error(method);
  });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('publishes preparation, loading and committed progress before completion', async () => {
  const starting = service.start('100', 5000);
  await vi.advanceTimersByTimeAsync(0);
  expect(state()).toMatchObject({ status: 'running', phase: 'preparing', inFlight: true, ids: [] });
  await settle(starting);
  expect(state()).toMatchObject({ phase: 'waiting', inFlight: false });
  await vi.advanceTimersByTimeAsync(30000);
  const reading = service.tick();
  await vi.advanceTimersByTimeAsync(0);
  expect(state()).toMatchObject({ phase: 'loading', inFlight: true, ids: [] });
  await settle(reading);
  expect(state()).toMatchObject({ status: 'running', phase: 'waiting', inFlight: false, total: 2001 });
  expect(state().ids).toHaveLength(1000);
});
it('retains community avatars and rejects insecure image URLs', async () => {
  const original = vi.mocked(fetchVKMethod).getMockImplementation()!;
  vi.mocked(fetchVKMethod).mockImplementation(async (...args) => args[0] === 'groups.get' ? {
    count: 2, items: [{ id: 100, name: 'Community', photo_100: 'https://vk.example/avatar.jpg' }, { id: 101, name: 'Other', photo_100: 'javascript:alert(1)' }],
  } : original(...args));
  const result = await settle(service.listGroups(0)) as { groups: { photo_100?: string }[] };
  expect(result.groups[0].photo_100).toBe('https://vk.example/avatar.jpg');
  expect(result.groups[1].photo_100).toBeUndefined();
});
it('collects stable, sorted pages and completes without duplicates', async () => {
  await settle(service.start('https://vk.ru/club100', 5000));
  await tick(); expect(state().ids).toHaveLength(1000);
  await tick(); await tick();
  expect(state()).toMatchObject({ status: 'completed', ids: members, total: 2001 });
  const pages = vi.mocked(fetchVKMethod).mock.calls.filter(c => c[0] === 'groups.getMembers');
  expect(pages.map(c => c[2]?.offset)).toEqual([0, 1000, 2000]);
  expect(pages.every(c => c[3]?.strict && c[2]?.sort === 'id_asc')).toBe(true);
});
it('stops exactly at the chosen limit and marks the result partial', async () => {
  await settle(service.start('100', 1200)); await tick(); await tick();
  expect(state()).toMatchObject({ status: 'limit', ids: members.slice(0, 1200) });
});
it.each(['14', '6', '15', 'API_WARNING', 'TIMEOUT'])('preserves completed pages after %s without retrying', async code => {
  await settle(service.start('100', 5000)); await tick();
  const original = vi.mocked(fetchVKMethod).getMockImplementation()!;
  vi.mocked(fetchVKMethod).mockImplementation(async (...args) => {
    if (args[0] === 'groups.getMembers') throw Object.assign(new Error('restricted'), { code });
    return original(...args);
  });
  await tick(); await tick();
  expect(state()).toMatchObject({ status: 'error', code, ids: members.slice(0, 1000) });
  expect(vi.mocked(fetchVKMethod).mock.calls.filter(c => c[0] === 'groups.getMembers')).toHaveLength(2);
});
it('detects membership changes and repeated pages without merging bad data', async () => {
  await settle(service.start('100', 5000)); await tick();
  members.push(9999); await tick();
  expect(state()).toMatchObject({ status: 'error', code: 'MEMBERS_CHANGED', ids: members.slice(0, 1000) });
  members.pop(); await settle(service.start('100', 5000)); await tick();
  const original = vi.mocked(fetchVKMethod).getMockImplementation()!;
  vi.mocked(fetchVKMethod).mockImplementation(async (...args) => args[0] === 'groups.getMembers' ? { count: 2001, items: members.slice(0, 1000) } : original(...args));
  await tick(); expect(state()).toMatchObject({ status: 'error', code: 'INCOMPLETE_PAGE', ids: members.slice(0, 1000) });
});
it('resumes committed pages after restart but stops interrupted reads', async () => {
  await settle(service.start('100', 5000)); await tick();
  service = new GroupParserService(tokens as unknown as VKTokenManager);
  await service.restore();
  expect(state().phase).toBe('waiting');
  expect(state().nextAt).toBeGreaterThanOrEqual(Date.now() + 30000);
  await tick(); expect(state().ids).toHaveLength(2000);
  data[GROUP_PARSER_STATE] = { ...state(), inFlight: true };
  await service.restore(); expect(state()).toMatchObject({ status: 'interrupted', ids: members.slice(0, 2000) });
});
it('retains API budgets across restarts and blocks before sending', async () => {
  data[GROUP_PARSER_LEDGER] = { '1': Array(120).fill(Date.now()) };
  await expect(service.start('100', 1000)).rejects.toMatchObject({ code: 'PARSER_HOUR_LIMIT' });
  expect(fetchVKMethod).not.toHaveBeenCalled();
  data[GROUP_PARSER_LEDGER] = { '1': Array(500).fill(Date.now() - 7200000) };
  service = new GroupParserService(tokens as unknown as VKTokenManager);
  await expect(service.start('100', 1000)).rejects.toMatchObject({ code: 'PARSER_DAY_LIMIT' });
});
it('rejects a changed account and invalid limits', async () => {
  await expect(service.start('100', 10001)).rejects.toMatchObject({ code: 'INVALID_OPTIONS' });
  await expect(service.start('100', 1000, '2')).rejects.toMatchObject({ code: 'ACCOUNT_CHANGED' });
  await settle(service.start('100', 1000));
  tokens.get.mockResolvedValue({ token: 'other', userId: '2' }); await tick();
  expect(state()).toMatchObject({ status: 'error', code: 'ACCOUNT_CHANGED', ids: [] });
});
it('stops while a page is loading without committing its result', async () => {
  await settle(service.start('100', 5000)); await tick();
  await vi.advanceTimersByTimeAsync(30000);
  const pending = service.tick(); await vi.advanceTimersByTimeAsync(100);
  const stop = service.stop(); await settle(pending); await stop;
  expect(state()).toMatchObject({ status: 'stopped', ids: members.slice(0, 1000) });
});
