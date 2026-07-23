import { useCallback } from 'react';
import { useVKifyStore } from '../../store/index.js';
import { useSetting } from '../../store/selectors.js';
import { useToast } from '../../context/ToastContext.js';
import type { HiddenDialog } from '@/types/index.js';
import i18n from '@/popup/i18n.js';

export function useHiddenDialogs() {
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  const { showToast } = useToast();

  const hiddenDialogs: HiddenDialog[] = useSetting<HiddenDialog[] | undefined>('hidden_dialogs') ?? [];
  const hiddenIds = new Set(hiddenDialogs.map(d => String(d.id)));

  const addDialog = useCallback((userId: string, name?: string, photo?: string): boolean => {
    const cleanId = userId.trim().replace(/\D/g, '');

    if (!cleanId) {
      showToast(i18n.t('privacy:hidden.invalid_id'), 'error');
      return false;
    }
    if (hiddenIds.has(cleanId)) {
      showToast(i18n.t('privacy:hidden.already_hidden'), 'error');
      return false;
    }

    const newDialog: HiddenDialog = {
      id: cleanId,
      name: name?.trim() || `ID ${cleanId}`,
      photo,
    };
    void saveSetting('hidden_dialogs', [...hiddenDialogs, newDialog]);
    showToast(i18n.t('privacy:hidden.hidden_toast', { name: newDialog.name }), 'success');
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
    showToast(i18n.t('privacy:hidden.removed_toast'), 'success');
  }, [hiddenDialogs, saveSetting, showToast]);

  return { hiddenDialogs, hiddenIds, addDialog, toggleDialog, removeDialog };
}
