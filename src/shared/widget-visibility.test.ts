import { describe, expect, it } from 'vitest';
import { widgetVisibilityPatch, widgetIsVisible, DOWNLOAD_CENTER_OPEN, musicFeatureVisibilityPatch, musicSettingsVisibilityPatch, widgetFeatureIsEnabled, withWidgetVisibility } from './widget-visibility.js';
import { parseLyricsSettings } from './music-lyrics.js';
import { parseVisualizerSettings, isVisualizerSettingsJson } from './music-visualizer.js';
import { coerceStoredSettings } from './store/validation.js';
import { widgetKey } from './widget-stack.js';

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
  it('disables a widget-only feature when hiding it without overwriting its settings', () => {
    const patch = widgetVisibilityPatch('music_lyrics', 'music_lyrics', false, {});
    expect(patch).toMatchObject({ music_lyrics: false, 'widgetState:music_lyrics': { visible: false } });
    expect(patch).not.toHaveProperty('music_lyrics_settings');
  });
  it('keeps equalizer processing enabled when only its panel is closed', () => {
    expect(widgetVisibilityPatch('equalizer', 'audio_equalizer', false, { audio_equalizer: true })).not.toHaveProperty('audio_equalizer');
  });
  it('reopens a hidden music widget from its own feature page', () => {
    const hidden = { music_visualizer: false, 'widgetState:music_visualizer': { visible: false }, music_visualizer_settings: '{"output":"widget"}' };
    expect(musicFeatureVisibilityPatch('music_visualizer', true, hidden)).toMatchObject({ music_visualizer: true, 'widgetState:music_visualizer': { visible: true } });
    expect(musicSettingsVisibilityPatch('music_visualizer', '{"output":"widget"}', { ...hidden, music_visualizer: true }))
      .toMatchObject({ 'widgetState:music_visualizer': { visible: true } });
  });
  it.each([
    ['perf-widget', 'perf_widget'],
    ['music-mini-player', 'music_mini_player'],
    ['music_visualizer', 'music_visualizer'],
    ['music_lyrics', 'music_lyrics'],
  ])('keeps the %s master feature and widget visibility synchronized', (id, feature) => {
    const hidden = { [widgetKey(id)]: { mode: 'free', visible: false } };
    expect(withWidgetVisibility(hidden, { [feature]: true })).toMatchObject({ [feature]: true, [widgetKey(id)]: { visible: true } });
    expect(withWidgetVisibility(hidden, { [feature]: false })).toMatchObject({ [feature]: false, [widgetKey(id)]: { visible: false } });
  });
  it('reports hidden widget output as disabled but ignores widget state for overlay output', () => {
    const state = { music_lyrics: true, 'widgetState:music_lyrics': { visible: false } };
    expect(widgetFeatureIsEnabled('music_lyrics', 'music_lyrics', { ...state, music_lyrics_settings: '{"output":"widget"}' })).toBe(false);
    expect(widgetFeatureIsEnabled('music_lyrics', 'music_lyrics', { ...state, music_lyrics_settings: '{"output":"overlay"}' })).toBe(true);
  });
  it('opens downloads explicitly and defaults to closed before user interaction', () => {
    expect(widgetIsVisible('download-center', '', {})).toBe(false);
    const patch = widgetVisibilityPatch('download-center', '', true, {});
    expect(patch[DOWNLOAD_CENTER_OPEN]).toBe(true);
    expect(widgetIsVisible('download-center', '', patch)).toBe(true);
  });
});
