import { musicPageOffsetPatch, musicOverlayArea } from '@/shared/lyrics-layout.js';
import { createFloatingWidget, type FloatingWidgetHandle } from '@/content/ui/floating-widget.js';
import { t } from '@/content/i18n/index.js';
import { musicArtworkUrl } from '@/shared/music-artwork.js';
import { fetchTrackArtwork } from '../artwork.js';
import { parseLyricsSettings } from '@/shared/music-lyrics.js';
import type { LyricsResult } from '@/shared/lyrics.js';
import { installOverlayControls } from '../overlay-controls.js';
import { lyricsKey } from '@/shared/lyrics.js';
import { fetchTimedLyrics } from '../lyrics-client.js';
import type { FeatureContext } from '@/content/core/feature-context.js';
import type { FeatureMap } from '@/types/index.js';
import { InjectedScript } from '@/content/core/injected-scripts.js';
import { waitForInjectedScript } from '@/content/utils/injected-ready.js';
import { parseVisualizerSettings } from '@/shared/music-visualizer.js';
import { SILENT_ANALYSIS, VisualizerRenderer, type VisualizerAnalysis } from '@/shared/visualizer-renderer.js';
import { BACKGROUND_LAYERS, BACKGROUND_LAYERS_CSS, attachWallpaperToBody } from '@/content/features/appearance/background/layers.js';

export function createMusicVisualizerFeature(ctx: FeatureContext): FeatureMap { return createMusicOverlayFeature(ctx, 'music_visualizer'); }
export function createMusicLyricsFeature(ctx: FeatureContext): FeatureMap { return createMusicOverlayFeature(ctx, 'music_lyrics'); }

/** Independent canvases/settings share the existing analyser and overlay lifecycle. */
function createMusicOverlayFeature(ctx: FeatureContext, feature: 'music_visualizer' | 'music_lyrics'): FeatureMap {
  const isLyrics = feature === 'music_lyrics';
  const settingsKey = isLyrics ? 'music_lyrics_settings' : 'music_visualizer_settings';
  const canvasId = isLyrics ? 'vkify-music-lyrics' : 'vkify-music-visualizer';
  let widget: FloatingWidgetHandle | null = null;
  let output = '';
  let canvasObserver: ResizeObserver | null = null;
  let lyricsLoading = false;
  let lyricsAttempts = 0;
  let lyricsRetryAt = 0;
  let result: LyricsResult | null = null;
  let controls: ReturnType<typeof installOverlayControls> | null = null;
  let coverImage: HTMLImageElement | null = null;
  let coverUrl = '';
  let apiCover = '';
  let artworkTrack = '';
  let failedCovers = new Set<string>();
  let canvas: HTMLCanvasElement | null = null;
  let frame = 0;
  let idleTimer: number | undefined;
  let paletteTimer: number | undefined;
  let previous = 0;
  let generation = 0;
  let revision = 0;
  let pending = false;
  let lastData = 0;
  let sourceUrl = '';
  let trackKey = '';
  let lyricsRequest = 0;
  let picture: HTMLImageElement | null = null;
  let offStore: (() => void) | null = null;
  let settings = parseVisualizerSettings(null);
  let renderer = new VisualizerRenderer();
  let analysis: VisualizerAnalysis = SILENT_ANALYSIS;
  let themeColors: [string, string] = ['#5181b8', '#a855f7'];
  let artworkColors: [string, string] | null = null;
  let displayed: [number[], number[]] | null = null;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const updateVisibility = (): void => {
    if (canvas) canvas.style.visibility = !controls?.editing && settings.hideWhenPaused && !(analysis.playing && performance.now() - lastData < 1500) ? 'hidden' : 'visible';
  };

  const onData = (event: Event): void => {
    const data = (event as CustomEvent<VisualizerAnalysis>).detail;
    if (!data || !Array.isArray(data.spectrum) || !Array.isArray(data.waveform) || data.spectrum.length > 4096 || data.waveform.length > 8192) return;
    const playback = data.playback;
    const track = playback?.track;
    data.playback = playback && Number.isFinite(playback.currentTime) ? {
      currentTime: Math.max(0, playback.currentTime), duration: Number.isFinite(playback.duration) ? playback.duration : 0,
      track: track && typeof track.id === 'string' && typeof track.artist === 'string' && typeof track.title === 'string'
        ? { id: track.id.slice(0, 300), artist: track.artist.slice(0, 300), title: track.title.slice(0, 300), coverUrl: musicArtworkUrl(track.coverUrl) } : undefined,
    } : { currentTime: 0, duration: 0 };
    renderer.lyrics.playback = data.playback;
    analysis = data;
    updateLyrics();
    updateTrackArtwork();
    lastData = performance.now();
    updateVisibility();
  };

  const updateLyrics = (): void => {
    const track = analysis.playback?.track;
    if (!isLyrics) {
      if (trackKey) { trackKey = ''; lyricsRequest++; renderer.lyrics.reset(); }
      return;
    }
    const valid = track && typeof track.artist === 'string' && typeof track.title === 'string'
      && track.artist.length <= 300 && track.title.length <= 300;
    // VK can omit metadata while rebuilding its player. Only a confirmed track
    // identity may invalidate lyrics or an in-flight request for the current song.
    if (!valid) return;
    const duration = analysis.playback?.duration ?? 0;
    const key = valid ? String(track.id) + lyricsKey(track.artist, track.title) : '';
    if (key !== trackKey) {
      trackKey = key; lyricsRequest++; lyricsLoading = false; lyricsAttempts = 0; lyricsRetryAt = 0;
      renderer.lyrics.reset(); result = null; renderer.lyrics.cover = null;
      coverUrl = ''; apiCover = ''; artworkTrack = ''; failedCovers.clear();
      if (coverImage) { coverImage.onload = null; coverImage.onerror = null; coverImage = null; }
    }
    if (result || lyricsLoading || lyricsAttempts >= 3 || performance.now() < lyricsRetryAt) return;
    if (!valid || !key || duration <= 0 || duration > 86400) return;
    const request = ++lyricsRequest;
    lyricsLoading = true; lyricsAttempts++;
    void fetchTimedLyrics(track.artist, track.title, duration).then(next => {
      if (request !== lyricsRequest || !canvas) return;
      lyricsLoading = false; lyricsRetryAt = performance.now() + 10000;
      result = next; renderer.lyrics.reset(next?.synced ? next.lines : []); updateCover();
    });
  };

  const updateTrackArtwork = (): void => {
    const track = analysis.playback?.track;
    if (!isLyrics || !settings.lyricsShowCover || !track) return;
    if (artworkTrack !== track.id) {
      artworkTrack = track.id; apiCover = ''; failedCovers = new Set();
      const id = track.id, version = generation;
      // Player metadata is instant; the API can supply a missing/better cover independently of LRC.
      void fetchTrackArtwork(ctx, id).then(url => {
        if (generation !== version || artworkTrack !== id) return;
        apiCover = url; updateCover();
      });
    }
    if (musicArtworkUrl(track.coverUrl) && coverUrl !== track.coverUrl && !failedCovers.has(track.coverUrl!)) updateCover();
  };
  const updateCover = (): void => {
    if (!isLyrics || !canvas || !settings.lyricsShowCover) { renderer.lyrics.cover = null; return; }
    const element = document.querySelector<HTMLImageElement>(ctx.selectors.music.playerCover);
    const track = analysis.playback?.track;
    const sources = [apiCover, musicArtworkUrl(track?.coverUrl), musicArtworkUrl(element?.currentSrc || element?.src)];
    const url = sources.find(value => value && !failedCovers.has(value)) ?? '';
    if (url === coverUrl) { if (coverImage?.complete && coverImage.naturalWidth) renderer.lyrics.cover = coverImage; return; }
    if (coverImage) { coverImage.onload = null; coverImage.onerror = null; }
    coverUrl = url; renderer.lyrics.cover = null;
    if (!url) return;
    const image = new Image(); coverImage = image;
    image.onload = () => { if (coverImage === image && canvas && settings.lyricsShowCover) renderer.lyrics.cover = image; };
    image.onerror = () => {
      if (coverImage !== image || !canvas) return;
      failedCovers.add(url); renderer.lyrics.cover = null; updateCover();
    };
    image.src = url;
  };
  const applyOutput = (): void => {
    if (!canvas || output === settings.output) return;
    controls?.dispose(); controls = null;
    widget?.destroy(); widget = null;
    output = settings.output;
    if (output === 'widget') {
      const key = 'vkify-' + feature + '-widget';
      let geometry: Record<string, number> = {};
      try { geometry = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { /* defaults */ }
      const save = (patch: Record<string, number>): void => {
        geometry = { ...geometry, ...patch };
        try { localStorage.setItem(key, JSON.stringify(geometry)); } catch { /* storage unavailable */ }
      };
      widget = createFloatingWidget({
        id: feature, title: t(isLyrics ? 'widget.lyrics' : 'widget.visualizer'),
        titleKey: isLyrics ? 'widget.lyrics' : 'widget.visualizer',
        onToggle: () => onVisibility(),
        width: Number.isFinite(geometry.width) ? Math.max(220, geometry.width) : 360,
        height: Number.isFinite(geometry.height) ? Math.max(160, geometry.height) : 280,
        resizable: true, collapsible: true, initialPosition: isLyrics ? 'bottom-left' : 'bottom-right',
        loadPosition: () => Number.isFinite(geometry.left) && Number.isFinite(geometry.top) ? { left: geometry.left, top: geometry.top } : null,
        onPositionChange: pos => save({ ...pos }), onSizeChange: size => save({ ...size }),
        onClose: () => { void ctx.setSetting(feature, false); },
      });
      widget.body.style.cssText += ';position:relative;overflow:hidden;';
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
      widget.body.append(canvas); widget.mount();
    } else {
      canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;';
      document.body.prepend(canvas);
    }
    controls = installOverlayControls(canvas, ctx, () => settings, value => { settings = value; },
      () => ({ track: analysis.playback?.track, result }), applyLayer, feature, () => overlayArea() ?? { x: 0, y: 0, width: innerWidth, height: innerHeight });
  };
  const applyLayer = (): void => {
    if (widget && canvas) { canvas.style.zIndex = '0'; return; }
    if (canvas && !controls?.editing) canvas.style.zIndex = isLyrics && settings.lyricsLayer === 'foreground' ? '10' : String(isLyrics ? BACKGROUND_LAYERS.lyrics : BACKGROUND_LAYERS.visualizer);
  };
  const overlayArea = (): ReturnType<typeof musicOverlayArea> => {
    if (widget || !Object.keys(musicPageOffsetPatch(settings)).length || !document.documentElement.hasAttribute('data-vkify-page_offset')) return null;
    const page = document.getElementById('page_layout');
    if (!page) return null;
    const rect = page.getBoundingClientRect();
    const area = musicOverlayArea(innerWidth, innerHeight, rect);
    const other = document.getElementById(isLyrics ? 'vkify-music-visualizer' : 'vkify-music-lyrics');
    if (area && other?.dataset.vkifyAvoidContent === 'true' && other.style.visibility !== 'hidden') {
      const half = Math.max(1, (area.height - 16) / 2);
      return { ...area, y: area.y + (isLyrics ? half + 16 : 0), height: half };
    }
    return area;
  };
  const updateFont = (): void => {
    if (!canvas || !isLyrics) return;
    renderer.lyrics.fontFamily = getComputedStyle(canvas).fontFamily || 'system-ui, sans-serif';
    renderer.lyrics.invalidateLayout();
  };
  const updatePalette = (): void => {
    updateFont();
    updateTrackArtwork(); updateCover();
    if (!canvas || document.hidden) return;
    const css = getComputedStyle(document.documentElement);
    const accent = css.getPropertyValue('--vkify-accent').trim() || '#5181b8';
    themeColors = settings.colorMode === 'theme'
      ? [css.getPropertyValue('--vkify-g1').trim() || accent, css.getPropertyValue('--vkify-g3').trim() || accent]
      : [accent, accent];
    if (settings.colorMode !== 'auto' && settings.colorMode !== 'wallpaper') return;
    const image = document.querySelector<HTMLImageElement>(ctx.selectors.music.playerCover);
    const version = generation;
    const applyImage = (url: string): void => {
      if (version !== generation || url === sourceUrl) return;
      sourceUrl = url; artworkColors = null;
      if (picture) { picture.onload = null; picture.onerror = null; }
      if (!url) return;
      const request = new Image(); picture = request;
      request.crossOrigin = 'anonymous';
      request.onload = () => {
        if (generation !== version || picture !== request) return;
        try {
          const sample = document.createElement('canvas'); sample.width = sample.height = 32;
          const g = sample.getContext('2d'); if (!g) return;
          g.drawImage(request, 0, 0, 32, 32);
          const pixels = g.getImageData(0, 0, 32, 32).data;
          const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
          for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i], green = pixels[i + 1], b = pixels[i + 2];
            if (pixels[i + 3] < 128 || Math.max(r, green, b) < 35 || Math.min(r, green, b) > 235) continue;
            const key = `${r >> 5},${green >> 5},${b >> 5}`;
            const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
            bucket.count++; bucket.r += r; bucket.g += green; bucket.b += b; buckets.set(key, bucket);
          }
          const ranked = [...buckets.values()].sort((a, b) => b.count - a.count);
          const first = ranked[0];
          if (!first) return;
          const second = ranked.find((b) => Math.abs(b.r / b.count - first.r / first.count) + Math.abs(b.g / b.count - first.g / first.count) + Math.abs(b.b / b.count - first.b / first.count) > 100) ?? first;
          const hex = (b: typeof first): string => '#' + [b.r, b.g, b.b].map((v) => Math.round(v / b.count).toString(16).padStart(2, '0')).join('');
          artworkColors = [hex(first), hex(second)];
        } catch { artworkColors = null; }
      };
      request.onerror = () => { if (picture === request) artworkColors = null; };
      request.src = url;
    };
    if (settings.colorMode === 'wallpaper') {
      void ctx.getSetting<string>('custom_background').then((url) => {
        if (settings.colorMode === 'wallpaper') applyImage(typeof url === 'string' && /^(https?:|data:image\/)/.test(url) ? url : '');
      });
    } else applyImage(image?.currentSrc || image?.src || '');
  };

  const cancelLoop = (): void => {
    cancelAnimationFrame(frame); frame = 0;
    if (idleTimer !== undefined) { clearTimeout(idleTimer); idleTimer = undefined; }
  };
  const tick = (now: number): void => {
    frame = 0;
    if (!canvas || document.hidden || widget?.isCollapsed()) return;
    const playing = analysis.playing && now - lastData < 1500;
    updateVisibility();
    const limit = settings.fps === '30' || (settings.fps === 'auto' && (navigator.hardwareConcurrency ?? 8) <= 4) ? 30 : 60;
    if (previous && now - previous < 1000 / limit - .5) { frame = requestAnimationFrame(tick); return; }
    const dt = previous ? Math.min((now - previous) / 1000, .1) : 1 / limit; previous = now;
    const dpr = Math.min(devicePixelRatio || 1, settings.quality === 'low' ? 1 : settings.quality === 'high' ? 2 : 1.5);
    const width = widget ? widget.body.clientWidth : innerWidth, height = widget ? widget.body.clientHeight : innerHeight;
    if (width <= 0 || height <= 0) return;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) { canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); }
    const g = canvas.getContext('2d');
    if (g) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, width, height);
      renderer.advance(playing ? analysis : SILENT_ANALYSIS, settings, dt, motion.matches);
      let colors: [string, string] = settings.colorMode === 'custom' ? [settings.color, settings.color]
        : settings.colorMode === 'gradient' ? [settings.color, settings.color2]
        : (settings.colorMode === 'auto' || settings.colorMode === 'wallpaper') && artworkColors ? artworkColors : themeColors;
      if (colors.every((color) => /^#[0-9a-f]{6}$/i.test(color))) {
        const target = colors.map((color) => [1, 3, 5].map((start) => parseInt(color.slice(start, start + 2), 16))) as [number[], number[]];
        displayed ??= target.map((color) => [...color]) as [number[], number[]];
        const mix = 1 - Math.exp(-dt / .4);
        displayed.forEach((color, i) => color.forEach((channel, j) => { color[j] = channel + (target[i][j] - channel) * mix; }));
        colors = displayed.map((color) => `rgb(${color.map(Math.round).join(',')})`) as [string, string];
      } else displayed = null;
      const area = overlayArea();
      g.save();
      if (area) { g.translate(area.x, area.y); g.beginPath(); g.rect(0, 0, area.width, area.height); g.clip(); }
      renderer.draw(g, area?.width ?? width, area?.height ?? height, settings, colors, motion.matches);
      g.restore();
    }
    if (!playing && renderer.energy < .003) {
      idleTimer = window.setTimeout(() => { idleTimer = undefined; frame = requestAnimationFrame(tick); }, 120);
    } else frame = requestAnimationFrame(tick);
  };
  const onVisibility = (): void => {
    cancelLoop(); previous = 0;
    if (!document.hidden && canvas) { updatePalette(); frame = requestAnimationFrame(tick); }
  };
  const refresh = async (version = generation): Promise<void> => {
    const request = ++revision;
    const saved = await ctx.getSetting(settingsKey);
    if (version !== generation || request !== revision) return;
    settings = isLyrics ? parseLyricsSettings(saved) : parseVisualizerSettings(saved);
    if (!isLyrics && settings.mode === 'lyrics') settings.mode = 'spectrum';
    applyOutput(); applyLayer();
    updateLyrics();
    updateVisibility();
    if (canvas) {
      canvas.style.filter = settings.blur ? `blur(${settings.blur}px)` : '';
      canvas.dataset.vkifyAvoidContent = String(Object.keys(musicPageOffsetPatch(settings)).length > 0);
    }
    updatePalette();
  };
  return { [feature]: {
    enable: async () => {
      if (canvas || pending) return;
      pending = true;
      const version = ++generation;
      await refresh(version);
      if (version !== generation) return;
      canvas = document.createElement('canvas'); canvas.id = canvasId;
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;';
      canvas.style.filter = settings.blur ? `blur(${settings.blur}px)` : '';
      updateVisibility();
      attachWallpaperToBody();
      ctx.injectCSS(feature, `${BACKGROUND_LAYERS_CSS}
        #${canvasId} { z-index:${BACKGROUND_LAYERS.visualizer}; }
      `);
      applyOutput(); applyLayer(); updateVisibility();
      canvas.dataset.vkifyAvoidContent = String(Object.keys(musicPageOffsetPatch(settings)).length > 0);
      canvas.style.filter = settings.blur ? `blur(${settings.blur}px)` : '';
      window.addEventListener('vkify:visualizer:data', onData);
      document.addEventListener('visibilitychange', onVisibility);
      document.fonts?.addEventListener('loadingdone', updateFont);
      offStore = ctx.onStorageChange((key) => {
        if (key === settingsKey) void refresh(version);
        if (key === 'custom_font_value' || key === 'custom_font_id') updateFont();
      });
      paletteTimer = window.setInterval(updatePalette, 1500); updatePalette();
      canvasObserver = new ResizeObserver(() => {
        cancelLoop(); previous = 0;
        if (!document.hidden && canvas && !widget?.isCollapsed()) frame = requestAnimationFrame(tick);
      });
      canvasObserver.observe(canvas);
      if (!document.hidden) frame = requestAnimationFrame(tick);
      // Subscribe before loading: the ready signal can arrive immediately from cache.
      const ready = waitForInjectedScript(InjectedScript.EQUALIZER);
      ctx.injectScript(InjectedScript.EQUALIZER);
      await ready;
      if (version !== generation) return;
      pending = false;
      ctx.sendEvent('vkify:visualizer:update', { enabled: true, ...(isLyrics ? { consumer: 'music_lyrics' } : {}) });

    },
    disable: () => {
      generation++; revision++; pending = false;
      lyricsRequest++; trackKey = ''; lyricsLoading = false; lyricsAttempts = 0; lyricsRetryAt = 0;
      canvasObserver?.disconnect(); canvasObserver = null;
      ctx.sendEvent('vkify:visualizer:update', { enabled: false, ...(isLyrics ? { consumer: 'music_lyrics' } : {}) });
      controls?.dispose(); controls = null; result = null;
      if (coverImage) { coverImage.onload = null; coverImage.onerror = null; coverImage = null; }
      coverUrl = ''; apiCover = ''; artworkTrack = ''; failedCovers.clear();
      cancelLoop(); offStore?.(); offStore = null;
      if (paletteTimer !== undefined) { clearInterval(paletteTimer); paletteTimer = undefined; }
      if (picture) { picture.onload = null; picture.onerror = null; picture = null; }
      window.removeEventListener('vkify:visualizer:data', onData);
      document.removeEventListener('visibilitychange', onVisibility);
      document.fonts?.removeEventListener('loadingdone', updateFont);

      widget?.destroy(); widget = null; output = '';
      canvas?.remove(); canvas = null;
      analysis = SILENT_ANALYSIS; renderer = new VisualizerRenderer(); previous = 0; lastData = 0;
      sourceUrl = ''; artworkColors = null; displayed = null;
      ctx.removeCSS(feature);
    },
  } };
}
