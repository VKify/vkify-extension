import { useEffect, useRef } from 'react';
import type { Font } from '@/popup/constants/appearance.js';

/** Сколько шрифтов показываем до нажатия «Показать ещё». */
export const INITIAL_DISPLAY_COUNT = 9;

const GOOGLE_FONTS_API = 'https://fonts.googleapis.com/css2';
const POPUP_FONTS_LINK_ID = 'vkify-popup-fonts';

function buildGoogleFontsUrl(fonts: Font[]): string | null {
  const families = fonts
    .filter(f => f.google)
    .map(f => `family=${f.google ?? ''}`)
    .join('&');

  if (!families) return null;
  return `${GOOGLE_FONTS_API}?${families}&display=swap`;
}

/** Подгружает Google-шрифты в попап один раз, чтобы превью карточек были живыми. */
export function useFontPreloader(fonts: Font[]): void {
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    const fontsWithGoogle = fonts.filter(f => f.google);
    if (fontsWithGoogle.length === 0) return;

    const url = buildGoogleFontsUrl(fontsWithGoogle);
    if (!url) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.id = POPUP_FONTS_LINK_ID;

    const existing = document.getElementById(POPUP_FONTS_LINK_ID);
    if (existing) existing.remove();

    document.head.appendChild(link);

    return () => {
      const linkToRemove = document.getElementById(POPUP_FONTS_LINK_ID);
      if (linkToRemove) linkToRemove.remove();
    };
  }, [fonts]);
}

/** CSS font-family для превью карточки (с учётом системных/кастомных шрифтов). */
export function getFontFamilyForPreview(font: Font): string {
  if (!font) return 'inherit';
  if (font.id === 'default') return 'inherit';
  if (font.id === 'system') return '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (font.value) return font.value;

  const fallback = font.serif ? 'serif' : font.mono ? 'monospace' : 'sans-serif';
  return `"${font.name}", ${fallback}`;
}
