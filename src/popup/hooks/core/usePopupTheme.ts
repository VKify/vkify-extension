import { useState, useEffect, useCallback, useRef } from 'react';

const THEME_CACHE_KEY = 'vkify_theme_cache';

export interface PopupTheme {
  theme: string;
  effectiveTheme: string;
  setTheme: (newTheme: string) => Promise<void>;
  initTheme: () => Promise<void>;
  isDark: boolean;
}

export function usePopupTheme(): PopupTheme {
  const [theme, setThemeState] = useState<string>(() => {
    try {
      return localStorage.getItem(THEME_CACHE_KEY) || 'auto';
    } catch {
      return 'auto';
    }
  });

  const [effectiveTheme, setEffectiveTheme] = useState<string>(() => {
    return document.documentElement.getAttribute('data-theme') || 'light';
  });

  const mediaQueryRef = useRef<MediaQueryList | null>(
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null
  );

  const getEffectiveTheme = useCallback((currentTheme: string): string => {
    if (currentTheme === 'auto') {
      return mediaQueryRef.current?.matches ? 'dark' : 'light';
    }
    return currentTheme;
  }, []);

  const applyTheme = useCallback((newTheme: string, animate = false): void => {
    const effective = getEffectiveTheme(newTheme);
    const html = document.documentElement;

    if (animate) {
      html.style.transition = 'background-color 0.3s ease, color 0.3s ease';
      setTimeout(() => { html.style.transition = ''; }, 300);
    }

    html.setAttribute('data-theme', effective);
    setEffectiveTheme(effective);

    try {
      localStorage.setItem(THEME_CACHE_KEY, newTheme);
    } catch (e) {
      console.error('Failed to cache theme:', e);
    }
  }, [getEffectiveTheme]);

  const setTheme = useCallback(async (newTheme: string): Promise<void> => {
    setThemeState(newTheme);
    applyTheme(newTheme, true);

    try {
      await chrome.storage.local.set({ extension_theme: newTheme });
    } catch (e) {
      console.error('Failed to save theme:', e);
    }
  }, [applyTheme]);

  const initTheme = useCallback(async (): Promise<void> => {
    try {
      const stored = await chrome.storage.local.get('extension_theme');
      const savedTheme = (stored['extension_theme'] as string) || 'auto';
      setThemeState(savedTheme);
      applyTheme(savedTheme, false);
      localStorage.setItem(THEME_CACHE_KEY, savedTheme);
    } catch (e) {
      console.error('Failed to init theme:', e);
      applyTheme(theme, false);
    }
  }, [applyTheme, theme]);

  useEffect(() => {
    const mediaQuery = mediaQueryRef.current;
    if (!mediaQuery) return;

    const handleChange = (): void => {
      if (theme === 'auto') applyTheme('auto', true);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, applyTheme]);

  useEffect(() => {
    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ): void => {
      if (areaName === 'local' && changes['extension_theme']) {
        const newTheme = changes['extension_theme'].newValue as string;
        setThemeState(newTheme);
        applyTheme(newTheme, true);
        try { localStorage.setItem(THEME_CACHE_KEY, newTheme); } catch { /* ignore */ }
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
    isDark: effectiveTheme === 'dark',
  };
}