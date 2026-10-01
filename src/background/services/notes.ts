import type { PinnedNote } from '@/types/index.js';
import { StorageKey } from '@/shared/constants/storage-keys.js';
import { readNotes, sameMessage, MAX_NOTES, type NotesMutation } from '@/shared/notes.js';
let queue: Promise<unknown> = Promise.resolve();

/** One background queue for content tabs and popup: concurrent saves cannot overwrite each other. */
export function mutateNotes(mutation: NotesMutation): Promise<PinnedNote[]> {
  const operation = queue.then(async () => {
    const raw = await chrome.storage.local.get(StorageKey.VKIFY_NOTES);
    let notes = readNotes(raw[StorageKey.VKIFY_NOTES]);
    if (mutation.action === 'append') {
      if (!readNotes([mutation.note]).length) throw new Error('Invalid note');
      if (!notes.some(note => sameMessage(note, mutation.note))) notes.push(mutation.note);
      notes = notes.sort((a, b) => a.addedAt - b.addedAt).slice(-MAX_NOTES);
    } else if (mutation.action === 'delete') {
      notes = notes.filter(note => note.id !== mutation.id);
    } else if (mutation.action === 'clear') {
      notes = [];
    } else {
      throw new Error('Invalid notes action');
    }
    await chrome.storage.local.set({ [StorageKey.VKIFY_NOTES]: notes });
    return notes;
  });
  queue = operation.catch(() => undefined);
  return operation;
}
