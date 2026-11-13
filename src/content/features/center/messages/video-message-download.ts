import type { FeatureManager } from '@/content/core/feature-manager.js';
import { SELECTORS } from '@/content/selectors/index.js';
import type { VKMessage } from './dialog-export/types.js';
import { registerAttachmentDownloadFeature, type AttachmentFile } from './_shared/attachment-download.js';

/** VK's video_message carries files.mp4_<height>; keep missing entries in place. */
export function videoMessageFiles(message: VKMessage): Array<AttachmentFile | null> {
  return (message.attachments ?? []).filter(attachment => attachment.type === 'video_message').map(attachment => {
    const files = Object.entries(attachment.video_message?.files ?? {})
      .filter(([key]) => /^mp4_\d+$/.test(key))
      .sort(([first], [second]) => Number(second.slice(4)) - Number(first.slice(4)));
    for (const [, url] of files) {
      try { if (new URL(url).protocol === 'https:') return { url, ext: 'mp4' }; }
      catch { /* Try the next MP4 quality. */ }
    }
    return null;
  });
}

export function registerVideoMessageDownloadFeature(manager: FeatureManager): void {
  registerAttachmentDownloadFeature(manager, {
    id: 'video_message_download', name: 'Скачивание кружочков',
    anchors: SELECTORS.messages.videoMessageDownloadAnchors,
    resolvePlayer: anchor => anchor.closest(SELECTORS.messages.videoMessage),
    files: videoMessageFiles,
    fallbackFile: player => {
      const video = player.querySelector('video');
      // The observed circle has a playable HTTPS MP4 source. Never save a blob or streaming manifest as MP4.
      if (!video || video.readyState < 1 || !video.currentSrc) return null;
      try {
        const url = new URL(video.currentSrc);
        if (url.protocol === 'https:' && !/\.(?:m3u8|mpd|webm|ogg)$/i.test(url.pathname))
          return { url: video.currentSrc, ext: 'mp4' };
      } catch { /* No usable native source. */ }
      return null;
    },
    labelKey: 'messages.video_message_download', errorKey: 'messages.video_message_download_error',
    buttonClass: 'vkify-video-message-download', filenamePrefix: 'video_message', tags: ['im', 'download', 'video'],
    nativeButtonClass: 'AttachVideoMessage__transcriptionToggle',
    // The upper-right corner holds VK's transcription toggle; the preview is clipped separately.
    buttonStyle: 'left:0;right:auto;z-index:2;display:flex;align-items:center;justify-content:center;padding:0;height:24px;width:34px',
  });
}
