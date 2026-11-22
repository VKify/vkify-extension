// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ info: vi.fn(), produce: vi.fn(), download: vi.fn() }));
vi.mock('./ipc.js', () => ({ requestTrackInfo: mocks.info }));
vi.mock('./pipeline.js', () => ({ produceTrack: mocks.produce, triggerDownload: mocks.download }));
vi.mock('@/content/i18n/index.js', () => ({ t: (key: string) => key }));
vi.mock('../../_shared/index.js', () => ({
  buildDownloadIconSvg: () => document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
  hideBrandTooltip: vi.fn(), attachBrandTooltip: vi.fn(), downloadCenterJobStart: vi.fn(),
  downloadCenterJobUpdate: vi.fn(), downloadCenterJobDone: vi.fn(), downloadCenterJobError: vi.fn(),
}));
import { injectPlayerButton } from './controls.js';

afterEach(() => { document.body.replaceChildren(); vi.clearAllMocks(); vi.clearAllTimers(); vi.useRealTimers(); });

it('downloads from each current player and resolves the new track after switching', async () => {
  vi.useFakeTimers();
  const player = (id: string) => `<section><a href="/audio${id}">Track</a><a href="/artist/1">Artist</a><div role="group"><button><svg class="vkuiIcon--music_note_wave_outline_24"></svg></button></div></section>`;
  document.body.innerHTML = player('-1_2') + player('3_4');
  mocks.info.mockImplementation(async (trackId: string) => ({ trackId, title: 'Track', performer: 'Artist', url: 'https://example.com/track.mp3' }));
  mocks.produce.mockResolvedValue({ filename: 'Artist - Track', parts: [new Uint8Array([1, 2])], ext: 'mp3', mime: 'audio/mpeg' });
  injectPlayerButton();
  const buttons = document.querySelectorAll<HTMLButtonElement>('.vkify-dl-btn');
  expect(buttons).toHaveLength(2);
  buttons[1].click();
  await vi.waitFor(() => expect(mocks.download).toHaveBeenCalledOnce());
  expect(mocks.info).toHaveBeenLastCalledWith('3_4', undefined);
  expect(buttons[1].classList.contains('is-done')).toBe(true);
  document.querySelector('a[href="/audio-1_2"]')!.setAttribute('href', '/audio-5_6');
  buttons[0].click();
  await vi.waitFor(() => expect(mocks.download).toHaveBeenCalledTimes(2));
  expect(mocks.info).toHaveBeenLastCalledWith('-5_6', undefined);
  expect(mocks.produce).toHaveBeenLastCalledWith(expect.objectContaining({ trackId: '-5_6', cachedUrl: 'https://example.com/track.mp3' }), expect.any(Function));
  expect(buttons[0].classList.contains('is-error')).toBe(false);
});
