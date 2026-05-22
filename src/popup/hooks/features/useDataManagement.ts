import { useRef, useCallback } from 'react';
import type { RefObject } from 'react';
import { useSettings } from '../../context/SettingsContext.js';
import { useToast } from '../../context/ToastContext.js';

export interface DataManagementHook {
  fileInputRef: RefObject<HTMLInputElement>;
  handleExport: () => Promise<void>;
  handleImportClick: () => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleReset: () => Promise<void>;
}

export function useDataManagement(): DataManagementHook {
  const { exportSettings, importSettings, resetSettings } = useSettings();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(async (): Promise<void> => {
    try {
      await exportSettings();
      showToast('Настройки экспортированы', 'success');
    } catch {
      showToast('Ошибка экспорта', 'error');
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
      success ? 'Настройки импортированы' : 'Ошибка: неверный формат файла',
      success ? 'success' : 'error'
    );
    e.target.value = '';
  }, [importSettings, showToast]);

  const handleReset = useCallback(async (): Promise<void> => {
    if (!confirm('Сбросить все настройки? Это действие нельзя отменить.')) return;

    const success = await resetSettings();
    if (success) {
      const tabs = await chrome.tabs.query({ url: '*://*.vk.com/*' });
      tabs.forEach(tab => { if (tab.id) chrome.tabs.reload(tab.id); });
      showToast('Настройки сброшены', 'success');
    } else {
      showToast('Ошибка сброса', 'error');
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