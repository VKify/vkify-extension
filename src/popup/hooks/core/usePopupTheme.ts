import { useState, useEffect, useCallback, useRef } from 'react';
import { StorageKey } from '../../../shared/constants/storage-keys.js';

const THEME_CACHE_KEY = 'vkify_theme_cache';
const VK_SCHEME_CACHE_KEY = 'vkify_vk_scheme_cache';

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

  // Схема VK ('dark'|'light'), которую пишет content-script. Кэшируем в
  // localStorage, чтобы режим «Как в ВК» применялся мгновенно при открытии,
  // без вспышки до чтения chrome.storage.
  const vkSchemeRef = useRef<string | null>(
    (() => { try { return localStorage.getItem(VK_SCHEME_CACHE_KEY); } catch { return null; } })(),
  );
  // Актуальный выбранный режим — для слушателей storage/matchMedia без устаревших замыканий.
  const themeRef = useRef<string>(theme);
  useEffect(() => { themeRef.current = theme; }, [theme]);

  const systemScheme = (): string => (mediaQueryRef.current?.matches ? 'dark' : 'light');

  const getEffectiveTheme = useCallback((currentTheme: string): string => {
    if (currentTheme === 'vk') return vkSchemeRef.current ?? systemScheme();
    if (currentTheme === 'auto') return systemScheme();
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
      const stored = await chrome.storage.local.get(['extension_theme', StorageKey.VK_SCHEME]);
      const vkScheme = stored[StorageKey.VK_SCHEME] as string | undefined;
      if (vkScheme) {
        vkSchemeRef.current = vkScheme;
        try { localStorage.setItem(VK_SCHEME_CACHE_KEY, vkScheme); } catch { /* ignore */ }
      }
      // Дефолт — следовать теме VK, чтобы окно и сайт были в едином стиле.
      const savedTheme = (stored['extension_theme'] as string) || 'vk';
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
      // Системная схема влияет на 'auto' и на 'vk' без известной схемы VK (фолбэк).
      if (themeRef.current === 'auto' || themeRef.current === 'vk') {
        applyTheme(themeRef.current, true);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [applyTheme]);

  useEffect(() => {
    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ): void => {
      if (areaName !== 'local') return;

      if (changes['extension_theme']) {
        const newTheme = changes['extension_theme'].newValue as string;
        setThemeState(newTheme);
        applyTheme(newTheme, true);
        try { localStorage.setItem(THEME_CACHE_KEY, newTheme); } catch { /* ignore */ }
      }

      // Схема VK поменялась (пользователь переключил тему на сайте) — обновляем
      // окно, если оно следует за VK.
      if (changes[StorageKey.VK_SCHEME]) {
        const scheme = changes[StorageKey.VK_SCHEME].newValue as string | undefined;
        vkSchemeRef.current = scheme ?? null;
        try { if (scheme) localStorage.setItem(VK_SCHEME_CACHE_KEY, scheme); } catch { /* ignore */ }
        if (themeRef.current === 'vk') applyTheme('vk', true);
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