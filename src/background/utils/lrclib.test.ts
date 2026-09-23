import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const genius = vi.hoisted(() => vi.fn(async () => 'Plain fallback'));
vi.mock('./lyrics.js', () => ({ fetchGeniusLyrics: genius }));
const record = { artistName: 'Artist', trackName: 'Song', duration: 200, syncedLyrics: '[00:05.50]First\n[00:12.00]Second', plainLyrics: 'First\nSecond' };
beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); genius.mockClear(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('uses duration in /get, parses real timestamps, and shares cached requests', async () => {
  const fetch = vi.fn(async () => ({ ok: true, json: async () => record }));
  vi.stubGlobal('fetch', fetch);
  const { fetchTimedLyrics } = await import('./lrclib.js');
  const [a, b] = await Promise.all([fetchTimedLyrics('Artist', 'Song', 200), fetchTimedLyrics('artist', 'song', 200)]);
  expect(a).toBe(b);
  expect(a.lines).toEqual([{ text: 'First', startTime: 5.5, endTime: 12 }, { text: 'Second', startTime: 12, endTime: 200 }]);
  expect(a.synced).toBe(true);
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('duration=200'), expect.anything());
  expect(await fetchTimedLyrics('Artist', 'Song', 200)).toBe(a);
  expect(fetch).toHaveBeenCalledOnce();
  expect(genius).not.toHaveBeenCalled();
});

it.each([
  { ...record, artistName: 'Other artist' },
  { ...record, trackName: 'Song (live)' },
  { ...record, duration: 203 },
])('rejects a different recording: %j', async data => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => data })));
  const { fetchTimedLyrics } = await import('./lrclib.js');
  const result = await fetchTimedLyrics('Artist', 'Song', 200);
  expect(result).toMatchObject({ synced: false, lines: [], source: 'genius' });
});

it('does not confuse different track durations in the cache', async () => {
  const fetch = vi.fn(async () => ({ ok: true, json: async () => record }));
  vi.stubGlobal('fetch', fetch);
  const { fetchTimedLyrics } = await import('./lrclib.js');
  await fetchTimedLyrics('Artist', 'Song', 200);
  const next = fetchTimedLyrics('Artist', 'Song', 240);
  await vi.advanceTimersByTimeAsync(250);
  expect((await next).synced).toBe(false);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('preserves instrumental and untimed results without inventing timestamps', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ ...record, syncedLyrics: null, plainLyrics: null, instrumental: true }) })));
  const { fetchTimedLyrics } = await import('./lrclib.js');
  expect(await fetchTimedLyrics('Artist', 'Song', 200)).toEqual({ lyrics: '', lines: [], synced: false, source: 'lrclib' });
  expect(genius).not.toHaveBeenCalled();
});

it('does not treat a single timestamped placeholder as synchronized lyrics', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ ...record, syncedLyrics: '[00:00.00]probe' }) })));
  const { fetchTimedLyrics } = await import('./lrclib.js');
  expect(await fetchTimedLyrics('Artist', 'Song', 200)).toMatchObject({ synced: false, lines: [] });
});

it('honors Retry-After across tracks', async () => {
  const fetch = vi.fn(async () => ({ ok: false, status: 429, headers: new Headers({ 'Retry-After': '120' }) }));
  vi.stubGlobal('fetch', fetch);
  const { fetchTimedLyrics } = await import('./lrclib.js');
  expect((await fetchTimedLyrics('Artist', 'Song', 200)).synced).toBe(false);
  const next = fetchTimedLyrics('Artist', 'Another song', 200);
  await vi.advanceTimersByTimeAsync(250);
  await next;
  expect(fetch).toHaveBeenCalledOnce();
});

it('contains network failures and caches a short-lived fallback', async () => {
  const fetch = vi.fn().mockRejectedValue(new Error('offline'));
  vi.stubGlobal('fetch', fetch);
  const { fetchTimedLyrics } = await import('./lrclib.js');
  const result = await fetchTimedLyrics('Artist', 'Song', 200);
  expect(result.synced).toBe(false);
  expect(await fetchTimedLyrics('Artist', 'Song', 200)).toBe(result);
  expect(fetch).toHaveBeenCalledOnce();
});
