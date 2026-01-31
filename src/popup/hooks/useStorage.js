import { useState, useEffect, useCallback } from 'react';

export function useStorage(key, defaultValue = null) {
  const [value, setValue] = useState(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Загружаем значение
    chrome.storage.local.get(key).then(result => {
      setValue(result[key] ?? defaultValue);
      setLoading(false);
    });

    // Слушаем изменения
    const handleChange = (changes, areaName) => {
      if (areaName === 'local' && changes[key]) {
        setValue(changes[key].newValue);
      }
    };

    chrome.storage.onChanged.addListener(handleChange);
    return () => chrome.storage.onChanged.removeListener(handleChange);
  }, [key, defaultValue]);

  const setStorageValue = useCallback(async (newValue) => {
    try {
      await chrome.storage.local.set({ [key]: newValue });
      setValue(newValue);
      return true;
    } catch (error) {
      console.error('Storage error:', error);
      return false;
    }
  }, [key]);

  return [value, setStorageValue, loading];
}

export function useStorageUsage() {
  const [usage, setUsage] = useState({ bytes: 0, percent: 0 });

  useEffect(() => {
    const updateUsage = async () => {
      try {
        const bytes = await chrome.storage.local.getBytesInUse();
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