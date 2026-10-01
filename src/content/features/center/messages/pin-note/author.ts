import type { PinnedNote } from '@/types/index.js';

/** Only sender elements: attachment thumbnails and forwarded authors are excluded. */
export function extractNoteAuthor(block: Element): Pick<PinnedNote, 'authorId' | 'authorPhoto'> {
  const link = block.querySelector<HTMLAnchorElement>('a.ConvoMessageHeader__authorLink, a[class*="MessageHeader__author"], a[class*="Message__avatar"], a[class*="MessageAvatar"]');
  const match = link?.getAttribute('href')?.match(/\/(id|club|public)(\d+)(?:[/?#]|$)/);
  const rawId = block.getAttribute('data-from-id') ?? block.getAttribute('data-sender-id');
  const authorId = match ? Number(match[2]) * (match[1] === 'id' ? 1 : -1) : rawId ? Number(rawId) : undefined;
  const image = block.querySelector<HTMLImageElement>('[class*="Message"][class*="__avatar"] img, [class*="MessageAvatar"] img, img[class*="Message"][class*="__avatar"]');
  const source = image?.currentSrc || image?.src;
  return {
    authorId: authorId && Number.isSafeInteger(authorId) ? authorId : undefined,
    authorPhoto: source?.startsWith('https://') ? source : undefined,
  };
}
