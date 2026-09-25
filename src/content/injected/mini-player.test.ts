// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installMiniPlayerBridge } from './mini-player.js';

describe('mini player bridge', () => {
  const listeners: [string, EventListener][] = [];
  const install = () => {
    const add = window.addEventListener.bind(window);
    vi.spyOn(window, 'addEventListener').mockImplementation(((name: string, fn: EventListener) => { listeners.push([name, fn]); add(name, fn); }) as typeof window.addEventListener);
    installMiniPlayerBridge();
  };
  afterEach(() => { listeners.forEach(([name, fn]) => window.removeEventListener(name, fn)); listeners.length = 0; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  it('reads detached current media and never changes unrelated video', () => {
    const audio = document.createElement('audio'), video = document.createElement('video');
    vi.spyOn(audio, 'duration', 'get').mockReturnValue(120);
    audio.currentTime = 35;
    const setVolume = vi.fn();
    vi.stubGlobal('ap', { getCurrentAudio: () => [42, -7, '', 'Track', 'Artist', 120], _impl: { __private_17__currentNode: { __private_3__element: audio } }, setVolume });
    document.body.append(video); install();
    const state = vi.fn(); window.addEventListener('vkify:mini-player:state', state);
    window.dispatchEvent(new CustomEvent('vkify:mini-player:request'));
    expect(state.mock.calls[0][0].detail).toMatchObject({ track: { id: '-7_42', title: 'Track' }, currentTime: 35, duration: 120, controllable: true });
    const action = (action: string, value: number) => window.dispatchEvent(new CustomEvent('vkify:mini-player:action', { detail: { action, value } }));
    action('seek', 999); expect(audio.currentTime).toBe(120); expect(video.currentTime).toBe(0);
    action('rate', 9); expect(audio.playbackRate).toBe(3);
    action('volume', -3); expect(setVolume).toHaveBeenCalledWith(0); expect(audio.muted).toBe(true);
    action('seek', NaN); expect(audio.currentTime).toBe(120); video.remove();
  });
  it('reports empty state when VK has no current track', () => {
    vi.stubGlobal('ap', {}); install();
    const state = vi.fn(); window.addEventListener('vkify:mini-player:state', state);
    window.dispatchEvent(new CustomEvent('vkify:mini-player:request'));
    expect(state.mock.calls[0][0].detail).toMatchObject({ track: null, playing: false, controllable: false });
  });
});
