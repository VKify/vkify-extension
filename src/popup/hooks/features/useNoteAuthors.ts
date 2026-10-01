import { useEffect, useRef, useState } from 'react';
import type { PinnedNote } from '@/types/index.js';

export interface NoteAuthor { id?: number; name?: string; photo?: string }
type ApiCall = (method: string, params?: Record<string, unknown>) => Promise<unknown>;

/** Resolve old notes by their message, so the sender in a group is never mistaken for the chat. */
export function useNoteAuthors(notes: PinnedNote[], hasToken: boolean, call: ApiCall): Record<string, NoteAuthor> {
  const [authors, setAuthors] = useState<Record<string, NoteAuthor>>({});
  const requested = useRef(new Set<string>());
  useEffect(() => {
    if (!hasToken) return;
    const pending = notes.filter(note => !requested.current.has(note.id));
    if (!pending.length) return;
    pending.forEach(note => requested.current.add(note.id));
    void (async () => {
      const next: Record<string, NoteAuthor> = {};
      const peers = new Map<number, PinnedNote[]>();
      for (const note of pending) {
        if (note.authorId !== undefined) next[note.id] = { id: note.authorId };
        else if (note.peerId !== undefined && note.cmid !== undefined) {
          const list = peers.get(note.peerId) ?? [];
          list.push(note);
          peers.set(note.peerId, list);
        }
      }
      for (const [peerId, list] of peers) {
        for (let start = 0; start < list.length; start += 100) {
          const batch = list.slice(start, start + 100);
          try {
            const result = await call('messages.getByConversationMessageId', {
              peer_id: peerId, conversation_message_ids: batch.map(note => note.cmid).join(','),
            }) as { items?: { conversation_message_id: number; from_id: number }[] } | null;
            for (const message of result?.items ?? []) {
              const note = batch.find(item => item.cmid === message.conversation_message_id);
              if (note) next[note.id] = { id: message.from_id };
            }
          } catch { /* Saved photos and initials remain available offline. */ }
        }
      }
      const ids = [...new Set(Object.values(next).map(author => author.id).filter((id): id is number => !!id))];
      for (const group of [ids.filter(id => id > 0), ids.filter(id => id < 0)]) {
        for (let start = 0; start < group.length; start += 100) {
          const batch = group.slice(start, start + 100);
          const users = batch[0] > 0;
          try {
            const result = await call(users ? 'users.get' : 'groups.getById', {
              [users ? 'user_ids' : 'group_ids']: batch.map(Math.abs).join(','), fields: 'photo_100',
            });
            const entries = (Array.isArray(result) ? result : (result as { groups?: unknown[] } | null)?.groups ?? []) as
              { id: number; first_name?: string; last_name?: string; name?: string; photo_100?: string }[];
            for (const entry of entries) {
              for (const author of Object.values(next)) {
                if (author.id === entry.id * (users ? 1 : -1)) {
                  author.photo = entry.photo_100;
                  author.name = entry.name ?? [entry.first_name, entry.last_name].filter(Boolean).join(' ');
                }
              }
            }
          } catch { /* Retry next time the tab opens. */ }
        }
      }
      setAuthors(prev => ({ ...prev, ...next }));
    })();
  }, [notes, hasToken, call]);
  return authors;
}
