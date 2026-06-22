/** Локальный архив заметок в chrome.storage.local (без сети). */

import type { PinnedNote } from '@/types/index.js';
import { StorageKey } from '@/shared/constants/storage-keys.js';
import { MAX_NOTES } from './constants.js';

export function makeId(): string {
  return `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function appendNote(note: PinnedNote): Promise<void> {
  const cur = await chrome.storage.local.get([StorageKey.VKIFY_NOTES]);
  const list: PinnedNote[] = (cur[StorageKey.VKIFY_NOTES] as PinnedNote[] | undefined) ?? [];

  // Не дублируем то же сообщение, если пользователь дважды нажал.
  // Кейс: зашифровал и расшифровал — текст одинаковый, время одинаковое.
  const dup = list.find(n =>
    n.text === note.text && n.peerId === note.peerId && n.origTime === note.origTime,
  );
  if (dup) return;

  list.push(note);
  if (list.length > MAX_NOTES) list.splice(0, list.length - MAX_NOTES);
  await chrome.storage.local.set({ [StorageKey.VKIFY_NOTES]: list });
}
