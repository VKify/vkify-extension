import React from 'react';
import { useTranslation } from 'react-i18next';
import { isVkPhotoUrl } from '@/shared/telegram-notifications/photos.js';
import { normalizeAttachments, safeAttachmentUrl } from '@/shared/telegram-notifications/attachments.js';

export function SpyLogText({ text }: { text: string }): React.ReactElement {
  return <>{text.split(/(https:\/\/[^\s<>"]+)/g).map((part, index) => safeAttachmentUrl(part)
    ? <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">{part}</a>
    : <React.Fragment key={index}>{part}</React.Fragment>)}</>;
}

export default function SpyLogMedia({ photos, attachments }: { photos?: unknown; attachments?: unknown }): React.ReactElement {
  const { t } = useTranslation('modals');
  const images = Array.isArray(photos) ? photos.filter(isVkPhotoUrl).slice(0, 10) : [];
  return <div className="mt-2 space-y-2">
    {!!images.length && <div className="flex flex-wrap gap-2">{images.map((url, index) => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary">
      <img src={url} loading="lazy" referrerPolicy="no-referrer" alt={t('spy_log.photo', { number: index + 1 })} className="w-24 h-24 object-cover rounded-lg" />
      <span>{t('spy_log.photo', { number: index + 1 })}</span>
    </a>)}</div>}
    {normalizeAttachments(attachments).map((a, index) => <div key={`${a.url}:${index}`} className="p-2 rounded-lg bg-[var(--bg-tertiary)] text-xs">
      <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">{a.title}</a>
      {['voice', 'audio'].includes(a.kind) && <audio src={a.url} controls preload="none" className="mt-2 w-full" aria-label={a.title} />}
      {a.kind === 'video' && <video src={a.url} controls preload="none" className="mt-2 w-full rounded-lg" aria-label={a.title} />}
      <div className="mt-1 break-all text-[var(--text-tertiary)]">{a.url}</div>
    </div>)}
  </div>;
}
