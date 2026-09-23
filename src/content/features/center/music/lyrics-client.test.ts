import { afterEach, expect, it, vi } from 'vitest';
import { fetchTimedLyrics } from './lyrics-client.js';
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it('times out an unresponsive message so the caller can retry', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('chrome', { runtime: { sendMessage: () => new Promise(() => {}) } });
  const result = fetchTimedLyrics('Artist', 'Track', 100);
  await vi.advanceTimersByTimeAsync(20000);
  expect(await result).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});
it('filters malformed lines and sorts valid timestamps before rendering', async () => {
  vi.stubGlobal('chrome', { runtime: { sendMessage: async () => ({ success: true, synced: true,
    lines: [null, { text: 123 }, { text: 'Bad', startTime: NaN }, { text: 'Second', startTime: 5 }, { text: 'First', startTime: 0 }] }) } });
  expect((await fetchTimedLyrics('Artist', 'Track', 100))?.lines).toEqual([{ text: 'First', startTime: 0 }, { text: 'Second', startTime: 5 }]);
});
