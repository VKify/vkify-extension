// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { buildPdfDocument } from './pdf-template.js';
import type { PeerNames, VKMessage } from './types.js';

describe('buildPdfDocument', () => {
  it('renders chat metadata, avatars and attachment previews/links', () => {
    const names: PeerNames = {
      users: new Map([[7, {
        id: 7,
        first_name: 'Анна',
        last_name: 'Иванова',
        photo_100: 'data:image/png;base64,avatar',
      }]]),
      groups: new Map(),
    };
    const messages: VKMessage[] = [{
      id: 99,
      conversation_message_id: 4,
      date: 1_700_000_000,
      from_id: 7,
      peer_id: 7,
      out: 1,
      text: 'Привет!\nВторая строка',
      attachments: [
        { type: 'photo', photo: { id: 1, owner_id: 7, sizes: [
          { type: 'x', url: 'data:image/jpeg;base64,photo', width: 640, height: 480 },
        ] } },
        { type: 'doc', doc: { id: 2, title: 'brief.pdf', url: 'https://example.com/brief.pdf' } },
        { type: 'video', video: { id: 3, owner_id: 7, title: 'Демо', image: [
          { type: 'x', url: 'data:image/jpeg;base64,video', width: 640, height: 360 },
        ] } },
      ],
    }];

    const root = buildPdfDocument('Тестовый чат', messages, names, { outReadCmid: 4 });

    expect(root.querySelector('h1')?.textContent).toBe('Тестовый чат');
    expect(root.querySelector('.pdf-author')?.textContent).toBe('Анна Иванова');
    expect(root.querySelector<HTMLImageElement>('.pdf-avatar img')?.src).toContain('data:image/png');
    expect(root.querySelectorAll('.pdf-preview')).toHaveLength(2);
    expect(root.querySelector<HTMLAnchorElement>('.pdf-attachment-link')?.href).toBe('https://example.com/brief.pdf');
    expect(root.textContent).toContain('Привет!');
    expect(root.querySelector('.pdf-status--read')?.textContent).toBe('✓✓');
  });
});
