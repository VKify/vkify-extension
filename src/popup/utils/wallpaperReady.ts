import { sendMessage } from '@/shared/messaging.js';

/** Wait for the foreground VK page, not the popup's independent image cache. */
export async function wallpaperReady(url: string): Promise<void> {
  if (!url) return;
  const result = await sendMessage({ type: 'WAIT_WALLPAPER_RENDER', url });
  if (!result?.ready) throw new Error('Wallpaper did not finish rendering');
}
