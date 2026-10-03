import { useRef, useCallback, useState } from 'react';
import { sendMessage } from '@/shared/messaging.js';
import { TokenStatus } from '@/types/index.js';
import type { RefObject } from 'react';
import { useVKifyStore } from '../../store/index.js';
import { useToast } from '../../context/ToastContext.js';
import { reloadVKTabs } from '../../utils/tabs.js';
import i18n from '@/popup/i18n.js';

export interface DataManagementHook {
  fileInputRef: RefObject<HTMLInputElement>;
  handleExport: () => Promise<void>;
  handleSaveToVK: () => Promise<void>;
  savingToVK: boolean;
  savedDocumentUrl: string | null;
  handleImportClick: () => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleReset: () => Promise<void>;
}

export function useDataManagement(): DataManagementHook {
  const exportSettings = useVKifyStore((s) => s.exportSettings);
  const importSettings = useVKifyStore((s) => s.importSettings);
  const resetSettings = useVKifyStore((s) => s.resetSettings);
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveInProgress = useRef(false);
  const [savingToVK, setSavingToVK] = useState(false);
  const [savedDocumentUrl, setSavedDocumentUrl] = useState<string | null>(null);

  const handleSaveToVK = useCallback(async (): Promise<void> => {
    if (saveInProgress.current || useVKifyStore.getState().loading) return;
    saveInProgress.current = true;
    setSavingToVK(true);
    setSavedDocumentUrl(null);
    try {
      const result = await sendMessage({ type: 'SAVE_SETTINGS_DOCUMENT', settings: useVKifyStore.getState().settings });
      if (!result?.success || !result.url) {
        const code = result?.code;
        const key = code === TokenStatus.NO_TOKEN || code === TokenStatus.NO_VK_TAB || code === 'TOKEN_EXPIRED' || code === TokenStatus.EXPIRED
          ? 'vk_auth_required' : code === '15' || code === '7' ? 'vk_access_denied'
          : code === 'ACCOUNT_CHANGED' ? 'vk_account_changed' : 'vk_save_failed';
        showToast(i18n.t(`settings:more.data.toast.${key}`), 'error');
        return;
      }
      setSavedDocumentUrl(result.url);
      showToast(i18n.t('settings:more.data.toast.vk_saved'), 'success');
    } catch {
      showToast(i18n.t('settings:more.data.toast.vk_save_failed'), 'error');
    } finally {
      saveInProgress.current = false;
      setSavingToVK(false);
    }
  }, [showToast]);

  const handleExport = useCallback(async (): Promise<void> => {
    try {
      await exportSettings();
      showToast(i18n.t('settings:more.data.toast.exported'), 'success');
    } catch {
      showToast(i18n.t('settings:more.data.toast.export_failed'), 'error');
    }
  }, [exportSettings, showToast]);

  const handleImportClick = useCallback((): void => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    const success = await importSettings(file);
    showToast(
      i18n.t(success ? 'settings:more.data.toast.imported' : 'settings:more.data.toast.invalid_file'),
      success ? 'success' : 'error'
    );
    e.target.value = '';
  }, [importSettings, showToast]);

  const handleReset = useCallback(async (): Promise<void> => {
    if (!confirm(i18n.t('settings:confirm_reset_all'))) return;

    const success = await resetSettings();
    if (success) {
      reloadVKTabs();
      showToast(i18n.t('settings:more.data.toast.reset'), 'success');
    } else {
      showToast(i18n.t('settings:more.data.toast.reset_failed'), 'error');
    }
  }, [resetSettings, showToast]);

  return {
    fileInputRef,
    handleExport,
    handleSaveToVK,
    savingToVK,
    savedDocumentUrl,
    handleImportClick,
    handleFileChange,
    handleReset,
  };
}
