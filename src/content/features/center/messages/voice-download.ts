import type { FeatureManager } from '@/content/core/feature-manager.js';
import { SELECTORS } from '@/content/selectors/index.js';
import type { VKMessage } from './dialog-export/types.js';
import { registerAttachmentDownloadFeature } from './_shared/attachment-download.js';

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
  registerAttachmentDownloadFeature(manager, {
    id: 'voice_download', name: 'Скачивание голосовых сообщений',
    anchors: SELECTORS.messages.voiceDownloadAnchors, resolvePlayer, files: voiceFiles,
    labelKey: 'messages.voice_download', errorKey: 'messages.voice_download_error',
    buttonClass: 'vkify-voice-download', filenamePrefix: 'voice', tags: ['im', 'download', 'audio'],
    buttonStyle: 'flex:0 0 auto;margin-left:8px;cursor:pointer;height:20px;width:32px;align-self:flex-start',
  });
}
