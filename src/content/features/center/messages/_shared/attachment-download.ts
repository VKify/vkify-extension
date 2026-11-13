import type { FeatureManager } from '@/content/core/feature-manager.js';
import { handlerFeature } from '@/content/core/features/index.js';
import { getService, SERVICES } from '@/content/core/services/index.js';
import { SELECTORS } from '@/content/selectors/index.js';
import { t } from '@/content/i18n/index.js';
import { buildDownloadIconSvg } from '../../_shared/download-icon.js';
import { attachBrandTooltip, hideBrandTooltip } from '../../_shared/brand-tooltip.js';
import { requestDownload } from '../../_shared/download-request.js';
import { extractCmid } from './message-dom.js';
import { detectConversationContext } from '../dialog-export/peer.js';
import type { VKMessage } from '../dialog-export/types.js';

export interface AttachmentFile { url: string; ext: string }
export interface AttachmentDownloadSpec {
  id: string;
  name: string;
  anchors: string;
  resolvePlayer(anchor: Element): Element | null;
  files(message: VKMessage): Array<AttachmentFile | null>;
  fallbackFile?(player: Element): AttachmentFile | null;
  labelKey: string;
  errorKey: string;
  buttonClass: string;
  nativeButtonClass?: string;
  buttonStyle: string;
  filenamePrefix: string;
  tags: string[];
}

export function registerAttachmentDownloadFeature(manager: FeatureManager, spec: AttachmentDownloadSpec): void {
  let off: (() => void) | null = null;
  let generation = 0;

  function inject(anchor: Element): void {
    const player = spec.resolvePlayer(anchor);
    if (!player) return;
    if (player.querySelector(`.${spec.buttonClass}`)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `${spec.nativeButtonClass ?? 'ConvoMessageIconButton'} ${spec.buttonClass}`;
    button.setAttribute('aria-label', t(spec.labelKey));
    button.style.cssText = spec.buttonStyle;
    attachBrandTooltip(button, () => t(spec.labelKey));
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
        block.querySelectorAll(spec.anchors),
      ).map(spec.resolvePlayer).filter((element): element is Element => element !== null))] : [];
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
          // Forwarded/replied-to media need their own identity: never download
          // a different attachment merely because it occupies the same position.
          if (!message || message.fwd_messages?.length || message.reply_message) throw new Error('Ambiguous attachment');
          const files = spec.files(message);
          const file = files[index] ?? spec.fallbackFile?.(player);
          if (files.length !== players.length || !file) throw new Error('Attachment URL unavailable');
          const activeContext = detectConversationContext();
          if (generation !== currentGeneration || !button.isConnected || !block
            || extractCmid(block) !== cmid || activeContext?.peerId !== context.peerId
            || activeContext.groupId !== context.groupId) return;
          requestDownload(file.url, `${spec.filenamePrefix}_${context.peerId}_${cmid}_${index + 1}.${file.ext}`);
        } catch {
          if (generation === currentGeneration && button.isConnected) alert(t(spec.errorKey));
        } finally {
          button.disabled = false;
          button.removeAttribute('aria-busy');
        }
      })();
    });
    player.appendChild(button);
  }

  manager.registerDefinition(handlerFeature({
    id: spec.id,
    name: spec.name, category: 'messages', impact: 'medium',
    requiresDomLayer: true, tags: spec.tags,
    reapplyOnLanguageChange: true,
    handler: {
      enable: () => {
        if (!off) off = manager.observeMatches(spec.id, spec.anchors, inject);
      },
      disable: () => {
        generation++;
        off?.();
        off = null;
        hideBrandTooltip();
        document.querySelectorAll(`.${spec.buttonClass}`).forEach(button => button.remove());
      },
    },
  }));
}
