/** Константы фичи шаблонов: дефолтный хоткей, IDs, peer-offset. */

import type { HotkeyCombo } from '@/types/index.js';

export const DEFAULT_HOTKEY: HotkeyCombo = {
  ctrlKey: true, shiftKey: false, altKey: false, code: 'Space', label: 'Ctrl+Space',
};

// peer_id для бесед: VK кодирует их как 2 000 000 000 + chat_id.
export const CHAT_PEER_OFFSET = 2_000_000_000;

export const STYLE_ID = 'vkify-templates-picker-styles';
export const ROOT_ID  = 'vkify-templates-picker';
