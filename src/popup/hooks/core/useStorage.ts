import { useCallback, useState, useEffect } from 'react';
import { useVKifyStore } from '../../store/index.js';
import { useSetting } from '../../store/selectors.js';

export function useStorage<T>(
  key: string,
  defaultValue: T | null = null
): [T | null, (value: T) => Promise<boolean>, boolean] {
  // Узкая подписка на один ключ: компонент ре-рендерится только когда меняется
  // именно его настройка, а не любая в сторе.
  const stored = useSetting<T | undefined>(key);
  const loading = useVKifyStore((s) => s.loading);
  const saveSetting = useVKifyStore((s) => s.saveSetting);

  const value = stored !== undefined ? stored : defaultValue;

  const setStorageValue = useCallback(
    (newValue: T) => saveSetting(key, newValue),
    [key, saveSetting]
  );

  return [value, setStorageValue, loading];
}

export interface StorageUsage {
  bytes: number;
  percent: number;
}

export function useStorageUsage(): StorageUsage {
  const [usage, setUsage] = useState<StorageUsage>({ bytes: 0, percent: 0 });

  useEffect(() => {
    const updateUsage = async (): Promise<void> => {
      try {
        const bytes = await chrome.storage.local.getBytesInUse(null);
        const quota = chrome.storage.local.QUOTA_BYTES || 5242880;
        const percent = Math.min((bytes / quota) * 100, 100);
        setUsage({ bytes, percent: parseFloat(percent.toFixed(1)) });
      } catch (error) {
        console.error('Storage usage error:', error);
      }
    };

    updateUsage();
    chrome.storage.onChanged.addListener(updateUsage);
    return () => chrome.storage.onChanged.removeListener(updateUsage);
  }, []);

  return usage;
}