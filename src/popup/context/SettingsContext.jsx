import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  // Загрузка настроек при старте
  useEffect(() => {
    loadSettings();
    
    // Слушаем изменения storage
    const handleStorageChange = (changes, areaName) => {
      if (areaName === 'local') {
        setSettings(prev => {
          const updated = { ...prev };
          for (const [key, { newValue }] of Object.entries(changes)) {
            updated[key] = newValue;
          }
          return updated;
        });
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const loadSettings = async () => {
    try {
      const result = await chrome.storage.local.get(null);
      setSettings(result);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSetting = useCallback(async (key, value) => {
    try {
      // Сначала обновляем локальный стейт для мгновенного UI
      setSettings(prev => ({ ...prev, [key]: value }));
      
      // Затем сохраняем в storage
      await chrome.storage.local.set({ [key]: value });

      // Уведомляем content script
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url?.includes('vk.com')) {
        chrome.tabs.sendMessage(tab.id, {
          type: value ? 'ENABLE_FEATURE' : 'DISABLE_FEATURE',
          featureId: key,
          value: value
        }).catch(() => {});
      }

      return true;
    } catch (error) {
      console.error('Error saving setting:', error);
      // Откатываем при ошибке
      await loadSettings();
      return false;
    }
  }, []);

  const saveMultiple = useCallback(async (items) => {
    try {
      // Сначала обновляем локальный стейт
      setSettings(prev => ({ ...prev, ...items }));
      
      // Затем сохраняем в storage
      await chrome.storage.local.set(items);

      // Уведомляем content script о каждом изменении
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url?.includes('vk.com')) {
        for (const [key, value] of Object.entries(items)) {
          chrome.tabs.sendMessage(tab.id, {
            type: value ? 'ENABLE_FEATURE' : 'DISABLE_FEATURE',
            featureId: key,
            value: value
          }).catch(() => {});
        }
      }

      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      await loadSettings();
      return false;
    }
  }, []);

  const resetSettings = useCallback(async () => {
    try {
      await chrome.storage.local.clear();
      const defaults = {
        block_left_ads: true,
        block_feed_ads: true,
        extension_theme: 'auto'
      };
      await chrome.storage.local.set(defaults);
      setSettings(defaults);
      return true;
    } catch (error) {
      console.error('Error resetting settings:', error);
      return false;
    }
  }, []);

  const exportSettings = useCallback(async () => {
    const exportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      settings: settings
    };
    
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `vkify-settings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [settings]);

  const importSettings = useCallback(async (file) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const newSettings = data.settings || data;

      if (typeof newSettings !== 'object') {
        throw new Error('Invalid settings format');
      }

      await chrome.storage.local.clear();
      await chrome.storage.local.set(newSettings);
      setSettings(newSettings);

      // Перезагружаем VK вкладки
      const tabs = await chrome.tabs.query({ url: '*://*.vk.com/*' });
      for (const tab of tabs) {
        chrome.tabs.reload(tab.id);
      }

      return true;
    } catch (error) {
      console.error('Import error:', error);
      return false;
    }
  }, []);

  const value = {
    settings,
    loading,
    saveSetting,
    saveMultiple,
    resetSettings,
    exportSettings,
    importSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}