import { useCallback } from 'react';
import { useSettings } from '../../context/SettingsContext.js';
import { useToast } from '../../context/ToastContext.js';
import type { HiddenDialog } from '@/types/index.js';

export function useHiddenDialogs() {
  const { settings, saveSetting } = useSettings();
  const { showToast } = useToast();

  const hiddenDialogs: HiddenDialog[] = (settings['hidden_dialogs'] as HiddenDialog[] | undefined) ?? [];
  const hiddenIds = new Set(hiddenDialogs.map(d => String(d.id)));

  const addDialog = useCallback((userId: string, name?: string, photo?: string): boolean => {
    const cleanId = userId.trim().replace(/\D/g, '');

    if (!cleanId) {
      showToast('Некорректный ID', 'error');
      return false;
    }
    if (hiddenIds.has(cleanId)) {
      showToast('Пользователь уже скрыт', 'error');
      return false;
    }

    const newDialog: HiddenDialog = {
      id: cleanId,
      name: name?.trim() || `ID ${cleanId}`,
      photo,
    };
    void saveSetting('hidden_dialogs', [...hiddenDialogs, newDialog]);
    showToast(`${newDialog.name} скрыт`, 'success');
    return true;
  }, [hiddenDialogs, hiddenIds, saveSetting, showToast]);

  const toggleDialog = useCallback((id: string, name: string, photo?: string): void => {
    const stringId = String(id);

    if (hiddenIds.has(stringId)) {
      void saveSetting(
        'hidden_dialogs',
        hiddenDialogs.filter(d => String(d.id) !== stringId),
      );
    } else {
      const newDialog: HiddenDialog = { id: stringId, name, photo };
      void saveSetting('hidden_dialogs', [...hiddenDialogs, newDialog]);
    }
  }, [hiddenDialogs, hiddenIds, saveSetting]);

  const removeDialog = useCallback((userId: string): void => {
    void saveSetting(
      'hidden_dialogs',
      hiddenDialogs.filter(d => String(d.id) !== String(userId)),
    );
    showToast('Диалог удалён из скрытых', 'success');
  }, [hiddenDialogs, saveSetting, showToast]);

  return { hiddenDialogs, hiddenIds, addDialog, toggleDialog, removeDialog };
}