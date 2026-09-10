// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('music autoplay after reload', () => {
  const key = 'vkify:audio_was_playing';
  let audio: HTMLAudioElement;
  let paused: boolean;
  let readyState: number;
  let player: { _isPlaying: boolean; _impl: object; getCurrentAudio: ReturnType<typeof vi.fn>; play: ReturnType<typeof vi.fn> };
  let windowListeners: ReturnType<typeof vi.spyOn>;
  let documentListeners: ReturnType<typeof vi.spyOn>;
  let rawFetch: typeof window.fetch;
  let rawOpen: typeof XMLHttpRequest.prototype.open;

  function update(enabled: boolean, wasPlaying = true): void {
    window.dispatchEvent(new CustomEvent('vkify:player:autoplay', { detail: { enabled, wasPlaying } }));
  }

  function gesture(): void {
    const handler = documentListeners.mock.calls.find(([name]: [string]) => name === 'click')![1] as EventListener;
    handler({ isTrusted: true } as Event);
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    localStorage.clear();
    paused = true;
    readyState = HTMLMediaElement.HAVE_ENOUGH_DATA;
    audio = document.createElement('audio');
    vi.spyOn(audio, 'paused', 'get').mockImplementation(() => paused);
    vi.spyOn(audio, 'readyState', 'get').mockImplementation(() => readyState);
    player = {
      _isPlaying: true, // VK can report playing even when autoplay was blocked.
      _impl: { __private_156__currentNode: { __private_1337__element: audio } },
      getCurrentAudio: vi.fn(() => [42, 7]),
      play: vi.fn(),
    };
    vi.stubGlobal('ap', player);
    vi.stubGlobal('navigator', { userActivation: { isActive: true } });
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    windowListeners = vi.spyOn(window, 'addEventListener');
    documentListeners = vi.spyOn(document, 'addEventListener');
    rawFetch = window.fetch;
    rawOpen = XMLHttpRequest.prototype.open;
    await import('./player-control.js');
  });

  afterEach(() => {
    update(false);
    for (const [name, handler, options] of windowListeners.mock.calls) window.removeEventListener(name, handler, options);
    for (const [name, handler, options] of documentListeners.mock.calls) document.removeEventListener(name, handler, options);
    window.fetch = rawFetch;
    XMLHttpRequest.prototype.open = rawOpen;
    delete (window as Window & { __vkifyPlayerControl?: boolean }).__vkifyPlayerControl;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('resumes the detached modern player despite an optimistic VK playing flag', async () => {
    localStorage.setItem('vkify:audio_pos', JSON.stringify({ id: '42_7', t: 35 }));
    player.play.mockImplementation(() => { paused = false; audio.dispatchEvent(new Event('playing')); });
    update(true);
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(audio.currentTime).toBe(35);
    await vi.advanceTimersByTimeAsync(3000);
    expect(localStorage.getItem(key)).toBe('true');
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it('tracks a player created later and preserves playing state through teardown', () => {
    player._impl = {};
    update(true, false);
    player._impl = { __private_8__currentNode: { __private_42__element: audio } };
    paused = false;
    vi.advanceTimersByTime(500);
    audio.currentTime = 1;
    vi.advanceTimersByTime(500);
    expect(localStorage.getItem(key)).toBe('true');
    window.dispatchEvent(new Event('beforeunload'));
    paused = true;
    audio.dispatchEvent(new Event('pause'));
    expect(localStorage.getItem(key)).toBe('true');
  });

  it('records a real pause and detaches listeners from the previous track', () => {
    paused = false;
    update(true, false);
    audio.dispatchEvent(new Event('playing'));
    const replacement = document.createElement('audio');
    const replacementPaused = vi.spyOn(replacement, 'paused', 'get').mockReturnValue(false);
    player._impl = { currentNode: { element: replacement } };
    vi.advanceTimersByTime(500);
    audio.dispatchEvent(new Event('pause'));
    expect(localStorage.getItem(key)).toBe('true');
    replacementPaused.mockReturnValue(true);
    replacement.dispatchEvent(new Event('pause'));
    expect(localStorage.getItem(key)).toBe('false');
  });

  it('retains gesture fallback after rejected playback and succeeds on a later gesture', async () => {
    player.play.mockRejectedValue(new DOMException('blocked', 'NotAllowedError'));
    update(true);
    await vi.advanceTimersByTimeAsync(2500);
    gesture();
    await vi.advanceTimersByTimeAsync(600);
    expect(localStorage.getItem(key)).not.toBe('true');
    player.play.mockImplementation(() => { paused = false; audio.dispatchEvent(new Event('playing')); });
    gesture();
    await vi.advanceTimersByTimeAsync(600);
    expect(localStorage.getItem(key)).toBe('true');
  });

  it('cancels retries and gestures when disabled', async () => {
    update(true);
    expect(player.play).toHaveBeenCalledTimes(1);
    update(false);
    await vi.advanceTimersByTimeAsync(5000);
    document.dispatchEvent(new MouseEvent('click'));
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('does not start music that was paused before reload', async () => {
    update(true, false);
    await vi.advanceTimersByTimeAsync(15000);
    expect(player.play).not.toHaveBeenCalled();
  });

  it('waits for track restoration without consuming an early gesture', async () => {
    player.getCurrentAudio.mockReturnValue(null);
    update(true);
    gesture();
    expect(player.play).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(12500);
    expect(player.play).not.toHaveBeenCalled();
    player.getCurrentAudio.mockReturnValue([42, 7]);
    player.play.mockImplementation(() => { paused = false; audio.dispatchEvent(new Event('playing')); });
    gesture();
    await vi.advanceTimersByTimeAsync(600);
    expect(localStorage.getItem(key)).toBe('true');
  });

  it('starts the actual media when ap.play only changes the VK UI', async () => {
    audio.src = 'https://example.com/music.mp3';
    const nativePlay = vi.spyOn(audio, 'play').mockImplementation(async () => { paused = false; });
    update(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(nativePlay).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(key)).toBe('true');
    await vi.advanceTimersByTimeAsync(3000);
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(nativePlay).toHaveBeenCalledTimes(1);
  });

  it('does not declare success on play or paused=false while buffering', async () => {
    audio.src = 'https://example.com/music.mp3';
    readyState = HTMLMediaElement.HAVE_METADATA;
    let finish!: () => void;
    const nativePlay = vi.spyOn(audio, 'play').mockImplementation(() => {
      paused = false;
      audio.dispatchEvent(new Event('play'));
      return new Promise<void>((resolve) => { finish = resolve; });
    });
    update(true);
    await vi.advanceTimersByTimeAsync(3000);
    expect(localStorage.getItem(key)).not.toBe('true');
    expect(nativePlay).toHaveBeenCalledTimes(1);
    expect(player.play).toHaveBeenCalledTimes(1);
    readyState = HTMLMediaElement.HAVE_ENOUGH_DATA;
    audio.dispatchEvent(new Event('playing'));
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(localStorage.getItem(key)).toBe('true');
  });

  it('retries native playback inside the gesture after a policy rejection', async () => {
    audio.src = 'https://example.com/music.mp3';
    const nativePlay = vi.spyOn(audio, 'play').mockRejectedValue(new DOMException('blocked', 'NotAllowedError'));
    update(true);
    await vi.advanceTimersByTimeAsync(3000);
    expect(nativePlay).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(key)).not.toBe('true');
    nativePlay.mockImplementation(async () => { paused = false; });
    gesture();
    expect(nativePlay).toHaveBeenCalledTimes(2); // synchronous, before activation expires
    await vi.advanceTimersByTimeAsync(0);
    expect(localStorage.getItem(key)).toBe('true');
    expect(documentListeners.mock.calls.find(([name]: [string]) => name === 'pointerdown')).toBeUndefined();
    expect(documentListeners.mock.calls.find(([name]: [string]) => name === 'click')![2]).toBeUndefined();
  });

  it('waits for a source instead of playing unrelated page audio', async () => {
    const unrelated = document.createElement('audio');
    document.body.append(unrelated);
    const unrelatedPlay = vi.spyOn(unrelated, 'play');
    const nativePlay = vi.spyOn(audio, 'play').mockImplementation(async () => { paused = false; });
    update(true);
    expect(nativePlay).not.toHaveBeenCalled();
    audio.src = 'https://example.com/music.mp3';
    audio.dispatchEvent(new Event('loadedmetadata'));
    await vi.advanceTimersByTimeAsync(0);
    expect(nativePlay).toHaveBeenCalledTimes(1);
    expect(unrelatedPlay).not.toHaveBeenCalled();
    unrelated.remove();
  });
});
