/** Состояние пикера шаблонов — один экземпляр на регистрацию фичи. */

import type { MessageTemplate, HotkeyCombo } from '@/types/index.js';
import { DEFAULT_HOTKEY } from './constants.js';

export interface TemplatesState {
  enabled: boolean;
  triggerSlash: boolean;
  triggerHotkey: boolean;
  hotkey: HotkeyCombo;
  triggerAutocomplete: boolean;
  autoSend: boolean;
  templates: MessageTemplate[];
  myUserId: number | null;
  overlay: HTMLElement | null;
  list: HTMLElement | null;
  keydownHandler: ((e: KeyboardEvent) => void) | null;
  outsideClickHandler: ((e: MouseEvent) => void) | null;
  storageUnsub: (() => void) | null;
  selectedIdx: number;
  filtered: MessageTemplate[];
  pickerOpen: boolean;
  targetEl: HTMLElement | null;
}

export function createTemplatesState(): TemplatesState {
  return {
    enabled: false,
    triggerSlash: true,
    triggerHotkey: true,
    hotkey: DEFAULT_HOTKEY,
    triggerAutocomplete: false,
    autoSend: false,
    templates: [],
    myUserId: null,
    overlay: null,
    list: null,
    keydownHandler: null,
    outsideClickHandler: null,
    storageUnsub: null,
    selectedIdx: 0,
    filtered: [],
    pickerOpen: false,
    targetEl: null,
  };
}
