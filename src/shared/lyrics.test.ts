import { describe, expect, it } from 'vitest';
import { lyricIndex, lyricsKey, prepareLyrics, parseSyncedLyrics } from './lyrics.js';
import { LyricsRenderer } from './lyrics-renderer.js';
import { parseVisualizerSettings } from './music-visualizer.js';

describe('lyrics visualization', () => {
  it('parses LRC fractions, repeated timestamps and offset; preserves instrumental gaps', () => {
    const lines = parseSyncedLyrics('[ar:Artist]\n[offset:500]\n[00:05.50][00:20.125]Repeat\n[00:10.00]\n[00:30]Last', 40);
    expect(lines).toEqual([
      { text: 'Repeat', startTime: 5, endTime: 9.5 },
      { text: 'Repeat', startTime: 19.625, endTime: 29.5 },
      { text: 'Last', startTime: 29.5, endTime: 40 },
    ]);
    expect([0, 5, 10, 25, 5, 40].map(time => lyricIndex(lines, time, 40))).toEqual([-1, 0, -1, 1, 0, -1]);
  });
  it('rejects malformed timestamps and combines simultaneous lines', () => {
    expect(parseSyncedLyrics('Plain text\n[00:99]Invalid\n[ar:Artist]', 100)).toEqual([]);
    expect(parseSyncedLyrics('[00:05.1]One\n[00:05.100]Two\n[00:05.10]\n[99:00]Outside', 100))
      .toEqual([{ text: 'One / Two', startTime: 5.1, endTime: 100 }]);
  });
  it('upgrades the compact layout once and preserves later customizations', () => {
    const upgraded = parseVisualizerSettings({ mode: 'lyrics', lyricsStyle: 'focus', width: 50 });
    expect([upgraded.lyricsStyle, upgraded.width, upgraded.position, upgraded.color]).toEqual(['flow', 100, 'full', '#ffffff']);
    const customized = parseVisualizerSettings({ ...upgraded, lyricsStyle: 'focus', width: 60 });
    expect([customized.lyricsStyle, customized.width]).toEqual(['focus', 60]);
  });
  it('shows a large left-aligned column of several lines instead of three distant labels', () => {
    const renderer = new LyricsRenderer();
    renderer.reset(prepareLyrics('First line\nSecond line\nCurrent line\nNext line\nAnother line\nLast line'));
    renderer.playback = { currentTime: 25, duration: 60 };
    const drawn: string[] = [];
    const target: Record<string, unknown> = {
      measureText: (text: string) => ({ width: text.length * 30 }),
      fillText: (text: string) => drawn.push(text),
    };
    const g = new Proxy(target, { get: (object, key: string) => object[key] ?? (() => {}) }) as unknown as CanvasRenderingContext2D;
    renderer.draw(g, 1000, 640, parseVisualizerSettings({ mode: 'lyrics' }), '#ffffff', 0, true);
    expect(drawn.length).toBeGreaterThanOrEqual(5);
    expect(drawn).toContain('Current line');
    expect(target.textAlign).toBe('left');
    expect(Number(String(target.font).match(/([\d.]+)px/)?.[1])).toBeGreaterThanOrEqual(60);
  });
  it('honors the neighbors toggle even in Focus style', () => {
    const renderer = new LyricsRenderer();
    renderer.reset(prepareLyrics('Previous\nCurrent\nNext'));
    renderer.playback = { currentTime: 15, duration: 30 };
    const drawn: string[] = [];
    const g = new Proxy({}, { get: (_, key) => key === 'measureText' ? (text: string) => ({ width: text.length * 10 }) : key === 'fillText' ? (text: string) => drawn.push(text) : () => {} }) as CanvasRenderingContext2D;
    const settings = parseVisualizerSettings({ mode: 'lyrics', lyricsLayoutVersion: 2, lyricsStyle: 'focus', lyricsNeighbors: true });
    renderer.draw(g, 1000, 640, settings, '#fff', 0, true);
    expect(drawn).toEqual(['Previous', 'Current', 'Next']);
    drawn.length = 0;
    renderer.draw(g, 1000, 640, { ...settings, lyricsNeighbors: false }, '#fff', 0, true);
    expect(drawn).toEqual(['Current']);
  });
  it('keeps plain text untimed and supports seeking in both directions', () => {
    const lines = prepareLyrics('[Verse]\r\n First\n\nSecond\nThird');
    expect(lines).toEqual([{ text: 'First' }, { text: 'Second' }, { text: 'Third' }]);
    expect(lyricIndex(lines, 80, 90)).toBe(2);
    expect(lyricIndex(lines, 2, 90)).toBe(0);
    expect(lyricIndex(lines, 90, 90)).toBe(2);
    expect(lyricIndex(lines, 10, Infinity)).toBe(-1);
  });
  it('honors real timestamps, intro and instrumental gaps', () => {
    const lines = [{ text: 'One', startTime: 5, endTime: 8 }, { text: 'Two', startTime: 12 }];
    expect([0, 5, 8, 12, 100].map(time => lyricIndex(lines, time, 120))).toEqual([-1, 0, -1, 1, 1]);
  });
  it('normalizes case and whitespace without discarding featured artists or versions', () => {
    expect(lyricsKey(' Artist ', 'Song (feat. Someone)')).toBe(lyricsKey('artist', 'song  (feat. someone)'));
    expect(lyricsKey('Artist', 'Song (live)')).not.toBe(lyricsKey('Artist', 'Song'));
  });
  it('wraps bounded text, caches layout and clears the previous track', () => {
    const renderer = new LyricsRenderer();
    renderer.reset(prepareLyrics('A very long lyric '.repeat(100)));
    renderer.playback = { currentTime: 1, duration: 100 };
    const drawn: string[] = [];
    let measures = 0;
    const g = new Proxy({}, { get: (_, key) => key === 'measureText'
      ? (text: string) => { measures++; return { width: text.length * 8 }; }
      : key === 'fillText' ? (text: string) => drawn.push(text) : () => {} }) as CanvasRenderingContext2D;
    const settings = parseVisualizerSettings({ mode: 'lyrics' });
    renderer.draw(g, 320, 180, settings, '#ffffff', .5, true);
    expect(drawn.length).toBeLessThanOrEqual(3);
    const count = measures;
    renderer.draw(g, 320, 180, settings, '#ffffff', .5, true);
    expect(measures).toBe(count);
    renderer.reset(); drawn.length = 0;
    renderer.draw(g, 320, 180, settings, '#ffffff', .5, true);
    expect(drawn).toEqual([]);
  });
});
