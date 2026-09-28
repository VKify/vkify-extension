import type { Migration } from './types.js';
import { WIDGET_CATALOG, parseWidget, parsePosition, widgetKey } from '../../widget-stack.js';
export const migrateV13ToV14: Migration = {
  to: 14,
  description: 'Unify widget runtime state and preserve free positions',
  migrate(old) {
    const next = { ...old };
    const ids = new Set(WIDGET_CATALOG.map(w => w.id));
    for (const key of Object.keys(old)) {
      const match = /^(?:widgetState|widgetPosition):(.+)$/.exec(key);
      if (match) ids.add(match[1]);
    }
    for (const id of ids) {
      const legacyPosition = id === 'equalizer' ? 'equalizerPosition' : id === 'perf-widget' ? 'perfWidgetPosition' : `widgetPosition:${id}`;
      const state = parseWidget(old[`widgetState:${id}`]);
      const fallback = id === 'music-mini-player' ? parsePosition({ left: old.mini_player_left, top: old.mini_player_top }) : null;
      if (!(widgetKey(id) in old) && !(legacyPosition in old) && ['download-center', 'music_visualizer', 'music_lyrics'].includes(id)) next[`widgetPositionMigration:${id}`] = true;
      state.position = legacyPosition in old ? parsePosition(old[legacyPosition]) : fallback;
      if (!(widgetKey(id) in old)) next[widgetKey(id)] = state;
      delete next[`widgetState:${id}`]; delete next[legacyPosition];
    }
    delete next.mini_player_left; delete next.mini_player_top;
    return next;
  },
};
