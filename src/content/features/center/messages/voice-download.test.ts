// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { voiceFiles, registerVoiceDownloadFeature } from './voice-download.js';
import type { VKMessage } from './dialog-export/types.js';
import type { FeatureDefinition } from '@/content/core/features/feature-definition.js';
import type { ScopedFeatureContext } from '@/content/core/features/scoped-context.js';
import type { FeatureManager } from '@/content/core/feature-manager.js';
import { SELECTORS } from '@/content/selectors/index.js';

const { call, download } = vi.hoisted(() => ({ call: vi.fn(), download: vi.fn() }));
vi.mock('@/content/core/services/index.js', () => ({ SERVICES: { vkApi: 'vkApi' }, getService: () => ({ call }) }));
vi.mock('../_shared/download-request.js', () => ({ requestDownload: download }));
vi.mock('./dialog-export/peer.js', () => ({ detectConversationContext: () => ({ peerId: 42, groupId: 123 }) }));

const message = (attachments: VKMessage['attachments']): VKMessage => ({
  id: 1, date: 0, peer_id: 2, from_id: 2, text: '', attachments,
});

describe('voice downloads', () => {
  it('prefers MP3 and falls back to a valid OGG URL without shifting missing attachments', () => {
    expect(voiceFiles(message([
      { type: 'photo' },
      { type: 'audio_message', audio_message: { link_mp3: 'https://cdn.test/a.mp3', link_ogg: 'https://cdn.test/a.ogg' } },
      { type: 'audio_message', audio_message: {} },
      { type: 'audio_message', audio_message: { link_mp3: 'javascript:bad', link_ogg: 'https://cdn.test/b.ogg' } },
    ]))).toEqual([
      { url: 'https://cdn.test/a.mp3', ext: 'mp3' }, null,
      { url: 'https://cdn.test/b.ogg', ext: 'ogg' },
    ]);
  });

  it.each([
    '<div class="AttachVoice__player"></div>',
    '<div class="AttachVoice__player"><button data-testid="vkme_message_voice_asr_toggle"></button></div>',
    '<div class="renamed-player"><button data-testid="vkme_message_voice_asr_toggle"></button></div>',
  ])('downloads and cleans up with player markup %s', async (markup) => {
    call.mockClear();
    download.mockClear();
    let definition!: FeatureDefinition;
    let inject: (element: Element) => void = () => {};
    const off = vi.fn();
    registerVoiceDownloadFeature({
      registerDefinition: (value: FeatureDefinition) => { definition = value; },
      observeMatches: (_id: string, _selector: string, callback: typeof inject) => { inject = callback; return off; },
    } as unknown as FeatureManager);
    document.body.innerHTML = `<div data-itemkey="92"><article class="ConvoHistory__messageBlock"><div class="AttachVoice">${markup}</div></article></div>`;
    await definition.plugins![0].onEnable!({ value: true } as ScopedFeatureContext);
    const player = document.querySelector('.AttachVoice')!.firstElementChild!;
    const anchors = document.querySelectorAll(SELECTORS.messages.voiceDownloadAnchors);
    anchors.forEach(inject);
    anchors.forEach(inject);
    expect(player.querySelectorAll('.vkify-voice-download')).toHaveLength(1);
    const button = player.querySelector<HTMLButtonElement>('.vkify-voice-download')!;
    expect(button.style.height).toBe('20px');
    expect(button.style.width).toBe('32px');
    expect(button.style.alignSelf).toBe('flex-start');
    expect(button.hasAttribute('title')).toBe(false);
    button.dispatchEvent(new MouseEvent('mouseenter'));
    expect(document.querySelector('.vkify-tip.is-visible')?.textContent).toBe(button.getAttribute('aria-label'));
    call.mockResolvedValue({ items: [{ ...message([
      { type: 'audio_message', audio_message: { link_mp3: 'https://cdn.test/voice.mp3' } },
    ]), conversation_message_id: 92 }] });
    button.click();
    expect(document.querySelector('.vkify-tip.is-visible')).toBeNull();
    await vi.waitFor(() => expect(download).toHaveBeenCalledWith('https://cdn.test/voice.mp3', 'voice_42_92_1.mp3'));
    expect(call).toHaveBeenCalledWith('messages.getByConversationMessageId', {
      peer_id: 42, conversation_message_ids: 92, group_id: 123,
    });
    await definition.plugins![0].onDisable!({} as ScopedFeatureContext);
    expect(off).toHaveBeenCalledOnce();
    expect(player.querySelector('.vkify-voice-download')).toBeNull();
  });
});
