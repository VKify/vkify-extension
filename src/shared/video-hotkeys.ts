import type { HotkeyCombo } from '@/types/index.js';

const combo = (code: string, label: string, shiftKey = false): HotkeyCombo => ({
  ctrlKey: true, altKey: true, shiftKey, code, label,
});

// Separate from music shortcuts and VK's native single-key controls.
export const DEFAULT_VIDEO_HOTKEYS = {
  play_pause: combo('KeyK', 'Ctrl+Alt+K'),
  prev: combo('ArrowLeft', 'Ctrl+Alt+Shift+←', true),
  next: combo('ArrowRight', 'Ctrl+Alt+Shift+→', true),
  seek_backward: combo('ArrowLeft', 'Ctrl+Alt+←'),
  seek_forward: combo('ArrowRight', 'Ctrl+Alt+→'),
  volume_up: combo('ArrowUp', 'Ctrl+Alt+↑'),
  volume_down: combo('ArrowDown', 'Ctrl+Alt+↓'),
  mute: combo('KeyM', 'Ctrl+Alt+M'),
  fullscreen: combo('KeyF', 'Ctrl+Alt+F'),
  rate_up: combo('Equal', 'Ctrl+Alt+='),
  rate_down: combo('Minus', 'Ctrl+Alt+-'),
  rate_reset: combo('Digit0', 'Ctrl+Alt+0'),
};
export type VideoAction = keyof typeof DEFAULT_VIDEO_HOTKEYS;

export function isHotkeyCombo(value: unknown): value is HotkeyCombo {
  if (!value || typeof value !== 'object') return false;
  const c = value as Partial<HotkeyCombo>;
  return typeof c.code === 'string' && c.code.length > 0 && c.code.length < 64
    && typeof c.label === 'string' && c.label.length < 100
    && typeof c.ctrlKey === 'boolean' && typeof c.altKey === 'boolean'
    && typeof c.shiftKey === 'boolean';
}
