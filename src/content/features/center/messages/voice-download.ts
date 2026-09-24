import type { FeatureManager } from '@/content/core/feature-manager.js';
import { handlerFeature } from '@/content/core/features/index.js';
import { getService, SERVICES } from '@/content/core/services/index.js';
import { SELECTORS } from '@/content/selectors/index.js';
import { t } from '@/content/i18n/index.js';
import { buildDownloadIconSvg } from '../_shared/download-icon.js';
import { attachBrandTooltip, hideBrandTooltip } from '../_shared/brand-tooltip.js';
import { requestDownload } from '../_shared/download-request.js';
import { extractCmid } from './_shared/message-dom.js';
import { detectConversationContext } from './dialog-export/peer.js';
import type { VKMessage } from './dialog-export/types.js';

const BUTTON = 'vkify-voice-download';

/** The stable ASR testid identifies the player even if VK renames its class. */
function resolvePlayer(anchor: Element): Element | null {
  if (anchor.matches(SELECTORS.messages.voiceAsrToggle)) return anchor.parentElement;
  return anchor.querySelector(SELECTORS.messages.voiceAsrToggle)?.parentElement
    ?? (anchor.matches(SELECTORS.messages.voicePlayer) ? anchor : null);
}

/** Keep attachment positions even when a particular voice has no usable URL. */
export function voiceFiles(message: VKMessage): Array<{ url: string; ext: string } | null> {
  return (message.attachments ?? []).filter(a => a.type === 'audio_message').map(a => {
    for (const [url, ext] of [[a.audio_message?.link_mp3, 'mp3'], [a.audio_message?.link_ogg, 'ogg']] as const) {
      if (!url) continue;
      try {
        if (new URL(url).protocol === 'https:') return { url, ext };
      } catch { /* Try the alternative encoding. */ }
    }
    return null;
  });
}

export function registerVoiceDownloadFeature(manager: FeatureManager): void {
  let off: (() => void) | null = null;
  let generation = 0;

  function inject(anchor: Element): void {
    const player = resolvePlayer(anchor);
    if (!player) return;
    if (player.querySelector(`.${BUTTON}`)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `ConvoMessageIconButton ${BUTTON}`;
    button.setAttribute('aria-label', t('messages.voice_download'));
    button.style.cssText = 'flex:0 0 auto;margin-left:8px;cursor:pointer;height:20px;width:32px;align-self:flex-start';
    attachBrandTooltip(button, () => t('messages.voice_download'));
    button.appendChild(buildDownloadIconSvg(20));
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      hideBrandTooltip();
      if (button.disabled) return;
      const currentGeneration = generation;
      const block = player.closest(SELECTORS.messages.block);
      const cmid = block ? extractCmid(block) : null;
      const context = detectConversationContext();
      const players = block ? [...new Set(Array.from(
        block.querySelectorAll(SELECTORS.messages.voiceDownloadAnchors),
      ).map(resolvePlayer).filter((element): element is Element => element !== null))] : [];
      const index = players.indexOf(player);
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      void (async () => {
        try {
          if (!context || cmid === null || index < 0) throw new Error('Missing message context');
          const response = await getService(SERVICES.vkApi).call('messages.getByConversationMessageId', {
            peer_id: context.peerId,
            conversation_message_ids: cmid,
            ...(context.groupId !== null ? { group_id: context.groupId } : {}),
          }) as { items?: VKMessage[] } | null;
          const message = response?.items?.find(item => item.conversation_message_id === cmid);
          // Forwarded/replied-to voices need their own identity: never download
          // a different attachment merely because it occupies the same position.
          if (!message || message.fwd_messages?.length || message.reply_message) throw new Error('Ambiguous attachment');
          const files = voiceFiles(message);
          const file = files[index];
          if (files.length !== players.length || !file) throw new Error('Voice URL unavailable');
          const activeContext = detectConversationContext();
          if (generation !== currentGeneration || !button.isConnected || !block
            || extractCmid(block) !== cmid || activeContext?.peerId !== context.peerId
            || activeContext.groupId !== context.groupId) return;
          requestDownload(file.url, `voice_${context.peerId}_${cmid}_${index + 1}.${file.ext}`);
        } catch {
          if (generation === currentGeneration && button.isConnected) alert(t('messages.voice_download_error'));
        } finally {
          button.disabled = false;
          button.removeAttribute('aria-busy');
        }
      })();
    });
    player.appendChild(button);
  }

  manager.registerDefinition(handlerFeature({
    id: 'voice_download',
    name: 'Скачивание голосовых сообщений', category: 'messages', impact: 'medium',
    requiresDomLayer: true, tags: ['im', 'download', 'audio'],
    reapplyOnLanguageChange: true,
    handler: {
      enable: () => {
        if (!off) off = manager.observeMatches('voice_download', SELECTORS.messages.voiceDownloadAnchors, inject);
      },
      disable: () => {
        generation++;
        off?.();
        off = null;
        hideBrandTooltip();
        document.querySelectorAll(`.${BUTTON}`).forEach(button => button.remove());
      },
    },
  }));
}
