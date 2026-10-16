// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  start: (_hls: FakeHls) => {},
  destroy: vi.fn(),
  config: {} as Record<string, unknown>,
}));

type Frag = { cc: number; sn: number };
type EventData = {
  frag?: Frag; type?: string; data?: Uint8Array;
  details?: unknown; fatal?: boolean;
};
interface FakeHls {
  emit(name: string, data?: EventData): void;
}

vi.mock('hls.js/light', () => ({ default: class implements FakeHls {
  static isSupported() { return true; }
  static Events = Object.fromEntries([
    'LEVEL_LOADED', 'BUFFER_APPENDING', 'FRAG_LOADING', 'FRAG_PARSED', 'BUFFER_EOS', 'ERROR',
  ].map(name => [name, name]));
  handlers = new Map<string, (event: string, data: EventData) => void>();
  constructor(config: Record<string, unknown>) { mock.config = config; }
  on(name: string, fn: (event: string, data: EventData) => void) { this.handlers.set(name, fn); }
  emit(name: string, data: EventData = {}) { this.handlers.get(name)?.(name, data); }
  loadSource() {}
  attachMedia() { mock.start(this); }
  destroy() { mock.destroy(); }
} }));
vi.mock('@breezystack/lamejs', () => ({ Mp3Encoder: vi.fn() }));
vi.mock('@/content/i18n/index.js', () => ({ t: (key: string) => key }));

import { fetchOriginal, fetchAndEncode } from './encoder-impl.js';

const fragments = Array.from({ length: 70 }, (_, sn) => ({ cc: 0, sn }));
function level(hls: FakeHls) {
  hls.emit('LEVEL_LOADED', { details: { fragments } });
}
function append(hls: FakeHls, frag: Frag, bytes = [frag.sn], type = 'audio') {
  hls.emit('BUFFER_APPENDING', { frag, type, data: new Uint8Array(bytes) });
}
function complete(hls: FakeHls, frag: Frag, type = 'audio') {
  hls.emit('FRAG_LOADING', { frag });
  append(hls, frag, [frag.sn], type);
  hls.emit('FRAG_PARSED', { frag });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  expect(document.querySelector('audio')).toBeNull();
});

it('keeps 70 segments in playlist order despite retries and out-of-order completion', async () => {
  const progress = vi.fn();
  mock.start = hls => {
    level(hls);
    for (const frag of [...fragments].reverse()) complete(hls, frag);
    for (const frag of fragments.slice(50, 65)) {
      hls.emit('ERROR', { type: 'mediaError', details: 'bufferFullError', fatal: false });
      complete(hls, frag);
    }
    hls.emit('BUFFER_EOS');
  };
  const chunks = await fetchOriginal('test.m3u8', progress) as Uint8Array[];
  expect(chunks.map(chunk => chunk[0])).toEqual(fragments.map(frag => frag.sn));
  expect(progress).toHaveBeenCalledTimes(72); // connecting, level, 70 unique segments
  expect(mock.config.maxMaxBufferLength).toBe(60);
  expect(mock.config.progressive).toBe(false);
  expect(mock.destroy).toHaveBeenCalledOnce();
});

it('discards an unfinished attempt and preserves init plus media chunks of a completed fragment', async () => {
  mock.start = hls => {
    level(hls);
    append(hls, fragments[0], [255]);
    hls.emit('FRAG_LOADING', { frag: fragments[0] });
    append(hls, fragments[0], [100]); // init segment
    append(hls, fragments[0]);
    hls.emit('FRAG_PARSED', { frag: fragments[0] });
    for (const frag of fragments.slice(1)) complete(hls, frag);
    hls.emit('BUFFER_EOS');
  };
  const chunks = await fetchOriginal('test.m3u8', () => {}) as Uint8Array[];
  expect(chunks.map(chunk => chunk[0])).toEqual([100, ...fragments.map(frag => frag.sn)]);
});

it('retains the multiplexed fallback', async () => {
  mock.start = hls => {
    level(hls);
    for (const frag of fragments) complete(hls, frag, 'audiovideo');
    hls.emit('BUFFER_EOS');
  };
  expect(await fetchOriginal('test.m3u8', () => {})).toHaveLength(70);
});

it('preserves the MP4 init segment across an unfinished first attempt', async () => {
  const init = [0, 0, 0, 8, 102, 116, 121, 112]; // ftyp
  mock.start = hls => {
    level(hls);
    append(hls, fragments[0], init);
    append(hls, fragments[0], [255]);
    for (const frag of fragments) complete(hls, frag);
    hls.emit('BUFFER_EOS');
  };
  const chunks = await fetchOriginal('test.m3u8', () => {}) as Uint8Array[];
  expect([...chunks[0]]).toEqual(init);
  expect(chunks.slice(1).map(chunk => chunk[0])).toEqual(fragments.map(frag => frag.sn));
});

it('rejects missing segments even when the player signals end of stream', async () => {
  mock.start = hls => {
    level(hls);
    complete(hls, fragments[0]);
    hls.emit('BUFFER_EOS');
  };
  await expect(fetchOriginal('test.m3u8', () => {})).rejects.toThrow('music.download_incomplete');
});

it('rejects a fatal error after partial data for both output formats', async () => {
  const audioContext = vi.fn();
  vi.stubGlobal('AudioContext', audioContext);
  mock.start = hls => {
    level(hls);
    complete(hls, fragments[0]);
    hls.emit('ERROR', { type: 'networkError', details: 'fragLoadError', fatal: true });
  };
  await expect(fetchOriginal('test.m3u8', () => {})).rejects.toThrow('music.no_audio_data_err');
  await expect(fetchAndEncode('test.m3u8', 320, () => {})).rejects.toThrow('music.no_audio_data_err');
  expect(audioContext).not.toHaveBeenCalled();
});

it('rejects timeout and clears the timer', async () => {
  vi.useFakeTimers();
  mock.start = hls => { level(hls); complete(hls, fragments[0]); };
  const promise = fetchOriginal('test.m3u8', () => {});
  const assertion = expect(promise).rejects.toThrow('music.download_timeout');
  await vi.advanceTimersByTimeAsync(300_000);
  await assertion;
  expect(vi.getTimerCount()).toBe(0);
});

it('cleans up the abort listener and timer on cancellation', async () => {
  vi.useFakeTimers();
  mock.start = hls => { level(hls); complete(hls, fragments[0]); };
  const controller = new AbortController();
  const remove = vi.spyOn(controller.signal, 'removeEventListener');
  const promise = fetchOriginal('test.m3u8', () => {}, controller.signal);
  controller.abort();
  await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  expect(vi.getTimerCount()).toBe(0);
});
