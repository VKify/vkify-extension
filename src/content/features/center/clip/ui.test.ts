// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ call: vi.fn(), download: vi.fn() }));
vi.mock('@/content/core/services/index.js', () => ({ SERVICES: { vkApi: 'vkApi' }, getService: () => ({ call: mocks.call }) }));
vi.mock('@/content/i18n/index.js', () => ({ t: (key: string) => key }));
vi.mock('../_shared/download-request.js', () => ({ requestDownload: mocks.download }));
import { clearClipCache, findActiveClipId } from './api.js';
import { injectControlButton, removeButton } from './ui.js';

function fixture() {
  document.body.innerHTML = `<div data-clip-id="-1_2" data-active="false"></div><div data-clip-id="-221396877_456246804" data-active="true"></div>
    <div class="ClipsFeedControlsLayout__root--current"><div style="--rounded-group-gap:16px"><div class="native-wrapper"><div class="native-inner"><button class="native-button"><svg class="vkuiIcon--like_outline_28"></svg></button></div></div></div></div>`;
}
afterEach(() => { removeButton(); clearClipCache(); document.body.innerHTML = ''; vi.clearAllMocks(); });

it('places a single control beside native actions and downloads the chosen quality for the active clip', async () => {
  fixture();
  mocks.call.mockResolvedValue({ items: [{ title: 'Clip', files: { mp4_720: 'https://example.com/clip.mp4' } }] });
  injectControlButton(); injectControlButton();
  const btn = document.querySelector<HTMLButtonElement>('#vkify-clip-dl-btn')!;
  expect(document.querySelectorAll('#vkify-clip-dl-btn')).toHaveLength(1);
  expect(btn.closest('[data-vkify-clip-download]')?.nextElementSibling?.className).toBe('native-wrapper');
  expect(btn.className).toBe('native-button');
  expect(btn.style.width).toBe('52px');
  btn.click();
  await vi.waitFor(() => expect(document.querySelector('#vkify-clip-dl-dd')).not.toBeNull());
  expect(mocks.call).toHaveBeenCalledWith('video.get', { videos: '-221396877_456246804', extended: 0 });
  (document.querySelector('#vkify-clip-dl-dd [role="button"]') as HTMLElement).click();
  expect(mocks.download).toHaveBeenCalledWith('https://example.com/clip.mp4', 'Clip_720p.mp4');
  expect(document.querySelector('#vkify-clip-dl-dd')).toBeNull();
  removeButton();
  expect(document.querySelector('[data-vkify-clip-download]')).toBeNull();
  expect(document.querySelector('.native-wrapper')).not.toBeNull();
});

it('ignores a late quality response after the active clip changes', async () => {
  fixture();
  let finish!: (value: unknown) => void;
  mocks.call.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  injectControlButton();
  const btn = document.querySelector<HTMLButtonElement>('#vkify-clip-dl-btn')!;
  btn.click();
  expect(btn.disabled).toBe(true);
  document.querySelector('[data-active="true"]')!.setAttribute('data-active', 'false');
  document.querySelector('[data-clip-id="-1_2"]')!.setAttribute('data-active', 'true');
  expect(findActiveClipId()).toEqual({ ownerId: -1, videoId: 2 });
  finish({ items: [{ files: { mp4_720: 'https://example.com/old.mp4' } }] });
  await vi.waitFor(() => expect(btn.disabled).toBe(false));
  expect(document.querySelector('#vkify-clip-dl-dd')).toBeNull();
});
