import { afterEach, expect, it, vi } from 'vitest';
import { fetchGeniusLyrics } from './lyrics.js';

afterEach(() => vi.unstubAllGlobals());
it('shares in-flight and cached Genius results across consumers', async () => {
  const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ response: { sections: [{ hits: [{ type: 'song', result: { url: 'https://genius.com/example-lyrics' } }] }] } }) })
    .mockResolvedValueOnce({ ok: true, text: async () => '<div data-lyrics-container="true">First<br>Second</div>' });
  vi.stubGlobal('fetch', fetch);
  const results = await Promise.all([fetchGeniusLyrics('Artist', 'Song'), fetchGeniusLyrics(' artist ', ' SONG ')]);
  expect(results).toEqual(['First\nSecond', 'First\nSecond']);
  expect(await fetchGeniusLyrics('Artist', 'Song')).toBe(results[0]);
  expect(fetch).toHaveBeenCalledTimes(2);
});
it('caches missing lyrics and contains network failures', async () => {
  const fetch = vi.fn().mockRejectedValue(new Error('offline'));
  vi.stubGlobal('fetch', fetch);
  expect(await fetchGeniusLyrics('Missing', 'Track')).toBe('');
  expect(await fetchGeniusLyrics('Missing', 'Track')).toBe('');
  expect(fetch).toHaveBeenCalledOnce();
});
