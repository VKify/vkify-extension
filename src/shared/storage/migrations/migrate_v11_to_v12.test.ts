import { expect, it } from 'vitest';
import { migrateV11ToV12 } from './migrate_v11_to_v12.js';

it('moves enabled lyrics to an independent feature and preserves typography and placement', () => {
  const old = { music_visualizer: true, music_visualizer_settings: JSON.stringify({ mode: 'lyrics', offsetX: 35, offsetY: -20, width: 45, lyricsSize: 140, color: '#123456', hideWhenPaused: true }), custom_background: 'wallpaper' };
  const next = migrateV11ToV12.migrate(old);
  expect(next.music_lyrics).toBe(true);
  expect(next.music_visualizer).toBe(false);
  expect(JSON.parse(String(next.music_lyrics_settings))).toMatchObject({ offsetX: 35, offsetY: -20, width: 45, lyricsSize: 140, color: '#123456', hideWhenPaused: true, lyricsSecondaryOpacity: 18 });
  expect(JSON.parse(String(next.music_visualizer_settings)).mode).toBe('spectrum');
  expect(next.custom_background).toBe('wallpaper');
  expect(migrateV11ToV12.migrate(next)).toEqual(next);
  expect(old.music_visualizer).toBe(true);
});

it('leaves existing visualizers and explicitly saved lyrics settings intact', () => {
  const old = { music_visualizer: true, music_visualizer_settings: '{"mode":"wave","opacity":42}', music_lyrics: true, music_lyrics_settings: '{"offsetX":22,"lyricsShowCover":true}' };
  const next = migrateV11ToV12.migrate(old);
  expect(next.music_visualizer_settings).toBe(old.music_visualizer_settings);
  expect(next.music_visualizer).toBe(true);
  expect(next.music_lyrics).toBe(true);
  expect(JSON.parse(String(next.music_lyrics_settings))).toMatchObject({ offsetX: 22, lyricsShowCover: true });
});

it('does not enable anything for corrupt settings or a disabled legacy effect', () => {
  for (const raw of [undefined, '{broken', 'null', '[]', '{"mode":"lyrics"}']) {
    const next = migrateV11ToV12.migrate({ music_visualizer: false, music_visualizer_settings: raw });
    expect(next.music_lyrics).toBe(false);
    expect(next.music_visualizer).toBe(false);
  }
});
