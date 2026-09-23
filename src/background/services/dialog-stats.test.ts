import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { DialogStatsService } from './dialog-stats.js';
import { callVKApi, type VKTokenManager } from '../utils/vk-api.js';
import { DIALOG_STATS_KEY, DIALOG_STATS_TTL, emptyDialogStats, type ConversationsPage } from '../../shared/dialog-stats.js';

vi.mock('../utils/vk-api.js', () => ({ callVKApi: vi.fn() }));
const api = vi.mocked(callVKApi);
let stored: Record<string, unknown>;
let ownerId: string;
let service: DialogStatsService;
const item = (id: number): ConversationsPage['items'][number] => ({
  conversation: { peer: { id, type: 'user' }, unread_count: 2 },
  last_message: { date: 100, out: 1, conversation_message_id: id * 10 },
});

async function finish() {
  await vi.runAllTimersAsync();
  return service.getState();
}

beforeEach(() => {
  vi.useFakeTimers();
  api.mockReset();
  stored = {};
  ownerId = '1';
  vi.stubGlobal('chrome', { storage: { local: {
    get: vi.fn(async () => structuredClone(stored)),
    set: vi.fn(async (data: Record<string, unknown>) => { Object.assign(stored, structuredClone(data)); }),
  } } });
  service = new DialogStatsService({ get: async () => ({ userId: ownerId }) } as VKTokenManager);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('background dialog statistics', () => {
  it('paginates, deduplicates and never requests history in quick mode', async () => {
    api.mockResolvedValueOnce({ count: 201, items: Array.from({ length: 200 }, (_, i) => item(i + 1)) });
    api.mockResolvedValueOnce({ count: 201, items: [item(200)] });
    await service.start();
    const state = await finish();
    expect(state.status).toBe('completed');
    expect(state.rows).toHaveLength(200);
    expect(api.mock.calls.map(call => call[1])).toEqual(['messages.getConversations', 'messages.getConversations']);
    expect(api.mock.calls[1][2]).toMatchObject({ offset: 200 });
  });

  it('reuses a fresh report and replaces it on explicit refresh or TTL expiry', async () => {
    api.mockResolvedValue({ count: 1, items: [item(1)] });
    await service.start(); await finish();
    await service.start(); await finish();
    expect(api).toHaveBeenCalledTimes(1);
    await service.start(true); await finish();
    expect(api).toHaveBeenCalledTimes(2);
    vi.setSystemTime(Date.now() + DIALOG_STATS_TTL + 1);
    await service.start(); await finish();
    expect(api).toHaveBeenCalledTimes(3);
  });

  it('bounds exact mode to 20 peer IDs, requests count=1, and stores no message bodies', async () => {
    api.mockResolvedValueOnce({ count: 30, items: Array.from({ length: 30 }, (_, i) => item(i + 1)) });
    await service.start(); await finish();
    api.mockClear();
    api.mockResolvedValue({ count: 7, items: [{ date: 200, out: 0, text: 'private body' }] });
    await service.start(false, Array.from({ length: 30 }, (_, i) => i + 1));
    const state = await finish();
    expect(api).toHaveBeenCalledTimes(20);
    expect(api.mock.calls.every(call => call[1] === 'messages.getHistory' && call[2]?.count === 1)).toBe(true);
    expect(state.rows.filter(row => row.countExact)).toHaveLength(20);
    expect(state.rows[0]).toMatchObject({ approxMessageCount: 7, lastDirection: 'in', lastMessageAt: 200000 });
    expect(JSON.stringify(stored)).not.toContain('private body');
  });

  it('retries numeric flood codes with backoff and reports exhausted retries', async () => {
    api.mockRejectedValue(Object.assign(new Error('rate limited'), { code: 6 }));
    await service.start();
    const state = await finish();
    expect(api).toHaveBeenCalledTimes(4);
    expect(state.status).toBe('failed');
    expect(state.collectedAt).toBeNull();
  });

  it('cancels during backoff without sending another API request', async () => {
    api.mockRejectedValue(Object.assign(new Error('rate limited'), { code: '6' }));
    await service.start();
    await vi.advanceTimersByTimeAsync(500);
    service.cancel();
    const state = await finish();
    expect(api).toHaveBeenCalledTimes(1);
    expect(state.status).toBe('cancelled');
  });

  it('deduplicates simultaneous starts', async () => {
    api.mockResolvedValue({ count: 0, items: [] });
    await Promise.all([service.start(), service.start()]);
    await finish();
    expect(api).toHaveBeenCalledTimes(1);
  });

  it('cancels an in-flight call and discards late results', async () => {
    let resolve!: (value: unknown) => void;
    api.mockImplementation(() => new Promise(done => { resolve = done; }));
    await service.start();
    await vi.advanceTimersByTimeAsync(500);
    service.cancel();
    expect((await finish()).status).toBe('cancelled');
    resolve({ count: 1, items: [item(1)] });
    expect((await finish()).rows).toEqual([]);
  });

  it('reports timeout instead of remaining active forever', async () => {
    api.mockImplementation(() => new Promise(() => {}));
    await service.start();
    expect(await finish()).toMatchObject({ status: 'failed', error: 'TIMEOUT' });
  });

  it('does not expose another account report or accept results after switching accounts', async () => {
    api.mockImplementation(async () => {
      ownerId = '2';
      return { count: 1, items: [item(123)] };
    });
    await service.start();
    const state = await finish();
    expect(state.ownerId).toBe('2');
    expect(state.rows).toEqual([]);
    expect(JSON.stringify(stored)).not.toContain('123');
  });

  it('marks worker termination as interrupted instead of a permanent spinner', async () => {
    stored[DIALOG_STATS_KEY] = { ...emptyDialogStats('1'), status: 'running' };
    expect(await service.getState()).toMatchObject({ status: 'cancelled', error: 'INTERRUPTED' });
  });

  it('keeps partial exact results on an API failure', async () => {
    api.mockResolvedValueOnce({ count: 2, items: [item(1), item(2)] });
    await service.start(); await finish();
    api.mockResolvedValueOnce({ count: 3, items: [] }).mockRejectedValueOnce(new Error('access denied'));
    await service.start(false, [1, 2]);
    const state = await finish();
    expect(state.status).toBe('failed');
    expect(state.rows[0].approxMessageCount).toBe(3);
    expect(state.rows[1].countExact).toBe(false);
  });
});
