import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PinnedNote } from '@/types/index.js';
import { StorageKey } from '@/shared/constants/storage-keys.js';
import { MAX_NOTES } from '@/shared/notes.js';
import { mutateNotes } from './notes.js';

let stored: PinnedNote[];
const write = vi.fn(async (data: Record<string, PinnedNote[]>) => { stored = structuredClone(data[StorageKey.VKIFY_NOTES]); });
vi.stubGlobal('chrome', { storage: { local: {
  get: vi.fn(async () => ({ [StorageKey.VKIFY_NOTES]: structuredClone(stored) })), set: write,
} } });
const note = (id: number, extra: Partial<PinnedNote> = {}): PinnedNote => ({
  id: String(id), text: 'Same text', peerId: 1, cmid: id, addedAt: id, ...extra,
});

beforeEach(() => { stored = []; write.mockClear(); });
describe('shared notes mutations', () => {
  it('preserves both messages saved concurrently from different content tabs', async () => {
    await Promise.all([mutateNotes({ action: 'append', note: note(1) }), mutateNotes({ action: 'append', note: note(2) })]);
    expect(stored.map(n => n.id)).toEqual(['1', '2']);
  });
  it('deduplicates the same message after editing but preserves identical text in separate messages', async () => {
    await mutateNotes({ action: 'append', note: note(1) });
    await mutateNotes({ action: 'append', note: note(1, { id: 'duplicate', text: 'Edited' }) });
    await mutateNotes({ action: 'append', note: note(2) });
    expect(stored.map(n => n.id)).toEqual(['1', '2']);
  });
  it('deletes one note while retaining a concurrent new save', async () => {
    stored = [note(1), note(2)];
    await Promise.all([mutateNotes({ action: 'delete', id: '1' }), mutateNotes({ action: 'append', note: note(3) })]);
    expect(stored.map(n => n.id)).toEqual(['2', '3']);
  });
  it('recovers the queue after a failed write and leaves existing notes intact', async () => {
    stored = [note(1)];
    write.mockRejectedValueOnce(new Error('Quota exceeded'));
    await expect(mutateNotes({ action: 'delete', id: '1' })).rejects.toThrow('Quota exceeded');
    await mutateNotes({ action: 'append', note: note(2) });
    expect(stored.map(n => n.id)).toEqual(['1', '2']);
  });
  it('keeps the newest notes within the existing archive limit', async () => {
    stored = Array.from({ length: MAX_NOTES }, (_, i) => note(i + 1));
    await mutateNotes({ action: 'append', note: note(MAX_NOTES + 1) });
    expect(stored).toHaveLength(MAX_NOTES);
    expect(stored[0].id).toBe('2');
  });
});
