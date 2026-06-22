import { useState, useEffect, useCallback, useRef } from 'react';
import { StorageKey } from '@/shared/constants/storage-keys.js';
import {
  applyPopupTheme, buildPopupPalette, normalizeHex, POPUP_PALETTE_VARS,
  CUSTOM_THEME_CACHE, CUSTOM_ACCENT_CACHE,
} from '../../utils/themePalette.js';

const VK_SCHEME_CACHE_KEY = 'vkify_vk_scheme_cache';
const ACCENT_VARS = [
  '--primary', '--primary-rgb', '--primary-strong', '--primary-hover', '--primary-light',
] as const;

export interface PopupTheme {
  /** Текущая светлая/тёмная схема окна. */
  scheme: 'dark' | 'light';
  isDark: boolean;
  initTheme: () => Promise<void>;
}

/**
 * Тема окна расширения. Единственный владелец оформления попапа: окно ВСЕГДА
 * повторяет сайт.
 *  • Если выбрана цветовая тема (settings.custom_theme) — окно красится в её
 *    палитру (Everforest, Dracula, AMOLED…).
 *  • Если темы нет — окно следует светлой/тёмной схеме VK (или системной как
 *    запасной вариант).
 *
 * Отдельного переключателя темы окна нет — он убран, чтобы не дублировать выбор
 * темы сайта во вкладке «Вид».
 */
export function usePopupTheme(): PopupTheme {
  const [isDark, setIsDark] = useState<boolean>(
    () => (document.documentElement.getAttribute('data-theme') || 'light') === 'dark',
  );

  const mediaQueryRef = useRef<MediaQueryList | null>(
    typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null,
  );

  // Схема VK ('dark'|'light'), которую пишет content-script. Кэшируем в
  // localStorage, чтобы применять мгновенно при открытии, без вспышки.
  const vkSchemeRef = useRef<string | null>(
    (() => { try { return localStorage.getItem(VK_SCHEME_CACHE_KEY); } catch { return null; } })(),
  );
  const customThemeRef = useRef<string | null>(null);
  const customAccentRef = useRef<string | null>(null);

  const systemScheme = (): 'dark' | 'light' => (mediaQueryRef.current?.matches ? 'dark' : 'light');

  const apply = useCallback((animate = false): void => {
    const root = document.documentElement;
    if (animate) {
      root.style.transition = 'background-color 0.3s ease, color 0.3s ease';
      setTimeout(() => { root.style.transition = ''; }, 300);
    }

    const bg = normalizeHex(customThemeRef.current);
    const accent = normalizeHex(customAccentRef.current);

    // 1) Есть цветовая тема — красим окно в её палитру.
    if (bg) {
      applyPopupTheme(root, bg, accent ?? '#0077ff');
      setIsDark(buildPopupPalette(bg, accent ?? '#0077ff').isDark);
      try {
        localStorage.setItem(CUSTOM_THEME_CACHE, bg);
        if (accent) localStorage.setItem(CUSTOM_ACCENT_CACHE, accent);
        else localStorage.removeItem(CUSTOM_ACCENT_CACHE);
      } catch { /* ignore */ }
      return;
    }

    // 2) Темы нет — снимаем палитру и следуем светлой/тёмной схеме VK.
    for (const k of POPUP_PALETTE_VARS) root.style.removeProperty(k);
    root.removeAttribute('data-vkify-themed');
    try { localStorage.removeItem(CUSTOM_THEME_CACHE); } catch { /* ignore */ }

    if (accent) {
      // Свой акцент без темы — переопределяем только акцентные переменные.
      const { vars } = buildPopupPalette('#000000', accent);
      for (const k of ACCENT_VARS) root.style.setProperty(k, vars[k]);
    } else {
      for (const k of ACCENT_VARS) root.style.removeProperty(k);
    }

    const scheme = (vkSchemeRef.current as 'dark' | 'light' | null) ?? systemScheme();
    root.setAttribute('data-theme', scheme);
    setIsDark(scheme === 'dark');
  }, []);

  const initTheme = useCallback(async (): Promise<void> => {
    try {
      const stored = await chrome.storage.local.get([
        StorageKey.VK_SCHEME, 'custom_theme', 'custom_accent',
      ]);
      const vkScheme = stored[StorageKey.VK_SCHEME] as string | undefined;
      if (vkScheme) {
        vkSchemeRef.current = vkScheme;
        try { localStorage.setItem(VK_SCHEME_CACHE_KEY, vkScheme); } catch { /* ignore */ }
      }
      customThemeRef.current = (stored['custom_theme'] as string) ?? null;
      customAccentRef.current = (stored['custom_accent'] as string) ?? null;
      apply(false);
    } catch (e) {
      console.error('Failed to init theme:', e);
      apply(false);
    }
  }, [apply]);

  // Системная схема — влияет только когда нет ни темы, ни известной схемы VK.
  useEffect(() => {
    const mq = mediaQueryRef.current;
    if (!mq) return;
    const handleChange = (): void => {
      if (!normalizeHex(customThemeRef.current) && !vkSchemeRef.current) apply(true);
    };
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, [apply]);

  // Изменения в storage: схема VK и цветовая тема/акцент сайта.
  useEffect(() => {
    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ): void => {
      if (areaName !== 'local') return;
      let dirty = false;

      if (changes[StorageKey.VK_SCHEME]) {
        const scheme = changes[StorageKey.VK_SCHEME].newValue as string | undefined;
        vkSchemeRef.current = scheme ?? null;
        try { if (scheme) localStorage.setItem(VK_SCHEME_CACHE_KEY, scheme); } catch { /* ignore */ }
        dirty = true;
      }
      if (changes['custom_theme']) {
        customThemeRef.current = (changes['custom_theme'].newValue as string) ?? null;
        dirty = true;
      }
      if (changes['custom_accent']) {
        customAccentRef.current = (changes['custom_accent'].newValue as string) ?? null;
        dirty = true;
      }

      if (dirty) apply(true);
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [apply]);

  return { scheme: isDark ? 'dark' : 'light', isDark, initTheme };
}
