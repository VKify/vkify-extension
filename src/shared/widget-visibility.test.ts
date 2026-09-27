import { describe, expect, it } from 'vitest';
import { widgetVisibilityPatch, widgetIsVisible, DOWNLOAD_CENTER_OPEN } from './widget-visibility.js';
import { parseLyricsSettings } from './music-lyrics.js';
import { parseVisualizerSettings, isVisualizerSettingsJson } from './music-visualizer.js';
import { coerceStoredSettings } from './store/validation.js';

describe('widget visibility activation', () => {
  it.each(['music_visualizer', 'music_lyrics'])('opens %s as a widget without losing serialized appearance settings', id => {
    const key = `${id}_settings`;
    const before = JSON.stringify({ output: 'overlay', colorMode: 'custom', color: '#123456', intensity: 42, hideWhenPaused: true, lyricsSize: 87, lyricsLayoutVersion: 2 });
    const patch = widgetVisibilityPatch(id, id, true, { [key]: before });
    expect(patch[id]).toBe(true);
    expect(isVisualizerSettingsJson(patch[key])).toBe(true);
    // Same normalization used by the settings store must not reset this value.
    expect(coerceStoredSettings(patch)[key]).toBe(patch[key]);
    const settings = id === 'music_lyrics' ? parseLyricsSettings(patch[key]) : parseVisualizerSettings(patch[key]);
    expect(settings).toMatchObject({ output: 'widget', color: '#123456', intensity: 42, hideWhenPaused: true, lyricsSize: 87 });
    if (id === 'music_lyrics') expect(settings.mode).toBe('lyrics');
    expect(widgetIsVisible(id, id, patch)).toBe(true);
  });
  it('does not treat an active overlay as an open widget', () => {
    expect(widgetIsVisible('music_visualizer', 'music_visualizer', { music_visualizer: true, music_visualizer_settings: '{"output":"overlay"}' })).toBe(false);
    expect(widgetIsVisible('music_lyrics', 'music_lyrics', { music_lyrics: true, music_lyrics_settings: '{"output":"overlay"}' })).toBe(false);
  });
  it('does not overwrite visualization settings when hiding a widget', () => {
    expect(widgetVisibilityPatch('music_lyrics', 'music_lyrics', false, {})).not.toHaveProperty('music_lyrics_settings');
  });
  it('opens downloads explicitly and defaults to closed before user interaction', () => {
    expect(widgetIsVisible('download-center', '', {})).toBe(false);
    const patch = widgetVisibilityPatch('download-center', '', true, {});
    expect(patch[DOWNLOAD_CENTER_OPEN]).toBe(true);
    expect(widgetIsVisible('download-center', '', patch)).toBe(true);
  });
});
