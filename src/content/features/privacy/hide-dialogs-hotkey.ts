import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap, HotkeyCombo } from '../../../types/index.js';

const DEFAULT_HOTKEY: HotkeyCombo = {
  ctrlKey: true, shiftKey: false, altKey: false, code: 'KeyQ', label: 'Ctrl+Q',
};

export function createHideDialogsHotkeyFeature(manager: FeatureManager): FeatureMap {
  const STORAGE_KEY = 'hide_dialogs_hotkey_active';

  const css = `
    .privacy-mode-active .ConvoList__item,
    .privacy-mode-active .VirtualScrollItem,
    .privacy-mode-active .nim-dialog {
      display: none !important;
    }
    .privacy-mode-active .ConvoList__top,
    .privacy-mode-active .ConvoList__footer,
    .privacy-mode-active .nim-tabs {
      display: none !important;
    }
    .privacy-mode-counter-hidden {
      display: none !important;
    }
    .privacy-mode-active .ConvoMain,
    .privacy-mode-active .ConvoHistory,
    .privacy-mode-active .nim-chat {
      display: none !important;
    }
    .privacy-mode-active .EmptyConvoList,
    .privacy-mode-active .ContentPlaceholder {
      display: flex !important;
    }
  `;

  let isHidden = false;
  let currentHotkey: HotkeyCombo = DEFAULT_HOTKEY;
  let keyHandler: ((e: KeyboardEvent) => void) | null = null;
  let visibilityHandler: (() => void) | null = null;
  let unsubscribe: (() => void) | null = null;
  let hotkeyUnsubscribe: (() => void) | null = null;
  let observer: MutationObserver | null = null;

  const applyHide = (): void => {
    document.querySelectorAll('.ConvoList, .MEApp, .nim-dialog-list').forEach(el => {
      el.classList.add('privacy-mode-active');
    });
    document.querySelectorAll('#l_msg .vkuiCounter__host, #l_msg [class*="Counter"], .im_nav_item .count').forEach(el => {
      el.classList.add('privacy-mode-counter-hidden');
    });
    manager.injectCSS('hide_dialogs_hotkey', css);
  };

  const applyShow = (): void => {
    document.querySelectorAll('.privacy-mode-active').forEach(el => {
      el.classList.remove('privacy-mode-active');
    });
    document.querySelectorAll('.privacy-mode-counter-hidden').forEach(el => {
      el.classList.remove('privacy-mode-counter-hidden');
    });
    manager.removeCSS('hide_dialogs_hotkey');
  };

  const toggle = async (): Promise<void> => {
    isHidden = !isHidden;
    await manager.setSetting(STORAGE_KEY, isHidden);
    if (isHidden) {
      applyHide();
    } else {
      applyShow();
    }
  };

  const startObserver = (): void => {
    if (observer) observer.disconnect();

    observer = new MutationObserver(() => {
      if (isHidden) applyHide();
    });

    observer.observe(document.body, { childList: true, subtree: true });
  };

  return {
    hide_dialogs_hotkey: {
      enable: async () => {
        // Загружаем сохранённый хоткей
        const stored = await manager.getSetting<HotkeyCombo>('hide_dialogs_hotkey_combo');
        currentHotkey = stored ?? DEFAULT_HOTKEY;

        // Слушаем изменения хоткея в реальном времени
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

        visibilityHandler = () => {
          if (document.visibilityState === 'visible' && isHidden) {
            setTimeout(applyHide, 50);
          }
        };

        document.addEventListener('keydown', keyHandler, true);
        document.addEventListener('visibilitychange', visibilityHandler);

        unsubscribe = manager.onStorageChange((key, value) => {
          if (key === STORAGE_KEY) {
            isHidden = value === true;
            if (isHidden) { applyHide(); } else { applyShow(); }
          }
        });

        startObserver();

        isHidden = (await manager.getSetting<boolean>(STORAGE_KEY)) ?? false;
        if (isHidden) applyHide();

        console.log(`[VKify] Hide dialogs ready. Hotkey: ${currentHotkey.label}`);
      },

      disable: () => {
        if (keyHandler) {
          document.removeEventListener('keydown', keyHandler, true);
          keyHandler = null;
        }
        if (visibilityHandler) {
          document.removeEventListener('visibilitychange', visibilityHandler);
          visibilityHandler = null;
        }
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        if (hotkeyUnsubscribe) { hotkeyUnsubscribe(); hotkeyUnsubscribe = null; }
        if (observer) { observer.disconnect(); observer = null; }
        applyShow();
        void manager.setSetting(STORAGE_KEY, false);
        console.log('[VKify] Hide dialogs disabled.');
      },
    },
  };
}