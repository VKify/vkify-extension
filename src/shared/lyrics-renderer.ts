import { lyricsCoverPlacement } from './music-lyrics.js';
import { lyricIndex, type LyricLine, type LyricPlayback } from './lyrics.js';
import type { VisualizerSettings } from './music-visualizer.js';

/** Bounded canvas layout cache, invalidated by typography/viewport changes. */
export class LyricsRenderer {
  lines: readonly LyricLine[] = [];
  cover: CanvasImageSource | null = null;
  playback: LyricPlayback = { currentTime: 0, duration: 0 };
  private selected = '';
  private selectedIndex = -2;
  private previousIndex = -2;
  private previous = '';
  private fade = 1;
  private layoutKey = '';
  private layouts = new Map<string, string[]>();

  reset(lines: readonly LyricLine[] = []): void {
    this.lines = lines; this.selected = ''; this.previous = ''; this.fade = 0;
    this.selectedIndex = this.previousIndex = -2;
    this.layouts.clear();
  }

  advance(dt: number): void { this.fade = Math.min(1, this.fade + Math.max(0, dt) / .45); }

  draw(g: CanvasRenderingContext2D, w: number, h: number, s: VisualizerSettings, color: string, energy: number, reduced: boolean): void {
    if (s.lyricsShowCover && this.cover) {
      const { x, y, size } = lyricsCoverPlacement(w, h, s);
      g.save(); g.globalAlpha = s.lyricsCoverOpacity / 100 * s.opacity / 100;
      g.filter = s.lyricsCoverBlur ? `blur(${s.lyricsCoverBlur}px)` : 'none';
      g.beginPath(); g.roundRect(x, y, size, size, size * s.lyricsCoverRadius / 100); g.clip();
      g.drawImage(this.cover, x, y, size, size); g.restore();
    }
    const index = lyricIndex(this.lines, this.playback.currentTime, this.playback.duration);
    const text = index >= 0 ? this.lines[index].text : [this.playback.track?.title, this.playback.track?.artist].filter(Boolean).join(' — ');
    if (!text) return;
    if (text !== this.selected || index !== this.selectedIndex) {
      this.previous = this.selected; this.previousIndex = this.selectedIndex;
      this.selected = text; this.selectedIndex = index; this.fade = 0;
    }
    const inset = Math.max(12, w * .035);
    const width = Math.max(20, Math.min(w - inset * 2, (w - inset * 2) * s.width / 100));
    const flow = s.lyricsNeighbors && index >= 0;
    // Viewport-sized type, independent of lyric length. Wrapping never shrinks the whole song.
    const size = Math.max(12, Math.min(w * .062, h * .115, 112) * s.lyricsSize / 100 * s.scale / 100);
    const lineHeight = size * 1.18;
    const gap = size * .5 * s.lyricsLineSpacing / 100;
    const anchor = s.position === 'top' ? .25 : s.position === 'bottom' ? .68 : .4;
    const x = Math.max(32 - width, Math.min(w - 32, inset + w * s.offsetX / 100));
    const y = Math.max(inset, Math.min(h - lineHeight, h * (anchor + s.offsetY / 100)));
    g.save();
    g.beginPath(); g.rect(8, 8, Math.max(0, w - 16), Math.max(0, h - 16)); g.clip();
    g.font = `800 ${size}px system-ui, sans-serif`; g.textAlign = s.lyricsAlignment as CanvasTextAlign; g.textBaseline = 'top';
    g.fillStyle = color;
    // Dark edge keeps the letters legible on bright photos and video, without blurring them.
    g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = Math.max(1, size * .035); g.lineJoin = 'round';
    g.shadowColor = '#000000'; g.shadowBlur = 4 + s.glow * .08;
    const key = `${width}:${size}`;
    if (key !== this.layoutKey) { this.layoutKey = key; this.layouts.clear(); }
    const wrap = (value: string): string[] => {
      const cached = this.layouts.get(value); if (cached) return cached;
      const rows: string[] = []; let row = '';
      // Break even unspaced words; the three-row limit keeps drawing bounded.
      for (const word of value.split(/\s+/)) {
        if (row && g.measureText(row + ' ' + word).width > width) { rows.push(row); row = ''; }
        for (const char of (row ? ' ' : '') + word) {
          if (g.measureText(row + char).width > width && row) { rows.push(row); row = ''; }
          row += char;
        }
        if (rows.length >= 3) break;
      }
      if (row) rows.push(row);
      const result = rows.slice(0, 3);
      if (rows.length > 3) result[2] = result[2].slice(0, -2) + '…';
      if (this.layouts.size >= 12) this.layouts.clear();
      this.layouts.set(value, result); return result;
    };
    const t = reduced ? 1 : this.fade * this.fade * (3 - 2 * this.fade);
    const drawText = (value: string, top: number, alpha: number, active: boolean): void => {
      if (!value || alpha <= 0) return;
      const rows = wrap(value);
      if (top + rows.length * lineHeight < 0 || top > h) return;
      g.save(); g.translate(x + (s.lyricsAlignment === 'center' ? width / 2 : s.lyricsAlignment === 'right' ? width : 0), top);
      // Keep text aligned during music reaction; brightness reacts without bouncing the column.
      const reaction = active && !reduced ? Math.min(1, energy * s.lyricsSensitivity / 100) * s.intensity / 100 : 0;
      g.globalAlpha = Math.min(1, s.opacity / 100 * alpha * (1 + reaction * .12));
      rows.forEach((row, i) => {
        g.strokeText(row, 0, i * lineHeight, width);
        g.fillText(row, 0, i * lineHeight, width);
      });
      g.restore();
    };
    if (flow) {
      const count = Math.round(s.lyricsLineCount);
      const before = Math.floor((count - 1) / 2);
      const first = Math.max(0, index - before), last = Math.min(this.lines.length - 1, index + count - before - 1);
      const distance = (i: number): number => wrap(this.lines[i].text).length * lineHeight + gap;
      // Consecutive lines keep their positions during the entire scroll, including wrapped rows.
      const sequential = this.previousIndex >= 0 && Math.abs(index - this.previousIndex) === 1;
      const shift = sequential ? (index > this.previousIndex ? distance(index - 1) : -distance(index)) * (1 - t) : 0;
      let top = y + shift;
      for (let i = first; i < index; i++) top -= distance(i);
      const prominence = (i: number, current: number): number => i === current ? 1 : s.lyricsSecondaryOpacity / 100 * (i < current ? .7 : 1);
      for (let i = first; i <= last; i++) {
        const alpha = sequential ? prominence(i, this.previousIndex) * (1 - t) + prominence(i, index) * t : prominence(i, index);
        const edge = Math.max(0, Math.min(1, (top + lineHeight) / (lineHeight * 1.3), (h - top) / (lineHeight * 1.3)));
        drawText(this.lines[i].text, top, alpha * edge * (sequential ? 1 : t), i === index);
        top += distance(i);
      }
    } else {
      drawText(this.previous, y - 20 * t, (1 - t) * .7, false);
      drawText(text, y + 20 * (1 - t), t, true);
    }
    g.restore();
  }
}
