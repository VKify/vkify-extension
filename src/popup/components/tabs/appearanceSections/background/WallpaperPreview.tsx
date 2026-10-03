import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageIcon, VideoIcon, GlobeIcon } from '@/popup/components/icons/Icons.js';
import { parseVideoUrl } from '@/shared/videoEmbed.js';
import { isSafeBackgroundResource } from '@/shared/background-resource.js';

/** Shared preview for custom wallpapers and the day/night cards. Never plays audio automatically. */
export default function WallpaperPreview({ url, type, title }: { url?: string; type?: string; title: string }): React.ReactElement {
  const { t } = useTranslation('appearance');
  const [failedSource, setFailedSource] = useState<string>();
  const safe = !!url && isSafeBackgroundResource(url);
  const failed = failedSource === url;
  const embed = safe && type === 'embed' ? parseVideoUrl(url) : null;
  let embedUrl: string | undefined;
  if (embed) {
    const parsed = new URL(embed.embedUrl);
    parsed.searchParams.set('autoplay', '0');
    parsed.searchParams.set('autostart', 'false');
    parsed.searchParams.set('controls', '1');
    parsed.searchParams.delete('background');
    embedUrl = parsed.href;
  }
  const Icon = type === 'web' ? GlobeIcon : type === 'video' || type === 'embed' ? VideoIcon : ImageIcon;
  return <div className="relative aspect-[16/8] overflow-hidden bg-[var(--bg-tertiary)] flex flex-col items-center justify-center gap-2 text-[var(--text-tertiary)]">
    <Icon className="h-6 w-6" />
    <span className="text-[11px] px-3 text-center">{!url ? t('background.schedule.empty') : type === 'web' ? t('background.types.web') : t('background.preview_unavailable')}</span>
    {safe && !failed && type === 'image' && <img key={url} src={url} alt={title} className="absolute inset-0 h-full w-full object-cover" onError={() => setFailedSource(url)} />}
    {safe && !failed && type === 'video' && <video key={url} src={url} aria-label={title} controls muted playsInline preload="metadata"
      controlsList="nodownload noremoteplayback" disablePictureInPicture
      className="absolute inset-0 h-full w-full object-cover bg-black" onError={() => setFailedSource(url)} />}
    {embedUrl && !failed && <iframe key={embedUrl} src={embedUrl} title={title} loading="lazy"
      allow="fullscreen; picture-in-picture" sandbox="allow-scripts allow-same-origin allow-presentation"
      referrerPolicy="strict-origin-when-cross-origin" className="absolute inset-0 h-full w-full border-0 bg-black" onError={() => setFailedSource(url)} />}
  </div>;
}
