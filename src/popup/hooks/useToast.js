import { useState, useEffect, useCallback } from 'react';

const THEME_CACHE_KEY = 'vkify_theme_cache';

export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    // Начальное значение из кэша для избежания мерцания
    try {
      return localStorage.getItem(THEME_CACHE_KEY) || 'auto';
    } catch {
      return 'auto';
    }
  });
  
  const [effectiveTheme, setEffectiveTheme] = useState(() => {
    return document.documentElement.getAttribute('data-theme') || 'light';
  });

  const mediaQuery = typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-color-scheme: dark)') 
    : null;

  const getEffectiveTheme = useCallback((currentTheme) => {
    if (currentTheme === 'auto') {
      return mediaQuery?.matches ? 'dark' : 'light';
    }
    return currentTheme;
  }, [mediaQuery]);

  const applyTheme = useCallback((newTheme, animate = false) => {
    const effective = getEffectiveTheme(newTheme);
    const html = document.documentElement;

    if (animate) {
      html.style.transition = 'background-color 0.3s ease, color 0.3s ease';
      setTimeout(() => {
        html.style.transition = '';
      }, 300);
    }

    html.setAttribute('data-theme', effective);
    setEffectiveTheme(effective);
    
    // Кэшируем для быстрой загрузки
    try {
      localStorage.setItem(THEME_CACHE_KEY, newTheme);
    } catch (e) {
      console.error('Failed to cache theme:', e);
    }
  }, [getEffectiveTheme]);

  const setTheme = useCallback(async (newTheme) => {
    setThemeState(newTheme);
    applyTheme(newTheme, true);
    
    try {
      await chrome.storage.local.set({ extension_theme: newTheme });
    } catch (e) {
      console.error('Failed to save theme:', e);
    }
  }, [applyTheme]);

  const initTheme = useCallback(async () => {
    try {
      const stored = await chrome.storage.local.get('extension_theme');
      const savedTheme = stored.extension_theme || 'auto';
      setThemeState(savedTheme);
      applyTheme(savedTheme, false);
      
      // Обновляем кэш
      localStorage.setItem(THEME_CACHE_KEY, savedTheme);
    } catch (e) {
      console.error('Failed to init theme:', e);
    }
  }, [applyTheme]);

  // Слушаем изменения системной темы
  useEffect(() => {
    const handleChange = () => {
      if (theme === 'auto') {
        applyTheme('auto', true);
      }
    };

    mediaQuery?.addEventListener('change', handleChange);
    return () => mediaQuery?.removeEventListener('change', handleChange);
  }, [theme, applyTheme, mediaQuery]);

  // Слушаем изменения из storage (для синхронизации между окнами)
  useEffect(() => {
    const handleStorageChange = (changes, areaName) => {
      if (areaName === 'local' && changes.extension_theme) {
        const newTheme = changes.extension_theme.newValue;
        setThemeState(newTheme);
        applyTheme(newTheme, true);
        localStorage.setItem(THEME_CACHE_KEY, newTheme);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [applyTheme]);

  return {
    theme,
    effectiveTheme,
    setTheme,
    initTheme,
  };
}