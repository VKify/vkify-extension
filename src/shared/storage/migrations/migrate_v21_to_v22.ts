import { isHotkeyCombo } from '../../video-hotkeys.js';
import type { Migration } from './types.js';

// Freeze this version's defaults: later shortcut changes must not rewrite v22.
const shortcuts = [
  ['play_pause', 'KeyK', 'Ctrl+Alt+K', false],
  ['prev', 'ArrowLeft', 'Ctrl+Alt+Shift+←', true],
  ['next', 'ArrowRight', 'Ctrl+Alt+Shift+→', true],
  ['seek_backward', 'ArrowLeft', 'Ctrl+Alt+←', false],
  ['seek_forward', 'ArrowRight', 'Ctrl+Alt+→', false],
  ['volume_up', 'ArrowUp', 'Ctrl+Alt+↑', false],
  ['volume_down', 'ArrowDown', 'Ctrl+Alt+↓', false],
  ['mute', 'KeyM', 'Ctrl+Alt+M', false],
  ['fullscreen', 'KeyF', 'Ctrl+Alt+F', false],
  ['rate_up', 'Equal', 'Ctrl+Alt+=', false],
  ['rate_down', 'Minus', 'Ctrl+Alt+-', false],
  ['rate_reset', 'Digit0', 'Ctrl+Alt+0', false],
] as const;

export const migrateV21ToV22: Migration = {
  to: 22,
  description: 'Initialize video shortcuts and preserve video ad blocking preferences',
  migrate(old) {
    const next = { ...old };
    if (typeof next.video_player_hotkeys !== 'boolean') next.video_player_hotkeys = false;
    if (typeof next.block_recommendations_video !== 'boolean') next.block_recommendations_video = true;
    for (const [action, code, label, shiftKey] of shortcuts) {
      const key = `video_hotkey_${action}`;
      if (!isHotkeyCombo(next[key])) {
        next[key] = { ctrlKey: true, altKey: true, shiftKey, code, label };
      }
    }
    return next;
  },
};
