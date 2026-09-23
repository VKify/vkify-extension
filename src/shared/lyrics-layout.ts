import type { VisualizerSettings } from './music-visualizer.js';

/** Use the same 0–100 setting exposed in Appearance → Page offset.
 * Position is the text anchor, including alignment, column width and manual X offset.
 * A centered anchor chooses the left edge; vertical placement does not affect it.
 */
export function lyricsPageOffset(settings: VisualizerSettings): 0 | 100 {
  const width = Math.min(100, settings.width) * .93;
  const alignment = settings.lyricsAlignment === 'right' ? 1 : settings.lyricsAlignment === 'center' ? .5 : 0;
  const anchor = 3.5 + settings.offsetX + width * alignment;
  return anchor >= 49.9999 ? 0 : 100;
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
  return { page_offset_enabled: true, page_offset_value: settings.offsetX < 0 ? 100 : 0 };
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
