import { storage } from '@/content/core/storage.js';
import { parsePosition, parseWidget, widgetKey } from '@/shared/widget-stack.js';

/** Complete v14 migration in the only context that can read the old page storage. */
export async function migratePageWidgetPosition(id: string): Promise<void> {
  const legacyKeys: Record<string, string> = {
    'download-center': 'vkify:dlcenter:pos',
    music_visualizer: 'vkify-music_visualizer-widget',
    music_lyrics: 'vkify-music_lyrics-widget',
  };
  const legacy = legacyKeys[id];
  if (!legacy) return;
  const marker = `widgetPositionMigration:${id}`;
  const values = await storage.getMultiple([widgetKey(id), marker]);
  if (!values[marker]) return;
  let position;
  try { position = parsePosition(JSON.parse(localStorage.getItem(legacy) ?? 'null')); }
  catch { position = null; }
  const state = parseWidget(values[widgetKey(id)]);
  if (position && !state.position) await storage.set(widgetKey(id), { ...state, position });
  await storage.remove(marker);
}
