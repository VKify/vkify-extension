export interface MessageAppearance { source: 'theme' | 'custom'; incoming: string; outgoing: string; opacity: number; radius: number }
export const MESSAGE_APPEARANCE_DEFAULTS: MessageAppearance = { source: 'theme', incoming: '#253247', outgoing: '#0077ff', opacity: 95, radius: 18 };
export const MESSAGE_COLOR_PRESETS = [
  { id: 'vk', name: 'VK Blue', incoming: '#253247', outgoing: '#0077ff' },
  { id: 'aurora', name: 'Aurora', incoming: '#123c48', outgoing: '#5440a4' },
  { id: 'synthwave', name: 'Synthwave', incoming: '#322747', outgoing: '#a52f87' },
  { id: 'forest', name: 'Forest', incoming: '#203a32', outgoing: '#237457' },
  { id: 'amoled', name: 'AMOLED', incoming: '#15151e', outgoing: '#25253b' },
] as const;
const color = (value: unknown): value is string => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
export function parseMessageAppearance(value: unknown): MessageAppearance {
  let raw: Partial<MessageAppearance> = {};
  try { const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) raw = parsed;
  } catch { /* Use defaults for corrupt storage. */ }
  return {
    source: raw.source === 'custom' || raw.source === undefined &&
      ((color(raw.incoming) && raw.incoming !== MESSAGE_APPEARANCE_DEFAULTS.incoming) ||
       (color(raw.outgoing) && raw.outgoing !== MESSAGE_APPEARANCE_DEFAULTS.outgoing)) ? 'custom' : 'theme',
    incoming: color(raw.incoming) ? raw.incoming : MESSAGE_APPEARANCE_DEFAULTS.incoming,
    outgoing: color(raw.outgoing) ? raw.outgoing : MESSAGE_APPEARANCE_DEFAULTS.outgoing,
    opacity: typeof raw.opacity === 'number' && Number.isFinite(raw.opacity) ? Math.max(20, Math.min(100, raw.opacity)) : 95,
    radius: typeof raw.radius === 'number' && Number.isFinite(raw.radius) ? Math.max(4, Math.min(28, raw.radius)) : 18,
  };
}
export function isMessageAppearanceJson(value: unknown): boolean {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try { const raw = JSON.parse(value); const parsed = parseMessageAppearance(raw);
    return !!raw && Object.entries(parsed).every(([key, value]) => key === 'source' && raw.source === undefined || raw[key] === value);
  } catch { return false; }
}

/** CSS variables keep theme colors live when the user changes their theme. */
export function messageAppearanceSurfaces(settings: MessageAppearance, popup = false) {
  if (settings.source === 'custom') return {
    incoming: messageSurface(settings.incoming, settings.opacity), outgoing: messageSurface(settings.outgoing, settings.opacity),
    incomingText: messageTextColor(settings.incoming), outgoingText: messageTextColor(settings.outgoing),
  };
  const surface = popup ? 'var(--bg-tertiary)' : 'var(--vkui--color_background_secondary, #eef2f6)';
  const content = popup ? 'var(--bg-primary)' : 'var(--vkui--color_background_content, #fff)';
  const accent = popup ? 'var(--primary)' : 'var(--vkui--color_background_accent, #0077ff)';
  const text = popup ? 'var(--text-primary)' : 'var(--vkui--color_text_primary, #19191a)';
  return {
    incoming: `color-mix(in srgb, ${surface} ${settings.opacity}%, transparent)`,
    outgoing: `color-mix(in srgb, color-mix(in srgb, ${accent} 25%, ${content}) ${settings.opacity}%, transparent)`,
    incomingText: text, outgoingText: text,
  };
}
export function messageSurface(hex: string, opacity: number): string {
  return `rgb(${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(' ')} / ${opacity / 100})`;
}
/** Choose readable text for the configured surface, using relative luminance. */
export function messageTextColor(hex: string): string {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  const luminance = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  return (luminance + .05) / .05 > 1.05 / (luminance + .05) ? '#111111' : '#ffffff';
}
