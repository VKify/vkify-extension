import { useRef, useCallback } from 'react';
import type { RefObject } from 'react';
import { useVKifyStore } from '../../store/index.js';
import { useToast } from '../../context/ToastContext.js';
import { reloadVKTabs } from '../../utils/tabs.js';
import i18n from '@/popup/i18n.js';

export interface DataManagementHook {
  fileInputRef: RefObject<HTMLInputElement>;
  handleExport: () => Promise<void>;
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
    handleImportClick,
    handleFileChange,
    handleReset,
  };
}
