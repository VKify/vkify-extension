export const MAX_LOGO_FILE_SIZE = 2 * 1024 * 1024;
export const MAX_LOGO_RESOURCE_LENGTH = 3 * 1024 * 1024;
export const LOGO_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];
export const LOGO_COLOR_MODES = ['original', 'theme', 'custom'] as const;
export type LogoColorMode = typeof LOGO_COLOR_MODES[number];
export const DEFAULT_LOGO_COLOR = '#0077ff';

export function parseLogoColorMode(value: unknown): LogoColorMode {
  return LOGO_COLOR_MODES.includes(value as LogoColorMode) ? value as LogoColorMode : 'original';
}

export function isLogoColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

export function logoTintColor(mode: LogoColorMode, color: unknown,
  theme = 'var(--vkify-accent, var(--vkui--color_icon_accent, #0077ff))'): string {
  return mode === 'theme' ? theme : isLogoColor(color) ? color : DEFAULT_LOGO_COLOR;
}

/** Resources are rendered as images or quoted CSS image URLs, never as markup. */
export function isSafeLogoResource(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > MAX_LOGO_RESOURCE_LENGTH) return false;
  if (value === '') return true;
  if (/^data:image\/(?:png|jpeg|webp|gif|svg\+xml);base64,[a-z0-9+/]+={0,2}$/i.test(value)) return true;
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && !!url.hostname && !url.username && !url.password;
  } catch { return false; }
}
