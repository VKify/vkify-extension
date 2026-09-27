import type { VisualizerSettings } from './music-visualizer.js';

/** Automatic music layouts always move VK content to the left.
 * The visualizer/lyrics occupy the free column on the right; manual positioning
 * of the effect must not unexpectedly flip the whole site to the other side.
 */
export function lyricsPageOffset(settings: VisualizerSettings): 0 | 100 {
  void settings;
  return 0;
}

export function lyricsPageOffsetPatch(settings: VisualizerSettings): { page_offset_enabled?: boolean; page_offset_value?: number } {
  // A single subtitle at the bottom belongs below the content, not in a side column.
  const subtitles = settings.position === 'bottom' && settings.lyricsStyle === 'focus' && !settings.lyricsShowCover;
  return settings.output === 'overlay' && settings.lyricsAvoidContent && !subtitles
    ? { page_offset_enabled: true, page_offset_value: lyricsPageOffset(settings) }
    : {};
}

/** Lyrics and circular visualizers share the standard Appearance setting. */
export function musicPageOffsetPatch(settings: VisualizerSettings): { page_offset_enabled?: boolean; page_offset_value?: number } {
  if (settings.mode === 'lyrics') return lyricsPageOffsetPatch(settings);
  if (settings.output !== 'overlay' || !settings.visualizerAvoidContent || !['radial', 'rings', 'portal', 'prism', 'nebula'].includes(settings.mode)) return {};
  return { page_offset_enabled: true, page_offset_value: 0 };
}

export function musicOverlayArea(width: number, height: number, page: { left: number; right: number }) {
  const left = Math.max(0, Math.min(width, page.left));
  const right = Math.max(0, width - Math.max(0, page.right));
  const gap = Math.max(left, right);
  // Never move the page vertically or invent space when the normal layout fills the window.
  if (gap < 180) return null;
  const top = Math.min(72, height * .12), margin = 12;
  return { x: right >= left ? width - right + margin : margin, y: top,
    width: Math.max(1, gap - margin * 2), height: Math.max(1, height - top - margin) };
}
