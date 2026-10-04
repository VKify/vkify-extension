// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { MSG_FLAG_DELETED_FOR_ALL } from './spy-events.js';

it('preserves each bulk-deleted original, its photos and its own dialog, including edits', async () => {
  const messages = [
    { peer_id: 7, from_id: 7, conversation_message_id: 1, text: 'First', attachments: [{ type: 'doc', doc: { title: 'Saved document', url: 'https://vk.com/doc/file.pdf' } }] },
    { peer_id: 7, from_id: 7, conversation_message_id: 2, text: '', attachments: [{ type: 'photo', photo: { sizes: [{ url: 'https://sun9.userapi.com/deleted.jpg', width: 100, height: 100 }] } }] },
    { peer_id: 8, from_id: 8, conversation_message_id: 1, text: 'Other dialog', attachments: [] },
  ];
  let updates: unknown[][] = [];
  const fetchMock = vi.fn(async (url: RequestInfo | URL) => new Response(JSON.stringify(String(url).includes('/method/') ? { response: { items: messages } } : { updates })));
  vi.stubGlobal('fetch', fetchMock); window.fetch = fetchMock;
  const events: { code: number; extra: { text?: string; photos?: string[] }; userId: number }[] = [];
  const listener = (event: Event) => { const detail = (event as CustomEvent).detail; if (detail.type === 'vkify-spy-event') events.push(detail.data); };
  window.addEventListener('vkify-spy-data', listener);
  try {
    await import('./spy-agent.js');
    window.dispatchEvent(new CustomEvent('vkify-spy-control', { detail: { action: 'enable', settings: { mode: 'all', trackedUsers: [], delete: true, messages: true } } }));
    await window.fetch('https://api.vk.ru/method/messages.getHistory');
    updates = [[10002, [1, 2], MSG_FLAG_DELETED_FOR_ALL, 7], [10002, 1, MSG_FLAG_DELETED_FOR_ALL, 8]];
    await window.fetch('https://api.vk.ru/gim123');
    await vi.waitFor(() => expect(events).toHaveLength(3));
    expect(events[0]).toMatchObject({ userId: 7, extra: { text: 'First', attachments: [{ kind: 'document', title: 'Saved document', url: 'https://vk.com/doc/file.pdf' }] } });
    expect(events[1]).toMatchObject({ userId: 7, extra: { photos: ['https://sun9.userapi.com/deleted.jpg'] } });
    expect(events[2]).toMatchObject({ userId: 8, extra: { text: 'Other dialog' } });
    updates = [[10004, 3, 0, 999, 7, 100, 'Old', {}, {}], [10005, 3, 0, 7, 101, 'Edited'], [10002, 3, MSG_FLAG_DELETED_FOR_ALL, 7]];
    await window.fetch('https://api.vk.ru/gim123');
    await vi.waitFor(() => expect(events).toHaveLength(6));
    expect(events[5].extra.text).toBe('Edited');
    updates = [[10004, 2, 0, 999, 7, 102, '', {}, {}], [10005, 2, 0, 7, 103, 'Caption']];
    await window.fetch('https://api.vk.ru/gim123');
    await vi.waitFor(() => expect(events).toHaveLength(8));
    expect(events[6].extra.photos).toEqual(['https://sun9.userapi.com/deleted.jpg']);
    expect(events[7].extra.photos).toEqual(['https://sun9.userapi.com/deleted.jpg']);
  } finally { window.removeEventListener('vkify-spy-data', listener); vi.unstubAllGlobals(); }
});
