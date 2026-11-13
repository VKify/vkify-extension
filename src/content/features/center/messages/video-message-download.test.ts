// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { registerVideoMessageDownloadFeature, videoMessageFiles } from './video-message-download.js';
import type { VKMessage } from './dialog-export/types.js';
import type { FeatureManager } from '@/content/core/feature-manager.js';
import type { FeatureDefinition } from '@/content/core/features/feature-definition.js';
import type { ScopedFeatureContext } from '@/content/core/features/scoped-context.js';
import { SELECTORS } from '@/content/selectors/index.js';

const { call, download, context } = vi.hoisted(() => ({
  call: vi.fn(), download: vi.fn(), context: { peerId: 42, groupId: null as number | null },
}));
vi.mock('@/content/core/services/index.js', () => ({ SERVICES: { vkApi: 'vkApi' }, getService: () => ({ call }) }));
vi.mock('../_shared/download-request.js', () => ({ requestDownload: download }));
vi.mock('./dialog-export/peer.js', () => ({ detectConversationContext: () => ({ ...context }) }));

const circle = (files?: Record<string, string>) => ({ type: 'video_message', video_message: { id: 1, owner_id: 42, files } });
const message = (attachments: VKMessage['attachments']): VKMessage => ({
  id: 1, conversation_message_id: 92, peer_id: 42, from_id: 42, date: 0, text: '', attachments,
});
const markup = '<div class="AttachVideoMessage" style="position:relative"><div class="AttachVideoMessage__preview"><video class="AttachVideoMessage__video"></video></div><button class="AttachVideoMessage__transcriptionToggle">Aa</button></div>';
let definition: FeatureDefinition;
let inject: (element: Element) => void;
const off = vi.fn();

beforeEach(() => {
  call.mockReset(); download.mockReset(); off.mockReset(); context.peerId = 42; context.groupId = null;
  vi.stubGlobal('alert', vi.fn());
  registerVideoMessageDownloadFeature({
    registerDefinition: (value: FeatureDefinition) => { definition = value; },
    observeMatches: (_id: string, _selector: string, callback: typeof inject) => { inject = callback; return off; },
  } as unknown as FeatureManager);
});
afterEach(async () => {
  await definition.plugins![0].onDisable!({} as ScopedFeatureContext);
  document.body.replaceChildren(); vi.unstubAllGlobals();
});
async function enable(count = 1) {
  document.body.innerHTML = `<div data-itemkey="92"><article class="ConvoHistory__messageBlock"><video id="ordinary-video"></video>${markup.repeat(count)}</article></div>`;
  await definition.plugins![0].onEnable!({ value: true } as ScopedFeatureContext);
  document.querySelectorAll(SELECTORS.messages.videoMessageDownloadAnchors).forEach(inject);
  document.querySelectorAll(SELECTORS.messages.videoMessageDownloadAnchors).forEach(inject);
  return Array.from(document.querySelectorAll<HTMLButtonElement>('.vkify-video-message-download'));
}

it('uses the best valid MP4 and preserves missing attachment positions', () => {
  expect(videoMessageFiles(message([
    { type: 'video', video: { id: 1, owner_id: 42 } }, circle(),
    circle({ mp4_1080: 'javascript:bad', mp4_720: 'https://cdn.test/circle720', mp4_480: 'https://cdn.test/circle480', hls: 'https://cdn.test/playlist.m3u8' }),
    circle({ hls: 'https://cdn.test/playlist.m3u8', failover_host: 'cdn.test' }),
  ]))).toEqual([null, { url: 'https://cdn.test/circle720', ext: 'mp4' }, null]);
});

it('injects once outside the clipped preview, keeps native controls and downloads the selected circle', async () => {
  const buttons = await enable(2);
  expect(buttons).toHaveLength(2);
  expect(document.querySelector('#ordinary-video')!.parentElement?.querySelectorAll('.vkify-video-message-download')).toHaveLength(2);
  expect(buttons[1].parentElement?.className).toBe('AttachVideoMessage');
  expect(buttons[1].style.left).toBe('0px'); expect(buttons[1].style.right).toBe('auto');
  expect(buttons[1].classList.contains('AttachVideoMessage__transcriptionToggle')).toBe(true);
  expect(document.querySelectorAll('.AttachVideoMessage__transcriptionToggle:not(.vkify-video-message-download)')).toHaveLength(2);
  const playback = vi.fn(); buttons[1].parentElement!.addEventListener('click', playback);
  call.mockResolvedValue({ items: [message([circle(), circle({ mp4_480: 'https://cdn.test/circle' })])] });
  buttons[1].click(); buttons[1].click();
  expect(call).toHaveBeenCalledOnce(); expect(playback).not.toHaveBeenCalled();
  await vi.waitFor(() => expect(download).toHaveBeenCalledWith('https://cdn.test/circle', 'video_message_42_92_2.mp4'));
  expect(call).toHaveBeenCalledWith('messages.getByConversationMessageId', { peer_id: 42, conversation_message_ids: 92 });
  expect(buttons[1].disabled).toBe(false);
});

it.each(['disable', 'peer', 'message'] as const)('ignores a stale response after %s changes', async change => {
  const [button] = await enable();
  let resolve!: (value: unknown) => void;
  call.mockReturnValue(new Promise(done => { resolve = done; }));
  button.click();
  if (change === 'disable') await definition.plugins![0].onDisable!({} as ScopedFeatureContext);
  if (change === 'peer') context.peerId = 43;
  if (change === 'message') document.querySelector('[data-itemkey]')!.setAttribute('data-itemkey', '93');
  resolve({ items: [message([circle({ mp4_480: 'https://cdn.test/old-circle' })])] });
  await vi.waitFor(() => expect(button.disabled).toBe(false));
  expect(download).not.toHaveBeenCalled(); expect(alert).not.toHaveBeenCalled();
});

it('uses the selected native MP4 when the matching API attachment omits files', async () => {
  const [button] = await enable();
  const video = document.querySelector('video.AttachVideoMessage__video')!;
  Object.defineProperties(video, { readyState: { value: 1 }, currentSrc: { value: 'https://vkvd724.okcdn.ru/playing-circle' } });
  call.mockResolvedValue({ items: [message([circle()])] });
  button.click();
  await vi.waitFor(() => expect(download).toHaveBeenCalledWith('https://vkvd724.okcdn.ru/playing-circle', 'video_message_42_92_1.mp4'));
});

it('does not pick an unrelated attachment from a forwarded message and removes buttons on disable', async () => {
  const [button] = await enable();
  call.mockResolvedValue({ items: [{ ...message([circle({ mp4_480: 'https://cdn.test/circle' })]), fwd_messages: [message([])] }] });
  button.click();
  await vi.waitFor(() => expect(alert).toHaveBeenCalledOnce());
  expect(download).not.toHaveBeenCalled();
  await definition.plugins![0].onDisable!({} as ScopedFeatureContext);
  expect(off).toHaveBeenCalledOnce(); expect(document.querySelector('.vkify-video-message-download')).toBeNull();
});
