// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import { copyContent } from './content.js';
import { registerQuickCopyFeature } from './index.js';
import type { FeatureManager } from '@/content/core/feature-manager.js';
import type { FeatureDefinition } from '@/content/core/features/feature-definition.js';
import type { ScopedFeatureContext } from '@/content/core/features/scoped-context.js';

const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock('@/content/core/services/index.js', () => ({ SERVICES: { vkApi: 'api' }, getService: () => ({ call }) }));
vi.mock('../dialog-export/peer.js', () => ({ detectConversationContext: () => ({ peerId: 42, groupId: null }) }));

beforeEach(() => { call.mockReset(); document.body.innerHTML = ''; });
const block = (id: number) => {
  const el = document.createElement('article');
  el.setAttribute('data-cmid', String(id));
  document.body.append(el);
  return el;
};

it.each(['AttachPhotos', 'AttachVideo', 'AttachAudioMessage', 'AttachVideoMessage', 'AttachDocPreview', 'AttachSticker'])
('inserts a copy button for textless %s messages', async mediaClass => {
  let definition!: FeatureDefinition;
  let inject!: (element: Element) => void;
  registerQuickCopyFeature({
    registerDefinition: (value: FeatureDefinition) => { definition = value; },
    observeMatches: (_id: string, _selector: string, callback: typeof inject) => { inject = callback; return () => {}; },
  } as unknown as FeatureManager);
  document.body.innerHTML = `<article class="ConvoHistory__messageBlock"><div class="Attachments"><div class="${mediaClass}"></div></div><div class="ConvoMessageInfoWithoutBubbles"></div></article>`;
  await definition.plugins![0].onEnable!({ value: true } as ScopedFeatureContext);
  const message = document.querySelector('article')!;
  inject(message);
  inject(message);
  expect(message.querySelectorAll('button')).toHaveLength(1);
  await definition.plugins![0].onDisable!({} as ScopedFeatureContext);
  expect(message.querySelector('button')).toBeNull();
});

it('resolves hidden authors and copies textless media in document order', async () => {
  call.mockResolvedValueOnce({ items: [
    { conversation_message_id: 2, from_id: 7, text: '', attachments: [
      { type: 'video_message', video_message: { files: { mp4_240: 'https://cdn.test/low.mp4', mp4_720: 'https://cdn.test/circle.mp4' } } },
      { type: 'audio_message', audio_message: { link_mp3: 'https://cdn.test/voice.mp3' } },
    ] },
    { conversation_message_id: 1, from_id: 7, text: 'Привет', attachments: [
      { type: 'photo', photo: { sizes: [{ width: 100, height: 100, url: 'https://cdn.test/photo.jpg' }] } },
      { type: 'video', video: { owner_id: -2, id: 3, access_key: 'secret' } },
    ] },
  ] }).mockResolvedValueOnce([{ id: 7, first_name: 'Иван', last_name: 'Петров' }]);
  expect(await copyContent([block(1), block(2)], true)).toEqual([
    '[Иван Петров] Привет\nhttps://cdn.test/photo.jpg\nhttps://vk.ru/video-2_3?access_key=secret',
    '[Иван Петров] https://cdn.test/circle.mp4\nhttps://cdn.test/voice.mp3',
  ]);
  expect(call.mock.calls[0][1].conversation_message_ids).toBe('1,2');
});

it('uses extended group names without extra requests and retains unavailable attachments', async () => {
  call.mockResolvedValueOnce({ items: [{ conversation_message_id: 1, from_id: -5, text: '', attachments: [{ type: 'unknown' }] }], groups: [{ id: 5, name: 'Команда' }] });
  expect(await copyContent([block(1)], true)).toEqual(['[Команда] https://vk.ru/im/convo/42?cmid=1']);
  expect(call).toHaveBeenCalledTimes(1);
});

it('retains DOM media and sender identity when API fails', async () => {
  call.mockRejectedValue(new Error('unavailable'));
  const el = block(1);
  el.setAttribute('data-from-id', '7');
  el.innerHTML = '<div class="Attachments"><audio src="https://cdn.test/voice.mp3"></audio></div>';
  expect(await copyContent([el], true)).toEqual(['[https://vk.ru/id7] https://cdn.test/voice.mp3']);
});
