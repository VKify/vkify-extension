// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { buildHtml } from './render.js';
import type { PeerNames, VKMessage } from './types.js';

describe('buildHtml chat template', () => {
  it('renders responsive bubbles, avatars, media, theme controls and read receipts', () => {
    const names: PeerNames = {
      users: new Map([
        [7, { id: 7, first_name: 'Анна', last_name: 'Иванова', photo_100: 'https://img.test/anna.jpg' }],
        [8, { id: 8, first_name: 'Макс', last_name: 'Петров', photo_100: 'https://img.test/max.jpg' }],
      ]),
      groups: new Map(),
    };
    const messages: VKMessage[] = [
      {
        id: 101,
        conversation_message_id: 11,
        date: 1_700_000_000,
        from_id: 7,
        peer_id: 7,
        text: 'Входящее сообщение',
      },
      {
        id: 102,
        conversation_message_id: 12,
        date: 1_700_000_060,
        from_id: 8,
        peer_id: 7,
        out: 1,
        text: 'Исходящее сообщение',
        attachments: [{
          type: 'video',
          video: {
            id: 5,
            owner_id: 8,
            title: 'Видео',
            image: [{ type: 'x', url: 'https://img.test/video.jpg', width: 640, height: 360 }],
          },
        }],
      },
    ];

    const html = buildHtml('Чат', messages, names, { outReadCmid: 12 });
    const doc = new DOMParser().parseFromString(html, 'text/html');

    expect(doc.querySelectorAll('.message')).toHaveLength(2);
    expect(doc.querySelector('.message--in .bubble__text')?.textContent).toContain('Входящее');
    expect(doc.querySelector('.message--out .delivery--read')?.textContent).toBe('✓✓');
    expect(doc.querySelectorAll('.avatar img')).toHaveLength(2);
    expect(doc.querySelector('.media__label')?.textContent).toContain('Видео');
    expect(doc.querySelector('#vkify-theme')).not.toBeNull();
    expect(doc.querySelector('meta[name="viewport"]')).not.toBeNull();
    expect(html).toContain('html[data-theme="dark"]');
    expect(html).toContain('@media (max-width:680px)');
    expect(html).toContain('--accent:#2688eb');
    expect(html).toContain('--chat:#19191a');
    expect(html).toContain('--outgoing:#dff0ff');
    expect(html).not.toContain('#d9fdd3');
    expect(html).not.toContain('.bubble::before');
  });
});
