import type { FeatureManager } from '@/content/core/feature-manager.js';
import { StorageKey } from '@/shared/constants/storage-keys.js';
import type { MessageTemplate, HotkeyCombo } from '@/types/index.js';
import { DEFAULT_HOTKEY, STYLE_ID } from './constants.js';
import { createTemplatesState } from './state.js';
import { onKeyDown } from './keyboard.js';
import { closePicker } from './picker.js';

/**
 * Шаблоны сообщений: оверлей-пикер над инпутом ВК-чата с переменными
 * (%first_name%, %last_name%, %my_first_name%, %my_last_name%, %title%,
 * %peer_id%, %time%, %date%, %br%) и тремя триггерами (слэш в начале строки,
 * Ctrl+Space, опциональная автоподсказка по префиксу).
 *
 * Фича собрана из модулей: peer · variables · input · attachments · styles ·
 * state · render · overlay · picker · keyboard. Здесь — синхронизация настроек
 * и регистрация фичи.
 */
export function registerMessageTemplatesFeatures(manager: FeatureManager): void {
  const state = createTemplatesState();

  function refresh(settings: Record<string, unknown>): void {
    state.triggerSlash         = settings['message_templates_trigger_slash']        !== false;
    state.triggerHotkey        = settings['message_templates_trigger_hotkey']       !== false;
    state.hotkey               = (settings['message_templates_hotkey'] as HotkeyCombo | undefined) ?? DEFAULT_HOTKEY;
    state.triggerAutocomplete  = settings['message_templates_trigger_autocomplete'] === true;
    state.autoSend             = settings['message_templates_auto_send']            === true;
    state.templates            = (settings['message_templates'] as MessageTemplate[] | undefined) ?? [];
    const myId = Number(settings[StorageKey.VK_USER_ID]);
    state.myUserId = Number.isFinite(myId) && myId > 0 ? myId : null;
  }

  manager.register('message_templates_enabled', {
    enable: async () => {
      if (state.enabled) return;
      const settings = await manager.getAllSettings();
      refresh(settings);
      state.enabled = true;

      state.keydownHandler = (e) => onKeyDown(state, e);
      window.addEventListener('keydown', state.keydownHandler, true);

      state.storageUnsub = manager.onStorageChange((key) => {
        if (key === 'message_templates'
            || key.startsWith('message_templates_')
            || key === StorageKey.VK_USER_ID) {
          void manager.getAllSettings().then(refresh);
        }
      });

      console.log('[VKify] Message templates enabled');
    },

    disable: () => {
      if (!state.enabled) return;
      state.enabled = false;

      if (state.keydownHandler) {
        window.removeEventListener('keydown', state.keydownHandler, true);
        state.keydownHandler = null;
      }
      if (state.outsideClickHandler) {
        document.removeEventListener('mousedown', state.outsideClickHandler, true);
        state.outsideClickHandler = null;
      }
      state.storageUnsub?.();
      state.storageUnsub = null;

      closePicker(state);
      state.overlay?.remove();
      state.overlay = null;
      state.list = null;
      document.getElementById(STYLE_ID)?.remove();

      console.log('[VKify] Message templates disabled');
    },
  });
}
