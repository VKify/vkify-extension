import { parseVisualizerSettings } from './music-visualizer.js';
import { parseLyricsSettings } from './music-lyrics.js';
import { parseWidget, widgetKey } from './widget-stack.js';

export const DOWNLOAD_CENTER_OPEN = 'downloadCenterOpen';
export function widgetIsVisible(id: string, feature: string, values: Record<string, unknown>): boolean {
  if (!parseWidget(values[widgetKey(id)]).visible || (feature && values[feature] !== true)) return false;
  if (id === 'equalizer') return values.equalizerPanelOpen === true;
  if (id === 'music-mini-player') return values.mini_player_open !== false;
  if (id === 'download-center') return values[DOWNLOAD_CENTER_OPEN] === true;
  if (id === 'music_visualizer') return parseVisualizerSettings(values.music_visualizer_settings).output === 'widget';
  if (id === 'music_lyrics') return parseLyricsSettings(values.music_lyrics_settings).output === 'widget';
  return true;
}

/** Feature-specific activation, using each feature's canonical storage representation. */
export function widgetVisibilityPatch(id: string, feature: string, visible: boolean, values: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = { [widgetKey(id)]: { ...parseWidget(values[widgetKey(id)]), visible } };
  if (visible && feature) patch[feature] = true;
  if (id === 'equalizer') patch.equalizerPanelOpen = visible;
  if (id === 'music-mini-player') patch.mini_player_open = visible;
  if (id === 'download-center') patch[DOWNLOAD_CENTER_OPEN] = visible;
  if (visible && (id === 'music_visualizer' || id === 'music_lyrics')) {
    const key = `${id}_settings`;
    const settings = id === 'music_lyrics' ? parseLyricsSettings(values[key]) : parseVisualizerSettings(values[key]);
    patch[key] = JSON.stringify({ ...settings, output: 'widget' });
  }
  return patch;
}
