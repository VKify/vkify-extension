import type { FeatureManager } from '../../../core/feature-manager.js';
import type { FeatureMap, HotkeyCombo } from '../../../../types/index.js';

const DEFAULT_HOTKEY: HotkeyCombo = {
  ctrlKey: true, shiftKey: false, altKey: false, code: 'KeyQ', label: 'Ctrl+Q',
};

// Сам стиль (hide-dialogs-hotkey.css) статичен и грузится манифестом — тут лишь
// ставим/снимаем маркер data-vkify-hide_dialogs_hotkey на <html> по хоткею.

export function createHideDialogsHotkeyFeature(manager: FeatureManager): FeatureMap {
  const STORAGE_KEY = 'hide_dialogs_hotkey_active';

  let isHidden = false;
  let currentHotkey: HotkeyCombo = DEFAULT_HOTKEY;
  let keyHandler: ((e: KeyboardEvent) => void) | null = null;
  let unsubscribe: (() => void) | null = null;
  let hotkeyUnsubscribe: (() => void) | null = null;

  const applyHide = (): void => {
    manager.enableCss('hide_dialogs_hotkey');
  };

  const applyShow = (): void => {
    manager.disableCss('hide_dialogs_hotkey');
  };

  const toggle = async (): Promise<void> => {
    isHidden = !isHidden;
    await manager.setSetting(STORAGE_KEY, isHidden);
    if (isHidden) { applyHide(); } else { applyShow(); }
  };

  return {
    hide_dialogs_hotkey: {
      enable: async () => {
        const stored = await manager.getSetting<HotkeyCombo>('hide_dialogs_hotkey_combo');
        currentHotkey = stored ?? DEFAULT_HOTKEY;

        hotkeyUnsubscribe = manager.onStorageChange((key, value) => {
          if (key === 'hide_dialogs_hotkey_combo' && value) {
            currentHotkey = value as HotkeyCombo;
          }
        });

        keyHandler = (e: KeyboardEvent) => {
          if (
            e.ctrlKey  === currentHotkey.ctrlKey  &&
            e.shiftKey === currentHotkey.shiftKey &&
            e.altKey   === currentHotkey.altKey   &&
            e.code     === currentHotkey.code
          ) {
            e.preventDefault();
            e.stopPropagation();
            void toggle();
          }
        };

        document.addEventListener('keydown', keyHandler, true);

        unsubscribe = manager.onStorageChange((key, value) => {
          if (key === STORAGE_KEY) {
            isHidden = value === true;
            if (isHidden) { applyHide(); } else { applyShow(); }
          }
        });

        isHidden = (await manager.getSetting<boolean>(STORAGE_KEY)) ?? false;
        if (isHidden) applyHide();

        console.log(`[VKify] Hide dialogs ready. Hotkey: ${currentHotkey.label}`);
      },

      disable: () => {
        if (keyHandler) {
          document.removeEventListener('keydown', keyHandler, true);
          keyHandler = null;
        }
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        if (hotkeyUnsubscribe) { hotkeyUnsubscribe(); hotkeyUnsubscribe = null; }
        applyShow();
        void manager.setSetting(STORAGE_KEY, false);
        console.log('[VKify] Hide dialogs disabled.');
      },
    },
  };
}