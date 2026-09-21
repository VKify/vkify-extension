import type { FeatureContext } from '@/content/core/feature-context.js';
import type { FeatureMap } from '@/types/index.js';
import { InjectedScript } from '@/content/core/injected-scripts.js';
import { waitForInjectedScript } from '@/content/utils/injected-ready.js';
import { parseVisualizerSettings } from '@/shared/music-visualizer.js';
import { SILENT_ANALYSIS, VisualizerRenderer, type VisualizerAnalysis } from '@/shared/visualizer-renderer.js';
import { BACKGROUND_LAYERS, BACKGROUND_LAYERS_CSS, attachWallpaperToBody } from '../background/layers.js';

export function createMusicVisualizerFeature(ctx: FeatureContext): FeatureMap {
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
    if (canvas) canvas.style.visibility = settings.hideWhenPaused && !(analysis.playing && performance.now() - lastData < 1500) ? 'hidden' : 'visible';
  };

  const onData = (event: Event): void => {
    const data = (event as CustomEvent<VisualizerAnalysis>).detail;
    if (!data || !Array.isArray(data.spectrum) || !Array.isArray(data.waveform) || data.spectrum.length > 4096 || data.waveform.length > 8192) return;
    analysis = data;
    lastData = performance.now();
    updateVisibility();
  };

  const updatePalette = (): void => {
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
    if (!canvas || document.hidden) return;
    const playing = analysis.playing && now - lastData < 1500;
    updateVisibility();
    const limit = settings.fps === '30' || (settings.fps === 'auto' && (navigator.hardwareConcurrency ?? 8) <= 4) ? 30 : 60;
    if (previous && now - previous < 1000 / limit - .5) { frame = requestAnimationFrame(tick); return; }
    const dt = previous ? Math.min((now - previous) / 1000, .1) : 1 / limit; previous = now;
    const dpr = Math.min(devicePixelRatio || 1, settings.quality === 'low' ? 1 : settings.quality === 'high' ? 2 : 1.5);
    const width = innerWidth, height = innerHeight;
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
      renderer.draw(g, width, height, settings, colors, motion.matches);
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
    const saved = await ctx.getSetting('music_visualizer_settings');
    if (version !== generation || request !== revision) return;
    settings = parseVisualizerSettings(saved);
    updateVisibility();
    if (canvas) canvas.style.filter = settings.blur ? `blur(${settings.blur}px)` : '';
    updatePalette();
  };
  return { music_visualizer: {
    enable: async () => {
      if (canvas || pending) return;
      pending = true;
      const version = ++generation;
      await refresh(version);
      if (version !== generation) return;
      canvas = document.createElement('canvas'); canvas.id = 'vkify-music-visualizer';
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;';
      canvas.style.filter = settings.blur ? `blur(${settings.blur}px)` : '';
      updateVisibility();
      attachWallpaperToBody();
      ctx.injectCSS('music_visualizer', `${BACKGROUND_LAYERS_CSS}
        #vkify-music-visualizer { z-index:${BACKGROUND_LAYERS.visualizer}; pointer-events:none !important; }
      `);
      document.body.prepend(canvas);
      window.addEventListener('vkify:visualizer:data', onData);
      document.addEventListener('visibilitychange', onVisibility);
      // Subscribe before loading: the ready signal can arrive immediately from cache.
      const ready = waitForInjectedScript(InjectedScript.EQUALIZER);
      ctx.injectScript(InjectedScript.EQUALIZER);
      await ready;
      if (version !== generation) return;
      pending = false;
      ctx.sendEvent('vkify:visualizer:update', { enabled: true });
      offStore = ctx.onStorageChange((key) => { if (key === 'music_visualizer_settings') void refresh(version); });
      paletteTimer = window.setInterval(updatePalette, 1500); updatePalette();
      if (!document.hidden) frame = requestAnimationFrame(tick);
    },
    disable: () => {
      generation++; revision++; pending = false;
      ctx.sendEvent('vkify:visualizer:update', { enabled: false });
      cancelLoop(); offStore?.(); offStore = null;
      if (paletteTimer !== undefined) { clearInterval(paletteTimer); paletteTimer = undefined; }
      if (picture) { picture.onload = null; picture.onerror = null; picture = null; }
      window.removeEventListener('vkify:visualizer:data', onData);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas?.remove(); canvas = null;
      analysis = SILENT_ANALYSIS; renderer = new VisualizerRenderer(); previous = 0; lastData = 0;
      sourceUrl = ''; artworkColors = null; displayed = null;
      ctx.removeCSS('music_visualizer');
    },
  } };
}
