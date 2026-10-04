// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import SpyLogMedia, { SpyLogText } from './SpyLogMedia.js';
import { formatSpyLog } from '@/popup/utils/spyLog.js';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
it('shows saved photos, playable voice, documents and links without rendering unsafe HTML', async () => {
  const container = document.createElement('div');
  const root = createRoot(container);
  const attachments = [
    { kind: 'voice', title: 'Voice', url: 'https://psv4.vkuseraudio.net/voice.ogg' },
    { kind: 'document', title: 'Document', url: 'https://vk.com/doc/file.pdf' },
    { kind: 'link', title: 'Link', url: 'https://example.org/page' },
    { kind: 'document', title: 'Unsafe', url: 'javascript:alert(1)' },
  ];
  try {
    await act(async () => root.render(React.createElement('div', null,
      React.createElement(SpyLogText, { text: '<script>alert(1)</script> https://example.org/page' }),
      React.createElement(SpyLogMedia, { photos: ['https://sun9.userapi.com/photo.jpg'], attachments }))));
    expect(container.querySelectorAll('script')).toHaveLength(0);
    expect(container.querySelector('audio')?.getAttribute('preload')).toBe('none');
    expect(container.querySelector('img')?.getAttribute('src')).toContain('photo.jpg');
    expect(container.querySelector('a[href="https://vk.com/doc/file.pdf"]')).not.toBeNull();
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
    const exported = formatSpyLog([{ timestamp: 100, icon: 'delete', userName: 'Alice', userId: '7', action: 'deleted', extra: { text: 'Full text', photos: ['https://sun9.userapi.com/photo.jpg'], attachments } }]);
    expect(exported).toContain('Full text');
    expect(exported).toContain('Document: https://vk.com/doc/file.pdf');
    expect(exported).not.toContain('javascript:');
  } finally { await act(async () => root.unmount()); }
});
