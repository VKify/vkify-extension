import { parseClockSettings } from './clock/settings.js';
import { parseVisualizerSettings } from './music-visualizer.js';
import { parseLyricsSettings } from './music-lyrics.js';
import { WIDGET_CATALOG, parseWidget, widgetKey } from './widget-stack.js';

export const DOWNLOAD_CENTER_OPEN = 'downloadCenterOpen';
export function widgetIsVisible(id: string, feature: string, values: Record<string, unknown>): boolean {
  if (!parseWidget(values[widgetKey(id)]).visible || (feature && values[feature] !== true)) return false;
  if (id === 'clock') return parseClockSettings(values.clock_settings).output === 'widget';
  if (id === 'equalizer') return values.equalizerPanelOpen === true;
  if (id === 'music-mini-player') return values.mini_player_open !== false;
  if (id === 'download-center') return values[DOWNLOAD_CENTER_OPEN] === true;
  if (id === 'music_visualizer') return parseVisualizerSettings(values.music_visualizer_settings).output === 'widget';
  if (id === 'music_lyrics') return parseLyricsSettings(values.music_lyrics_settings).output === 'widget';
  return true;
}

/** Effective state shown by feature-page master switches. */
export function widgetFeatureIsEnabled(id: string, feature: string, values: Record<string, unknown>): boolean {
  if (values[feature] !== true) return false;
  if (id === 'clock' && parseClockSettings(values.clock_settings).output !== 'widget') return true;
  if (id === 'music_visualizer' && parseVisualizerSettings(values.music_visualizer_settings).output !== 'widget') return true;
  if (id === 'music_lyrics' && parseLyricsSettings(values.music_lyrics_settings).output !== 'widget') return true;
  return widgetIsVisible(id, feature, values);
}

/** Feature-specific activation, using each feature's canonical storage representation. */
export function widgetVisibilityPatch(id: string, feature: string, visible: boolean, values: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = { [widgetKey(id)]: { ...parseWidget(values[widgetKey(id)]), visible } };
  // A widget-only feature must not remain logically enabled after its only UI
  // was hidden. Equalizer is the exception: closing its panel must not disable
  // audio processing.
  if (feature && (id !== 'equalizer' || visible)) patch[feature] = visible;
  if (id === 'equalizer') patch.equalizerPanelOpen = visible;
  if (id === 'music-mini-player') patch.mini_player_open = visible;
  if (id === 'download-center') patch[DOWNLOAD_CENTER_OPEN] = visible;
  if (visible && (id === 'music_visualizer' || id === 'music_lyrics')) {
    const key = `${id}_settings`;
    const settings = id === 'music_lyrics' ? parseLyricsSettings(values[key]) : parseVisualizerSettings(values[key]);
    patch[key] = JSON.stringify({ ...settings, output: 'widget' });
  }
  if (visible && id === 'clock') patch.clock_settings = JSON.stringify({ ...parseClockSettings(values.clock_settings), output: 'widget' });
  return patch;
}

/** Master switches on the music pages own both the feature and widget visibility. */
export function musicFeatureVisibilityPatch(id: 'music_visualizer' | 'music_lyrics', visible: boolean, values: Record<string, unknown>): Record<string, unknown> {
  return {
    [id]: visible,
    [widgetKey(id)]: { ...parseWidget(values[widgetKey(id)]), visible },
  };
}

/** Selecting widget output from the feature page must also reveal its widget. */
export function musicSettingsVisibilityPatch(id: 'music_visualizer' | 'music_lyrics', serialized: string, values: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = { [`${id}_settings`]: serialized };
  const output = id === 'music_lyrics' ? parseLyricsSettings(serialized).output : parseVisualizerSettings(serialized).output;
  if (output === 'widget' && values[id] === true) {
    patch[widgetKey(id)] = { ...parseWidget(values[widgetKey(id)]), visible: true };
  }
  return patch;
}

/** Normalize writes from every settings UI, not only the Widgets tab. */
export function withWidgetVisibility(current: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const result = { ...patch };
  const next = { ...current, ...patch };
  for (const { id, feature } of WIDGET_CATALOG) {
    if (!feature || id === 'equalizer' || typeof patch[feature] !== 'boolean') continue;
    const visible = patch[feature] === true;
    result[widgetKey(id)] = { ...parseWidget(next[widgetKey(id)]), visible };
    if (id === 'music-mini-player') result.mini_player_open = visible;
  }
  for (const id of ['music_visualizer', 'music_lyrics'] as const) {
    const key = `${id}_settings`;
    if (!(key in patch) || next[id] !== true) continue;
    const output = id === 'music_lyrics' ? parseLyricsSettings(next[key]).output : parseVisualizerSettings(next[key]).output;
    if (output === 'widget') result[widgetKey(id)] = { ...parseWidget(next[widgetKey(id)]), visible: true };
  }
  if ('clock_settings' in patch && next.clock_enabled === true && parseClockSettings(next.clock_settings).output === 'widget') {
    result[widgetKey('clock')] = { ...parseWidget(next[widgetKey('clock')]), visible: true };
  }
  return result;
}
