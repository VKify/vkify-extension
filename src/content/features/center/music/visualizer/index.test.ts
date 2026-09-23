// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FeatureContext } from '@/content/core/feature-context.js';
import { dispatchPageEvent } from '@/content/utils/page-event.js';
import { createMusicVisualizerFeature, createMusicLyricsFeature } from './index.js';
import { LyricsRenderer } from '@/shared/lyrics-renderer.js';

describe('music visualizer lifecycle', () => {
  it('fetches once per track and ignores a late response after track change or teardown', async () => {
    const pending: Array<(value: unknown) => void> = [];
    const sendMessage = vi.fn(() => new Promise(resolve => pending.push(resolve)));
    vi.stubGlobal('chrome', { runtime: { sendMessage } });
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 42));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const reset = vi.spyOn(LyricsRenderer.prototype, 'reset');
    const ctx = {
      getSetting: async () => '{"mode":"lyrics"}', injectCSS: vi.fn(), removeCSS: vi.fn(),
      injectScript: () => queueMicrotask(() => dispatchPageEvent('vkify-script-ready', { name: 'equalizer' })),
      sendEvent: vi.fn(), onStorageChange: () => vi.fn(), selectors: { music: { playerCover: 'img' } },
    } as unknown as FeatureContext;
    const feature = createMusicLyricsFeature(ctx).music_lyrics;
    await feature.enable?.();
    const emit = (id: string, duration = 100) => dispatchPageEvent('vkify:visualizer:data', {
      spectrum: [], waveform: [], playing: true, sampleRate: 48000, fftSize: 1024,
      playback: { track: { id, artist: 'Artist', title: id }, currentTime: 15, duration },
    });
    emit('first', 0);
    expect(sendMessage).not.toHaveBeenCalled();
    emit('first'); emit('first'); emit('second');
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ duration: 100 }));
    expect(sendMessage).toHaveBeenCalledTimes(2);
    pending[1]({ success: true, synced: true, lines: [{ text: 'Current lyrics', startTime: 5, endTime: 100 }] });
    await vi.waitFor(() => expect(reset).toHaveBeenLastCalledWith([{ text: 'Current lyrics', startTime: 5, endTime: 100 }]));
    pending[0]({ success: true, synced: true, lines: [{ text: 'Stale lyrics', startTime: 0 }] });
    await Promise.resolve(); await Promise.resolve();
    expect(reset).toHaveBeenLastCalledWith([{ text: 'Current lyrics', startTime: 5, endTime: 100 }]);
    emit('plain');
    pending[2]({ success: true, synced: false, lyrics: 'No timestamps', lines: [] });
    await vi.waitFor(() => expect(reset).toHaveBeenLastCalledWith([]));
    emit('third');
    await feature.disable?.();
    reset.mockClear();
    pending[3]({ success: true, synced: true, lines: [{ text: 'Disabled lyrics', startTime: 0 }] });
    await Promise.resolve(); await Promise.resolve();
    expect(reset).not.toHaveBeenCalled();
    reset.mockRestore();
  });
  it('hides on pause and track end, returns on playback and respects the live setting', async () => {
    let saved = '{"hideWhenPaused":true}';
    let changed: (key: string) => void = () => {};
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 42));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const ctx = {
      getSetting: async () => saved, injectCSS: vi.fn(), removeCSS: vi.fn(),
      injectScript: () => queueMicrotask(() => dispatchPageEvent('vkify-script-ready', { name: 'equalizer' })),
      sendEvent: vi.fn(), onStorageChange: (callback: typeof changed) => { changed = callback; return vi.fn(); },
      selectors: { music: { playerCover: 'img' } },
    } as unknown as FeatureContext;
    const feature = createMusicVisualizerFeature(ctx).music_visualizer;
    await feature.enable?.();
    const canvas = document.querySelector<HTMLCanvasElement>('#vkify-music-visualizer')!;
    expect(canvas.style.visibility).toBe('hidden');
    const playback = (playing: boolean) => dispatchPageEvent('vkify:visualizer:data', { spectrum: [], waveform: [], playing, sampleRate: 48000, fftSize: 1024 });
    playback(true); expect(canvas.style.visibility).toBe('visible');
    playback(false); expect(canvas.style.visibility).toBe('hidden');
    playback(true); expect(canvas.style.visibility).toBe('visible');
    playback(false); expect(canvas.style.visibility).toBe('hidden');
    saved = '{"hideWhenPaused":false}'; changed('music_visualizer_settings');
    await Promise.resolve();
    expect(canvas.style.visibility).toBe('visible');
    await feature.disable?.();
  });
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('uses an independent wallpaper layer and removes its listeners and frame on disable', async () => {
    const wallpaper = document.createElement('div');
    wallpaper.id = 'vkify-bg-container';
    document.documentElement.append(wallpaper);
    const cancel = vi.fn();
    const removeCSS = vi.fn();
    const sendEvent = vi.fn();
    const offStore = vi.fn();
    const injectCSS = vi.fn();
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 42));
    vi.stubGlobal('cancelAnimationFrame', cancel);
    const ctx = {
      getSetting: vi.fn(async () => '{}'),
      injectCSS,
      removeCSS,
      injectScript: vi.fn(() => queueMicrotask(() => dispatchPageEvent('vkify-script-ready', { name: 'equalizer' }))),
      sendEvent,
      onStorageChange: vi.fn(() => offStore),
      selectors: { music: { playerCover: '[data-testid="AudioPlayerBlock_AudioCover"] img' } },
    } as unknown as FeatureContext;
    const feature = createMusicVisualizerFeature(ctx).music_visualizer;
    await feature.enable?.();
    const canvas = document.querySelector('#vkify-music-visualizer');
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect((canvas as HTMLCanvasElement).style.background).toBe('');
    expect(wallpaper.parentElement).toBe(document.body);
    expect(sendEvent).toHaveBeenCalledWith('vkify:visualizer:update', { enabled: true });
    await feature.disable?.();
    expect(document.querySelector('#vkify-music-visualizer')).toBeNull();
    expect(document.getElementById('vkify-bg-container')).toBe(wallpaper);
    expect(cancel).toHaveBeenCalledWith(42);
    expect(offStore).toHaveBeenCalledOnce();
    expect(removeCSS).toHaveBeenCalledWith('music_visualizer');
    expect(sendEvent).toHaveBeenCalledWith('vkify:visualizer:update', { enabled: false });
  });

  it('does not restart audio or animation when disabled while the page bridge is loading', async () => {
    vi.useFakeTimers();
    const raf = vi.fn(() => 42);
    vi.stubGlobal('requestAnimationFrame', raf);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const sendEvent = vi.fn();
    const ctx = {
      getSetting: vi.fn(async () => '{}'), injectCSS: vi.fn(), removeCSS: vi.fn(),
      injectScript: vi.fn(), sendEvent, onStorageChange: vi.fn(() => vi.fn()),
      selectors: { music: { playerCover: 'img' } },
    } as unknown as FeatureContext;
    const feature = createMusicVisualizerFeature(ctx).music_visualizer;
    const enabling = feature.enable?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(document.querySelector('#vkify-music-visualizer')).not.toBeNull();
    await feature.disable?.();
    await vi.advanceTimersByTimeAsync(3000);
    await enabling;
    expect(document.querySelector('#vkify-music-visualizer')).toBeNull();
    expect(sendEvent).not.toHaveBeenCalledWith('vkify:visualizer:update', { enabled: true });
    expect(raf).toHaveBeenCalledOnce();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(42);
    expect(vi.getTimerCount()).toBe(0);
  });
});
