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

interface Hsl { h: number; s: number; l: number }

function hexToHsl(hex: string): Hsl {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lig = (max + min) / 2;
  let hue = 0;
  let sat = 0;

  if (max !== min) {
    const d = max - min;
    sat = lig > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: hue = (g - b) / d + (g < b ? 6 : 0); break;
      case g: hue = (b - r) / d + 2; break;
      default: hue = (r - g) / d + 4; break;
    }
    hue /= 6;
  }

  return { h: Math.round(hue * 360), s: Math.round(sat * 100), l: Math.round(lig * 100) };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** HSL → `#rrggbb`. h в [0,360), s/l в [0,100]. */
function hslToHex(h: number, s: number, l: number): string {
  const sN = clamp(s, 0, 100) / 100;
  const lN = clamp(l, 0, 100) / 100;
  const a = sN * Math.min(lN, 1 - lN);
  const f = (n: number): string => {
    const k = (n + h / 30) % 12;
    const c = lN - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Каналы `r g b` из hex — для Tailwind-цвета `rgb(var(--primary-rgb) / <alpha>)`. */
function hexToRgbChannels(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

/** Нормализует строку в `#rrggbb` или возвращает null, если это не hex-цвет. */
export function normalizeHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(v)) return null;
  return `#${v.toLowerCase()}`;
}

/**
 * Подбирает контрастный, гармоничный и читаемый акцент под выбранный цвет фона.
 *
 * Принципы (clean UI / accessibility, как у крупных tech-продуктов):
 *  • Контраст по СВЕТЛОТЕ: светлый фон (вплоть до белого) → тёмный акцент
 *    (вплоть до почти-чёрного), тёмный фон → светлый акцент. Это гарантирует
 *    читаемость ссылок/кнопок на любом фоне.
 *  • Гармония по ОТТЕНКУ: акцент берёт оттенок фона лёгкой примесью, поэтому
 *    сочетается с темой и не выглядит инородным.
 *  • Никаких «ядовитых» неоновых цветов: насыщенность приглушена (≤ ~46%), а
 *    крайности светлоты намеренно мягче чистых #000/#fff — аккуратнее для глаза.
 *  • Серый/ч-б фон (оттенка нет) → нейтральный графитовый/светло-серый акцент.
 *
 * Возвращает `#rrggbb` либо `null`, если на входе не валидный hex-цвет.
 */
export function deriveAccentFromBg(bgHex: string): string | null {
  const hex = normalizeHex(bgHex);
  if (!hex) return null;

  const { h, s, l } = hexToHsl(hex);
  const isDark = l < 50;

  // Контраст по светлоте: тёмный фон → светлый акцент, светлый → тёмный.
  // Не уходим в чистые крайности (0/100) — мягче и аккуратнее.
  const accentLig = isDark ? 86 : 20;

  // Насыщенность приглушаем, чтобы избегать кислотных тонов: лёгкая примесь
  // оттенка фона ради гармонии, но не больше ~46%. Почти-серый фон → нейтраль.
  const accentSat = s < 8 ? 0 : clamp(Math.round(s * 0.5), 8, 46);

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
