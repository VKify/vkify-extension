// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { domAttachments, messageAttachments } from './attachments.js';
import { makeButton } from './button.js';
import { registerPinNoteFeature } from './index.js';
import type { VKMessage } from '../dialog-export/types.js';
import type { FeatureManager } from '@/content/core/feature-manager.js';
import type { FeatureDefinition } from '@/content/core/features/feature-definition.js';
import type { ScopedFeatureContext } from '@/content/core/features/scoped-context.js';

const { call, append } = vi.hoisted(() => ({ call: vi.fn(), append: vi.fn() }));
vi.mock('@/content/core/services/index.js', () => ({ SERVICES: { vkApi: 'vkApi' }, getService: () => ({ call }) }));
vi.mock('./notes.js', () => ({ makeId: () => 'saved', appendNote: append }));
vi.mock('../dialog-export/peer.js', () => ({ detectConversationContext: () => ({ peerId: 42, groupId: 123 }) }));

const message = (attachments: VKMessage['attachments']): VKMessage => ({
  id: 1, conversation_message_id: 20, date: 0, from_id: 2, peer_id: 42, text: '', attachments,
});
const source = 'https://vk.ru/im/convo/42?cmid=20';

beforeEach(() => { call.mockReset(); append.mockReset(); document.body.innerHTML = ''; });

describe('note attachments', () => {
  it('extracts both images from a textless message without saving the avatar or photo page', () => {
    document.body.innerHTML = `<article><a class="ConvoMessageWithoutBubble__avatar"><img src="https://cdn.test/avatar.jpg"></a>
      <div class="ConvoMessageWithoutBubble__mediaAttachments"><div class="Attachments">
        <a class="AttachPhotos__link" href="/im?z=photo1"><img class="PhotoItem__img" src="https://cdn.test/one.jpg?a=1&amp;b=2"></a>
        <a class="AttachPhotos__link" href="/im?z=photo2"><img class="PhotoItem__img" src="https://cdn.test/two.jpg"></a>
      </div></div></article>`;
    expect(domAttachments(document.querySelector('article')!)).toEqual([
      { type: 'image', url: 'https://cdn.test/one.jpg?a=1&b=2' },
      { type: 'image', url: 'https://cdn.test/two.jpg' },
    ]);
  });

  it('saves a document URL and filename instead of its lower resolution preview', () => {
    document.body.innerHTML = `<article><div class="Attachments"><a class="AttachDocPreview" href="https://vk.ru/doc1?dl=abc&amp;api=1">
      <img src="https://cdn.test/preview.jpg" alt="wallhaven.jpg"><span>JPG · 582 KB</span></a></div></article>`;
    expect(domAttachments(document.querySelector('article')!)).toEqual([
      { type: 'file', url: 'https://vk.ru/doc1?dl=abc&api=1', title: 'wallhaven.jpg' },
    ]);
  });

  it('uses largest photos, safe alternate voice URLs, documents and a source link for unavailable media', () => {
    expect(messageAttachments(message([
      { type: 'photo', photo: { id: 1, owner_id: 1, sizes: [
        { type: 's', width: 20, height: 20, url: 'https://cdn.test/s.jpg' },
        { type: 'x', width: 100, height: 100, url: 'https://cdn.test/x.jpg' },
      ] } },
      { type: 'audio_message', audio_message: { link_mp3: 'javascript:bad', link_ogg: 'https://cdn.test/voice.ogg' } },
      { type: 'doc', doc: { id: 1, title: 'archive.zip', url: 'https://cdn.test/file.zip' } },
      { type: 'poll' },
    ]), source)).toEqual([
      { type: 'image', url: 'https://cdn.test/x.jpg' },
      { type: 'voice', url: 'https://cdn.test/voice.ogg' },
      { type: 'file', url: 'https://cdn.test/file.zip', title: 'archive.zip' },
      { type: 'link', url: source, title: 'poll' },
    ]);
  });

  it('includes attachments from forwarded messages and replies', () => {
    const m = message([]);
    m.fwd_messages = [message([{ type: 'audio_message', audio_message: { link_mp3: 'https://cdn.test/fwd.mp3' } }])];
    m.reply_message = message([{ type: 'link', link: { url: 'https://example.com' } }]);
    expect(messageAttachments(m, source).map(a => a.url)).toEqual(['https://cdn.test/fwd.mp3', 'https://example.com/']);
  });

  it('injects a note button into a message containing only attachments', async () => {
    let definition!: FeatureDefinition;
    let inject!: (element: Element) => void;
    registerPinNoteFeature({
      registerDefinition: (value: FeatureDefinition) => { definition = value; },
      observeMatches: (_id: string, _selector: string, callback: typeof inject) => { inject = callback; return () => {}; },
    } as unknown as FeatureManager);
    document.body.innerHTML = '<article class="ConvoHistory__messageBlock"><div class="ConvoMessageInfoWithoutBubbles"></div></article>';
    await definition.plugins![0].onEnable!({ value: true } as ScopedFeatureContext);
    inject(document.querySelector('article')!);
    expect(document.querySelector('article button')).not.toBeNull();
    await definition.plugins![0].onDisable!({} as ScopedFeatureContext);
    expect(document.querySelector('article button')).toBeNull();
  });

  it('saves a textless voice through the API and blocks concurrent clicks', async () => {
    document.body.innerHTML = '<div data-itemkey="20"><article></article></div>';
    const button = makeButton(document.querySelector('article')!);
    call.mockResolvedValue({ items: [message([{ type: 'audio_message', audio_message: { link_mp3: 'https://cdn.test/voice.mp3' } }])] });
    button.click(); button.click();
    await vi.waitFor(() => expect(append).toHaveBeenCalledOnce());
    expect(call).toHaveBeenCalledWith('messages.getByConversationMessageId', {
      peer_id: 42, conversation_message_ids: 20, group_id: 123,
    });
    expect(append.mock.calls[0][0]).toMatchObject({ text: '', peerId: 42, cmid: 20,
      attachments: [{ type: 'voice', url: 'https://cdn.test/voice.mp3' }] });
    expect(button.disabled).toBe(false);
  });

  it('preserves visible file links when the API fails', async () => {
    document.body.innerHTML = '<div data-itemkey="20"><article><div class="Attachments"><a class="AttachDocPreview" href="https://cdn.test/file.zip">archive.zip</a></div></article></div>';
    call.mockRejectedValue(new Error('No token'));
    makeButton(document.querySelector('article')!).click();
    await vi.waitFor(() => expect(append).toHaveBeenCalledOnce());
    expect(append.mock.calls[0][0].attachments).toEqual([{ type: 'file', url: 'https://cdn.test/file.zip', title: 'archive.zip' }]);
  });
});
