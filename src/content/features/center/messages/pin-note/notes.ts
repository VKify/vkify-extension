/** Локальный архив заметок в chrome.storage.local (без сети). */

import type { PinnedNote } from '@/types/index.js';
import { sendMessage } from '@/shared/messaging.js';

export function makeId(): string {
  return crypto.randomUUID();
}

export async function appendNote(note: PinnedNote): Promise<void> {
  const result = await sendMessage({ type: 'MUTATE_NOTES', action: 'append', note });
  if (!result?.success) throw new Error(result?.error ?? 'Note save failed');
}
