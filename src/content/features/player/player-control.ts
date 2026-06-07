import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap, HotkeyCombo } from '../../../types/index.js';
import { InjectedScript } from '../../core/injected-scripts.js';
import { dispatchPageEvent } from '../../utils/page-event.js';

export interface MediaHotkeys {
  play_pause:    HotkeyCombo;
  next:          HotkeyCombo;
  prev:          HotkeyCombo;
  seek_forward:  HotkeyCombo;
  seek_backward: HotkeyCombo;
  rate_up:       HotkeyCombo;
  rate_down:     HotkeyCombo;
  rate_reset:    HotkeyCombo;
}

export const DEFAULT_MEDIA_HOTKEYS: MediaHotkeys = {
  play_pause:    { ctrlKey: false, shiftKey: false, altKey: true, code: 'KeyP',       label: 'Alt+P'         },
  next:          { ctrlKey: false, shiftKey: false, altKey: true, code: 'ArrowRight', label: 'Alt+→'         },
  prev:          { ctrlKey: false, shiftKey: false, altKey: true, code: 'ArrowLeft',  label: 'Alt+←'         },
  seek_forward:  { ctrlKey: false, shiftKey: true,  altKey: true, code: 'ArrowRight', label: 'Alt+Shift+→'   },
  seek_backward: { ctrlKey: false, shiftKey: true,  altKey: true, code: 'ArrowLeft',  label: 'Alt+Shift+←'   },
  rate_up:       { ctrlKey: false, shiftKey: false, altKey: true, code: 'Equal',      label: 'Alt+='         },
  rate_down:     { ctrlKey: false, shiftKey: false, altKey: true, code: 'Minus',      label: 'Alt+-'         },
  rate_reset:    { ctrlKey: false, shiftKey: false, altKey: true, code: 'Digit0',     label: 'Alt+0'         },
};

const STORAGE_KEYS: Record<keyof MediaHotkeys, string> = {
  play_pause:    'media_hotkey_play_pause',
  next:          'media_hotkey_next',
  prev:          'media_hotkey_prev',
  seek_forward:  'media_hotkey_seek_forward',
  seek_backward: 'media_hotkey_seek_backward',
  rate_up:       'media_hotkey_rate_up',
  rate_down:     'media_hotkey_rate_down',
  rate_reset:    'media_hotkey_rate_reset',
};

function matchesHotkey(e: KeyboardEvent, combo: HotkeyCombo): boolean {
  return (
    e.ctrlKey  === combo.ctrlKey  &&
    e.shiftKey === combo.shiftKey &&
    e.altKey   === combo.altKey   &&
    e.code     === combo.code
  );
}

function isTyping(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el.isContentEditable
  );
}

export function createMediaPlayerFeature(manager: FeatureManager): FeatureMap {
  let active = false;
  let hotkeys: MediaHotkeys = { ...DEFAULT_MEDIA_HOTKEYS };
  let unsubscribe: (() => void) | null = null;

  const handleKeydown = (e: KeyboardEvent): void => {
    if (isTyping()) return;

    for (const [action, combo] of Object.entries(hotkeys) as [keyof MediaHotkeys, HotkeyCombo][]) {
      if (matchesHotkey(e, combo)) {
        e.preventDefault();
        e.stopPropagation();
        dispatchPageEvent('vkify:player:action', { action });
        return;
      }
    }
  };

  return {
    media_player_hotkeys: {
      enable: async () => {
        if (active) return;

        manager.injectScript(InjectedScript.PLAYER_CONTROL);

        for (const [action, storageKey] of Object.entries(STORAGE_KEYS) as [keyof MediaHotkeys, string][]) {
          const saved = await manager.getSetting<HotkeyCombo>(storageKey);
          if (saved) hotkeys[action] = saved;
        }

        unsubscribe = manager.onStorageChange((key, value) => {
          for (const [action, storageKey] of Object.entries(STORAGE_KEYS) as [keyof MediaHotkeys, string][]) {
            if (key === storageKey && value) {
              hotkeys[action] = value as HotkeyCombo;
            }
          }
        });

        document.addEventListener('keydown', handleKeydown, true);
        active = true;
        console.log('[VKify] media_player_hotkeys: enabled');
      },
      disable: () => {
        document.removeEventListener('keydown', handleKeydown, true);
        unsubscribe?.();
        unsubscribe = null;
        active = false;
        console.log('[VKify] media_player_hotkeys: disabled');
      },
    },
  };
}