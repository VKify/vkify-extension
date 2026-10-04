// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { produceTrack, partsToBytes } from './pipeline.js';
import { requestTrackInfo, requestUrl } from './ipc.js';
import type { TrackEntry } from './types.js';

vi.mock('./ipc.js', () => ({ requestTrackInfo: vi.fn(), requestUrl: vi.fn() }));
vi.mock('./encoder.js', () => ({
  fetchAndEncode: vi.fn(async () => [new Uint8Array([0xff, 0xfb, 0x90])]),
  fetchOriginal: vi.fn(async () => [new Uint8Array([1, 2, 3])]),
}));
vi.mock('../../_shared/index.js', () => ({ sanitizeFilename: (s: string) => s }));
vi.mock('@/content/i18n/index.js', () => ({ t: (s: string) => s }));

const sendMessage = vi.fn(async (message: { type: string }) => message.type === 'AUDIO_FETCH_COVER'
  ? { success: true, dataB64: btoa('cover bytes'), mime: 'image/jpeg' }
  : { success: true, lyrics: 'Текст песни' });
const settings = { audio_download_id3: true, audio_download_lyrics: true };
const entry = (): TrackEntry => ({
  trackId: '7_42', title: 'Song', performer: 'Artist', coverUrl: '', audioData: [42, 7],
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('chrome', { runtime: { sendMessage }, storage: { local: { get: vi.fn(async () => settings) } } });
  vi.mocked(requestTrackInfo).mockResolvedValue({
    trackId: '7_42', title: 'Song&#39;s title', performer: 'A &amp; B', coverUrl: 'https://sun1.userapi.com/cover.jpg',
    duration: 200, url: 'https://audio.vk.com/song.m3u8', audioData: [42, 7],
  });
  vi.mocked(requestUrl).mockResolvedValue('https://audio.vk.com/fallback.m3u8');
});
afterEach(() => vi.unstubAllGlobals());

it('embeds artwork and lyrics from full metadata when downloading an album track', async () => {
  const track = entry();
  track.audioData[13] = '0123456789abcdef/hash';
  const result = await produceTrack(track, vi.fn());
  expect(requestTrackInfo).toHaveBeenCalledWith('7_42', '0123456789abcdef');
  expect(requestUrl).not.toHaveBeenCalled();
  expect(sendMessage).toHaveBeenCalledWith({ type: 'AUDIO_FETCH_COVER', url: 'https://sun1.userapi.com/cover.jpg' });
  expect(sendMessage).toHaveBeenCalledWith({ type: 'AUDIO_FETCH_LYRICS', artist: 'A & B', title: "Song's title", duration: 200 });
  const bytes = partsToBytes(result.parts);
  const raw = new TextDecoder('latin1').decode(bytes);
  expect(raw).toContain('APIC');
  expect(raw).toContain('USLT');
  expect(raw).toContain('cover bytes');
  expect(new TextDecoder('utf-16le').decode(new Uint8Array(result.parts[0] as Uint8Array))).toContain('Текст песни');
  expect(Array.from(bytes.slice(-3))).toEqual([0xff, 0xfb, 0x90]);
});

it('keeps the album artwork when reload_audios omits it', async () => {
  vi.mocked(requestTrackInfo).mockResolvedValue({ trackId: '7_42', title: 'Song', performer: 'Artist', coverUrl: '', url: 'https://audio.vk.com/song.m3u8' });
  await produceTrack({ ...entry(), coverUrl: 'https://sun1.userapi.com/album.jpg' }, vi.fn());
  expect(sendMessage).toHaveBeenCalledWith({ type: 'AUDIO_FETCH_COVER', url: 'https://sun1.userapi.com/album.jpg' });
});

it('reloads metadata even with a cached audio URL if artwork is missing', async () => {
  await produceTrack({ ...entry(), cachedUrl: 'https://audio.vk.com/song.m3u8' }, vi.fn());
  expect(requestTrackInfo).toHaveBeenCalledOnce();
  expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'AUDIO_FETCH_COVER' }));
});

it('downloads the same large vkuserphoto artwork selected by the mini player', async () => {
  const tuple = [42, 7, '', 'Song', 'Artist', 200];
  tuple[14] = ',https://sun9-1.vkuserphoto.ru/large.jpg';
  vi.mocked(requestTrackInfo).mockResolvedValue({
    trackId: '7_42', title: 'Song', performer: 'Artist', coverUrl: '',
    url: 'https://audio.vk.com/song.m3u8', audioData: tuple,
  });
  const result = await produceTrack(entry(), vi.fn());
  expect(sendMessage).toHaveBeenCalledWith({ type: 'AUDIO_FETCH_COVER', url: 'https://sun9-1.vkuserphoto.ru/large.jpg' });
  expect(new TextDecoder('latin1').decode(partsToBytes(result.parts))).toContain('APIC');
});

it('falls back to the URL decoder when full metadata is unavailable', async () => {
  vi.mocked(requestTrackInfo).mockResolvedValue(null);
  const track = { ...entry(), audioData: [42, 7, '', 'Song', 'Artist', 180] };
  const result = await produceTrack(track, vi.fn());
  expect(result.ext).toBe('mp3');
  expect(requestUrl).toHaveBeenCalledWith(track);
  expect(sendMessage).toHaveBeenCalledWith({ type: 'AUDIO_FETCH_LYRICS', artist: 'Artist', title: 'Song', duration: 180 });
});

it('omits optional metadata requests when both settings are disabled', async () => {
  vi.stubGlobal('chrome', { runtime: { sendMessage }, storage: { local: { get: vi.fn(async () => ({ audio_download_id3: false, audio_download_lyrics: false })) } } });
  const result = await produceTrack(entry(), vi.fn());
  expect(sendMessage).not.toHaveBeenCalled();
  expect(Array.from(partsToBytes(result.parts))).toEqual([0xff, 0xfb, 0x90]);
});

it('stops before fetching audio when cancelled during metadata reload', async () => {
  const ctrl = new AbortController();
  vi.mocked(requestTrackInfo).mockImplementation(async () => { ctrl.abort(); return null; });
  await expect(produceTrack(entry(), vi.fn(), ctrl.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(requestUrl).not.toHaveBeenCalled();
  expect(sendMessage).not.toHaveBeenCalled();
});
