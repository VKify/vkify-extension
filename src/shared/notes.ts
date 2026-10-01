import type { PinnedNote } from '@/types/index.js';

export const MAX_NOTES = 500;
export type NotesMutation = { action: 'append'; note: PinnedNote } | { action: 'delete'; id: string } | { action: 'clear' };

export function readNotes(value: unknown): PinnedNote[] {
  if (!Array.isArray(value)) return [];
  return value.filter((note): note is PinnedNote => note !== null && typeof note === 'object'
    && typeof note.id === 'string' && typeof note.text === 'string'
    && Number.isFinite(note.addedAt)
    && ['author', 'authorPhoto', 'origTime', 'peerTitle'].every(key => note[key] === undefined || typeof note[key] === 'string')
    && ['authorId', 'peerId', 'cmid'].every(key => note[key] === undefined || Number.isSafeInteger(note[key])));
}

export function sameMessage(a: PinnedNote, b: PinnedNote): boolean {
  if (a.peerId !== b.peerId) return false;
  if (a.peerId === undefined && a.peerTitle !== b.peerTitle) return false;
  if (a.cmid !== undefined && b.cmid !== undefined) return a.cmid === b.cmid;
  return a.text === b.text && a.origTime === b.origTime && a.author === b.author;
}
