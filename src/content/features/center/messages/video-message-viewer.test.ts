// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { openVideoMessageViewer, videoMessageViewerFeature } from './video-message-viewer.js';
import type { ScopedFeatureContext } from '@/content/core/features/scoped-context.js';

const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock('@/content/core/services/index.js', () => ({ SERVICES: { vkApi: 'api' }, getService: () => ({ call }) }));
vi.mock('./dialog-export/peer.js', () => ({ detectConversationContext: () => ({ peerId: 42, groupId: null }) }));
let close: (() => void) | undefined;
beforeEach(() => {
  document.body.innerHTML = ''; document.documentElement.style.overflow = 'auto'; call.mockReset();
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) { this.open = true; });
});
afterEach(() => { close?.(); close = undefined; vi.restoreAllMocks(); });
function setup() {
  const source = document.createElement('video'); source.src = 'https://cdn.test/video.mp4'; source.currentTime = 12;
  Object.defineProperty(source, 'paused', { configurable: true, value: false });
  const trigger = document.createElement('button'); document.body.append(source, trigger);
  return { source, trigger };
}
const click = (label: string) => {
  const button = [...document.querySelectorAll<HTMLButtonElement>('dialog button')].find(el => el.textContent === label);
  expect(button).toBeTruthy(); button!.click();
};

it('opens a separate seekable player, transfers the time and restores the source on close', async () => {
  const { source, trigger } = setup();
  close = openVideoMessageViewer(source, trigger, async () => source.src);
  await vi.waitFor(() => expect(document.querySelector('dialog video')?.getAttribute('src')).toBe(source.src));
  const video = document.querySelector<HTMLVideoElement>('dialog video')!;
  expect(video.controls).toBe(true); expect(source.pause).toHaveBeenCalled();
  Object.defineProperty(video, 'duration', { value: 60 });
  Object.defineProperty(video, 'readyState', { value: 1 });
  video.dispatchEvent(new Event('loadedmetadata'));
  expect(video.currentTime).toBe(12);
  click('+5 с'); expect(video.currentTime).toBe(17);
  click('−5 с'); expect(video.currentTime).toBe(12);
  video.currentTime = 35;
  close();
  expect(source.currentTime).toBe(35); expect(source.play).toHaveBeenCalled();
  expect(document.querySelector('dialog')).toBeNull();
  expect(document.documentElement.style.overflow).toBe('auto');
  expect(document.activeElement).toBe(trigger);
});

it('ignores a late source response after the viewer is closed', async () => {
  const { source, trigger } = setup(); let resolve!: (url: string) => void;
  close = openVideoMessageViewer(source, trigger, () => new Promise(done => { resolve = done; }));
  const video = document.querySelector<HTMLVideoElement>('dialog video')!;
  close(); resolve('https://cdn.test/late.mp4'); await Promise.resolve();
  expect(video.getAttribute('src')).toBeNull();
});

it('does not resume or seek a video recycled by VK for another message', async () => {
  const { source, trigger } = setup(); close = openVideoMessageViewer(source, trigger, async () => source.src);
  source.src = 'https://cdn.test/other.mp4'; source.currentTime = 0;
  vi.mocked(source.play).mockClear(); close();
  expect(source.play).not.toHaveBeenCalled(); expect(source.currentTime).toBe(0);
});

it('handles Escape cancellation and rejects unsafe sources', async () => {
  const { source, trigger } = setup(); close = openVideoMessageViewer(source, trigger, async () => 'javascript:alert(1)');
  await vi.waitFor(() => expect(document.querySelector('[role=status]')?.textContent).toContain('Не удалось'));
  document.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true }));
  expect(document.querySelector('dialog')).toBeNull();
});

it('adds one expand button per circle and cleans up on disable', async () => {
  document.body.innerHTML = '<article data-cmid="1" class="ConvoHistory__messageBlock"><div class="AttachVideoMessage"><video src="https://cdn.test/video.mp4"></video></div></article>';
  const ctx = { addCSS: vi.fn(), selectors: { messages: {
    videoMessageDownloadAnchors: '.AttachVideoMessage, video', videoMessage: '.AttachVideoMessage', block: '.ConvoHistory__messageBlock',
  } }, registerMutationObserver: (_selector: unknown, inject: (el: Element) => void) => {
    inject(document.querySelector('.AttachVideoMessage')!); inject(document.querySelector('video')!);
  } } as unknown as ScopedFeatureContext;
  await videoMessageViewerFeature.init!(ctx);
  expect(document.querySelectorAll('.vkify-circle-expand')).toHaveLength(1);
  (document.querySelector('.vkify-circle-expand') as HTMLButtonElement).click();
  expect(document.querySelector('dialog')).not.toBeNull();
  await videoMessageViewerFeature.destroy!(ctx);
  expect(document.querySelector('dialog')).toBeNull(); expect(document.querySelector('.vkify-circle-expand')).toBeNull();
});
