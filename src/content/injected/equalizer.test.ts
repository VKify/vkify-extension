// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('equalizer user activation', () => {
  const activation = { hasBeenActive: false, isActive: false };
  const node = () => ({ connect: vi.fn(), gain: { value: 0 }, frequency: { value: 0 }, Q: { value: 0 } });
  let context: {
    state: string;
    resume: ReturnType<typeof vi.fn>;
    createGain: ReturnType<typeof vi.fn>;
    createBiquadFilter: ReturnType<typeof vi.fn>;
    createMediaElementSource: ReturnType<typeof vi.fn>;
    destination: object;
  };
  let constructor: ReturnType<typeof vi.fn>;
  let audio: HTMLAudioElement;
  let gesture: EventListener;

  function update(enabled: boolean): void {
    window.dispatchEvent(new CustomEvent('vkify:equalizer:update', { detail: { enabled, preamp: 6 } }));
  }

  function interact(): void {
    activation.hasBeenActive = true;
    activation.isActive = true;
    gesture({ isTrusted: true } as Event);
    activation.isActive = false;
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    activation.hasBeenActive = false;
    activation.isActive = false;
    vi.stubGlobal('navigator', { userActivation: activation });
    context = {
      state: 'suspended',
      resume: vi.fn(async () => { context.state = 'running'; }),
      createGain: vi.fn(node),
      createBiquadFilter: vi.fn(node),
      createMediaElementSource: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
      destination: {},
    };
    constructor = vi.fn(function () { return context; });
    vi.stubGlobal('AudioContext', constructor);
    audio = document.createElement('audio');
    document.body.append(audio);
    const listeners = vi.spyOn(document, 'addEventListener');
    await import('./equalizer.js');
    update(true);
    gesture = listeners.mock.calls.find(([name]) => name === 'click')![1] as EventListener;
  });

  afterEach(() => {
    window.dispatchEvent(new MessageEvent('message', { source: window, data: { type: 'VKIFY_DESTROY' } }));
    delete (window as Window & { __vkifyEqualizer?: boolean }).__vkifyEqualizer;
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('does not create or resume audio on settings restore, media events, timers or synthetic clicks', () => {
    for (const name of ['play', 'playing', 'timeupdate']) audio.dispatchEvent(new Event(name));
    vi.advanceTimersByTime(4000);
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(constructor).not.toHaveBeenCalled();
    expect(context.resume).not.toHaveBeenCalled();
    expect(context.createMediaElementSource).not.toHaveBeenCalled();
  });

  it('waits for resume to complete before wiring, then keeps a single source', async () => {
    let finish!: () => void;
    context.resume.mockImplementation(() => new Promise<void>((resolve) => {
      finish = () => { context.state = 'running'; resolve(); };
    }));
    interact();
    vi.advanceTimersByTime(2400);
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(context.createMediaElementSource).not.toHaveBeenCalled();
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(context.createMediaElementSource).toHaveBeenCalledWith(audio);
    expect(context.createGain.mock.results[0].value.gain.value).toBeCloseTo(10 ** (6 / 20));
    audio.dispatchEvent(new Event('timeupdate'));
    vi.advanceTimersByTime(2400);
    expect(context.createMediaElementSource).toHaveBeenCalledTimes(1);
    expect(context.resume).toHaveBeenCalledTimes(1);
    update(false);
    expect(context.createGain.mock.results[0].value.gain.value).toBe(1);
  });

  it('honors interaction that happened before script initialization', async () => {
    activation.hasBeenActive = true;
    await vi.advanceTimersByTimeAsync(800);
    expect(constructor).toHaveBeenCalledTimes(1);
    expect(context.createMediaElementSource).toHaveBeenCalledTimes(1);
  });

  it('handles resume rejection without timer retries and retries on a later gesture', async () => {
    context.resume.mockRejectedValueOnce(new Error('blocked'));
    interact();
    await vi.advanceTimersByTimeAsync(2400);
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(context.createMediaElementSource).not.toHaveBeenCalled();
    interact();
    await vi.advanceTimersByTimeAsync(0);
    expect(context.resume).toHaveBeenCalledTimes(2);
    expect(context.createMediaElementSource).toHaveBeenCalledTimes(1);
  });

  it('does not initialize when disabled before the first gesture', () => {
    update(false);
    activation.hasBeenActive = true;
    document.dispatchEvent(new MouseEvent('click'));
    vi.advanceTimersByTime(1600);
    expect(constructor).not.toHaveBeenCalled();
  });
});
