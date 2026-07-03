/**
 * Генерация палитры попапа из выбранной VK-темы.
 *
 * Пользователь выбирает тему во вкладке «Вид» (settings.custom_theme — hex фона,
 * settings.custom_accent — hex акцента). Контент-скрипт применяет её к vk.com;
 * здесь мы строим аналогичный набор CSS-переменных для самого окна расширения,
 * чтобы попап визуально совпадал с сайтом.
 *
 * Переменные совпадают с теми, что объявлены в src/popup/index.css.
 */

// Конвертеры цвета вынесены в ./color.ts (единая реализация для всего попапа,
// в т.ч. для кастомного color picker). normalizeHex реэкспортируется ради
// существующих импортов из этого модуля (usePopupTheme и др.).
import { clamp, hexToHsl, hslToHex, hexToRgbChannels, normalizeHex } from './color.js';
export { normalizeHex };

/** Все CSS-переменные, которыми управляет тема попапа (для сброса). */
export const POPUP_PALETTE_VARS = [
  '--bg-primary',
  '--bg-secondary',
  '--bg-tertiary',
  '--text-primary',
  '--text-secondary',
  '--text-tertiary',
  '--border-color',
  '--primary',
  '--primary-rgb',
  '--primary-strong',
  '--primary-hover',
  '--primary-light',
] as const;

/**
 * Подбирает гармоничный акцент под выбранный пипеткой цвет темы.
 *
 * Правила (переработано: прежняя версия глушила насыщенность и уводила
 * светлоту в крайности — акцент выходил почти белым/чёрным):
 *  • ОТТЕНОК сохраняется 1:1 — акцент всегда «того же цвета», что тема:
 *    жёлтый → тёмно-жёлтый (горчичный), красный → бордовый, синий → тёмно-синий.
 *  • НАСЫЩЕННОСТЬ остаётся сочной: лёгкое приглушение от исходной (×0.85),
 *    но не ниже 45% и не выше 78% — глубокий цвет без неона.
 *  • СВЕТЛОТА подбирается под тему: на светлой — «глубокая» тёмная зона
 *    (~26–45), на тёмной — приподнятый сочный тон (~55–78). Отрыв от фона
 *    по светлоте ≥ ~26 пунктов, чтобы акцент читался, но без крайностей
 *    почти-белого/почти-чёрного.
 *  • Почти белый / почти чёрный / серый фон (хромы нет) → нейтральный акцент:
 *    тёмно-серый на светлом, светло-серый на тёмном.
 *
 * Возвращает `#rrggbb` либо `null`, если на входе не валидный hex-цвет.
 */
export function deriveAccentFromBg(bgHex: string): string | null {
  const hex = normalizeHex(bgHex);
  if (!hex) return null;

  const { h, s, l } = hexToHsl(hex);
  const isDark = l < 50;

  // Нейтральный вход (белый/чёрный/серый) — нейтральный акцент без оттенка.
  if (s < 10) return hslToHex(h, 0, isDark ? 72 : 28);

  const accentSat = clamp(Math.round(s * 0.85), 45, 78);
  const accentLig = isDark
    ? clamp(Math.max(60, l + 26), 55, 78)   // тёмная тема → светлее фона, но не белёсый
    : clamp(Math.min(38, l - 26), 26, 45);  // светлая тема → глубокий тёмный тон

  return hslToHex(h, accentSat, accentLig);
}

export interface PopupPalette {
  isDark: boolean;
  vars: Record<string, string>;
}

// Кэш выбранной темы в localStorage — чтобы применить палитру синхронно при
// загрузке окна (до чтения chrome.storage), без вспышки дефолтного фона.
export const CUSTOM_THEME_CACHE = 'vkify_custom_theme_cache';
export const CUSTOM_ACCENT_CACHE = 'vkify_custom_accent_cache';

/** Накладывает палитру темы на элемент (обычно documentElement). */
export function applyPopupTheme(root: HTMLElement, bgHex: string, accentHex: string): void {
  const { vars, isDark } = buildPopupPalette(bgHex, accentHex);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.setAttribute('data-theme', isDark ? 'dark' : 'light');
  root.setAttribute('data-vkify-themed', '1');
}

/** Синхронно применяет тему из кэша при старте окна (вызывается до рендера). */
export function bootstrapPopupThemeFromCache(): void {
  try {
    const bg = normalizeHex(localStorage.getItem(CUSTOM_THEME_CACHE));
    if (bg) {
      const accent = normalizeHex(localStorage.getItem(CUSTOM_ACCENT_CACHE)) ?? '#0077ff';
      applyPopupTheme(document.documentElement, bg, accent);
      return;
    }
    // Цветовой темы нет — применяем кэш светлой/тёмной схемы VK, чтобы окно
    // открылось в нужной схеме без вспышки дефолта.
    const scheme = localStorage.getItem('vkify_vk_scheme_cache');
    if (scheme === 'dark' || scheme === 'light') {
      document.documentElement.setAttribute('data-theme', scheme);
    }
  } catch { /* ignore */ }
}

/** Только акцентные переменные окна (когда цветовой темы нет — меняем лишь их). */
export const ACCENT_ONLY_VARS = [
  '--primary', '--primary-rgb', '--primary-strong', '--primary-hover', '--primary-light',
] as const;

/**
 * Live-preview палитры САМОГО окна расширения во время перетаскивания цвета —
 * синхронно, без записи в storage/localStorage. Повторяет ветки usePopupTheme.apply
 * (тема / только-акцент) минус персист, чтобы окно перекрашивалось мгновенно, как и
 * страница VK. Финальное значение придёт через storage и переустановит те же
 * переменные (usePopupTheme), поэтому стыка не видно.
 */
export function previewPopupTheme(bg: string | null, accent: string | null): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const nbg = normalizeHex(bg);
  const nacc = normalizeHex(accent);
  if (nbg) {
    applyPopupTheme(root, nbg, nacc ?? '#0077ff');
    return;
  }
  if (nacc) {
    const { vars } = buildPopupPalette('#000000', nacc);
    for (const k of ACCENT_ONLY_VARS) root.style.setProperty(k, vars[k]);
  }
}

/**
 * Строит палитру переменных попапа из hex фона и акцента.
 * Логика повторяет приём контент-темы: цвет фона задаёт оттенок/насыщенность,
 * а уровни поверхностей и текста разводятся по светлоте.
 */
export function buildPopupPalette(bgHex: string, accentHex: string): PopupPalette {
  const { h, s, l } = hexToHsl(bgHex);
  const isDark = l < 50;

  // Поверхности слегка тонируем оттенком темы, но не перенасыщаем.
  const surfSat = clamp(s, 0, 70);
  const surf = (lig: number) => `hsl(${h}, ${surfSat}%, ${clamp(lig, 0, 100)}%)`;
  // Текст почти нейтральный, с лёгкой примесью оттенка фона.
  const textSat = clamp(Math.round(s * 0.25), 0, 22);
  const text = (lig: number) => `hsl(${h}, ${textSat}%, ${clamp(lig, 0, 100)}%)`;

  // Уровни поверхностей: «страница» (bg-secondary) — самый дальний слой,
  // «карточка» (bg-primary) приподнята, «hover» (bg-tertiary) ещё выше.
  let page: number, card: number, hover: number, border: number;
  let tPrimary: number, tSecondary: number, tTertiary: number;

  if (isDark) {
    page    = l;
    card    = l + 4;
    hover   = l + 9;
    border  = l + 14;
    tPrimary = 96; tSecondary = 70; tTertiary = 50;
  } else {
    // Светлые темы в пресетах не встречаются, но обрабатываем корректно:
    // карточка ближе к белому, страница чуть приглушена.
    page    = l - 3;
    card    = l + 1;
    hover   = l - 7;
    border  = l - 12;
    tPrimary = 14; tSecondary = 38; tTertiary = 55;
  }

  const a = hexToHsl(accentHex);
  const accent       = `hsl(${a.h}, ${a.s}%, ${clamp(a.l, 0, 100)}%)`;
  const accentStrong = `hsl(${a.h}, ${a.s}%, ${clamp(a.l + (isDark ? -12 : -14), 0, 100)}%)`;
  const accentHover  = `hsl(${a.h}, ${a.s}%, ${clamp(a.l + (isDark ? 8 : -8), 0, 100)}%)`;
  const accentLight  = `hsla(${a.h}, ${a.s}%, ${clamp(a.l, 0, 100)}%, 0.16)`;

  return {
    isDark,
    vars: {
      '--bg-secondary':  surf(page),
      '--bg-primary':    surf(card),
      '--bg-tertiary':   surf(hover),
      '--border-color':  surf(border),
      '--text-primary':   text(tPrimary),
      '--text-secondary': text(tSecondary),
      '--text-tertiary':  text(tTertiary),
      '--primary':        accent,
      '--primary-rgb':    hexToRgbChannels(accentHex),
      '--primary-strong': accentStrong,
      '--primary-hover':  accentHover,
      '--primary-light':  accentLight,
    },
  };
}
