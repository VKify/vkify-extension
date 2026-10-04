import { describe, expect, it } from 'vitest';
import { attachmentType, noteCopyText, readNotes, sameMessage } from './notes.js';
import type { PinnedNote } from '@/types/index.js';

const note: PinnedNote = { id: '1', text: '', addedAt: 1 };
describe('notes compatibility and validation', () => {
  it('reads legacy notes and rejects unsafe or malformed attachments', () => {
    expect(readNotes([note])).toEqual([note]);
    for (const attachment of [
      { type: 'image', url: 'javascript:alert(1)' }, { type: 'voice', url: 'blob:https://vk.ru/abc' },
      { type: 'other', url: 'https://cdn.test/file' }, { type: 'image', url: 'https://cdn.test/file', title: 1 }, null,
    ]) expect(readNotes([{ ...note, attachments: [attachment] }])).toEqual([]);
  });
  it('does not conflate textless files without message IDs', () => {
    const a: PinnedNote = { ...note, attachments: [{ type: 'file', url: 'https://cdn.test/a' }] };
    const b: PinnedNote = { ...note, attachments: [{ type: 'file', url: 'https://cdn.test/b' }] };
    expect(sameMessage(a, b)).toBe(false);
    expect(sameMessage(a, { ...a, id: '2' })).toBe(true);
    expect(noteCopyText({ ...a, text: 'Caption' })).toBe('Caption\nhttps://cdn.test/a');
  });
  it('detects file extensions despite signed query strings, allowing explicit type for extensionless URLs', () => {
    expect(attachmentType('https://cdn.test/a.JPG?token=1')).toBe('image');
    expect(attachmentType('https://cdn.test/a.ogg?token=1')).toBe('audio');
    expect(attachmentType('https://cdn.test/a.webm')).toBe('video');
    expect(attachmentType('https://cdn.test/download?id=1')).toBe('file');
  });
});
