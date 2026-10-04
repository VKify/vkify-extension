import type { NoteAttachment, PinnedNote } from '@/types/index.js';
import { safeUrl } from './center-tools.js';

export function isNoteAttachment(value: unknown): value is NoteAttachment {
  if (!value || typeof value !== 'object') return false;
  const a = value as NoteAttachment;
  return ['image', 'voice', 'audio', 'video', 'file', 'link'].includes(a.type)
    && safeUrl(a.url) !== null && (a.title === undefined || typeof a.title === 'string');
}

export function attachmentType(url: string): NoteAttachment['type'] {
  const path = new URL(url).pathname;
  if (/\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(path)) return 'image';
  if (/\.(mp3|ogg|oga|wav|m4a|aac|flac|opus)$/i.test(path)) return 'audio';
  if (/\.(mp4|webm|mov|m4v|ogv)$/i.test(path)) return 'video';
  return 'file';
}

export function noteCopyText(note: PinnedNote): string {
  return [note.text, ...(note.attachments ?? []).map(a => a.url)].filter(Boolean).join('\n');
}

export const MAX_NOTES = 500;
export type NotesMutation = { action: 'append'; note: PinnedNote } | { action: 'delete'; id: string } | { action: 'clear' };

export function readNotes(value: unknown): PinnedNote[] {
  if (!Array.isArray(value)) return [];
  return value.filter((note): note is PinnedNote => note !== null && typeof note === 'object'
    && typeof note.id === 'string' && typeof note.text === 'string'
    && Number.isFinite(note.addedAt)
    && (note.attachments === undefined || (Array.isArray(note.attachments) && note.attachments.every(isNoteAttachment)))
    && ['author', 'authorPhoto', 'origTime', 'peerTitle'].every(key => note[key] === undefined || typeof note[key] === 'string')
    && ['authorId', 'peerId', 'cmid'].every(key => note[key] === undefined || Number.isSafeInteger(note[key])));
}

export function sameMessage(a: PinnedNote, b: PinnedNote): boolean {
  if (a.peerId !== b.peerId) return false;
  if (a.peerId === undefined && a.peerTitle !== b.peerTitle) return false;
  if (a.cmid !== undefined && b.cmid !== undefined) return a.cmid === b.cmid;
  return a.text === b.text && a.origTime === b.origTime && a.author === b.author
    && JSON.stringify(a.attachments ?? []) === JSON.stringify(b.attachments ?? []);
}
