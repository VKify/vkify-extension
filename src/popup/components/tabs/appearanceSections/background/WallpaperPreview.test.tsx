// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import WallpaperPreview from './WallpaperPreview.js';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

it('keeps feedback inside previews until media is ready and clears it on failure', async () => {
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  try {
    for (const [type, url, selector, event] of [
      ['image', 'https://sun9.userapi.com/photo.jpg', 'img', 'load'],
      ['video', 'https://sun9.userapi.com/video.mp4', 'video', 'loadedmetadata'],
    ]) {
      await act(async () => root.render(<WallpaperPreview type={type} url={url} title="Wallpaper" />));
      expect(host.querySelector('[role=status]')).not.toBeNull();
      await act(async () => host.querySelector(selector)!.dispatchEvent(new Event(event)));
      expect(host.querySelector('[role=status]')).toBeNull();
    }
    await act(async () => root.render(<WallpaperPreview type="image" url="https://sun9.userapi.com/broken.jpg" title="Wallpaper" />));
    await act(async () => host.querySelector('img')!.dispatchEvent(new Event('error')));
    expect(host.querySelector('[role=status]')).toBeNull();
    await act(async () => root.render(<WallpaperPreview title="Wallpaper" applying />));
    expect(host.querySelector('[role=status]')?.textContent).toContain('background.gallery.applying');
    await act(async () => root.render(<WallpaperPreview title="Wallpaper" />));
    expect(host.querySelector('[role=status]')).toBeNull();
  } finally { await act(async () => root.unmount()); host.remove(); }
});
