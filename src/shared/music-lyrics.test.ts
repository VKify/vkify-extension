import { expect, it } from 'vitest';
import { exportLyrics, parseLyricsSettings, lyricsCoverPlacement } from './music-lyrics.js';
import { parseSyncedLyrics, type LyricsResult } from './lyrics.js';

it('exports UTF-8 text and LRC that round-trips timestamps and instrumental gaps', () => {
  const lines = [{ text: 'Первая строка', startTime: 12.34, endTime: 17 }, { text: 'Следующая строка', startTime: 25.8, endTime: 60 }];
  const result: LyricsResult = { lyrics: '', lines, synced: true, source: 'lrclib' };
  expect(exportLyrics(result, 'txt')).toBe('Первая строка\nСледующая строка');
  const lrc = exportLyrics(result, 'lrc');
  expect(lrc).toContain('[00:17.00]\n');
  expect(parseSyncedLyrics(lrc, 60)).toEqual(lines);
  expect(exportLyrics({ ...result, synced: false }, 'lrc')).toBe('');
});

it('bounds cover geometry and custom settings without clamping text X to the page margin', () => {
  const settings = parseLyricsSettings({ offsetX: 60, lyricsSecondaryOpacity: 500, lyricsCoverX: 100, lyricsCoverY: 100 });
  expect(settings.offsetX).toBe(60);
  expect(settings.lyricsSecondaryOpacity).toBe(70);
  expect(lyricsCoverPlacement(1000, 600, settings)).toEqual({ x: 880, y: 480, size: 120 });
});
