export interface MessengerBackground {
  mode: 'preset' | 'color' | 'image';
  preset: string;
  color: string;
  image: string;
  dim: number;
  blur: number; opacity: number; scale: number;
  brightness: number; contrast: number; saturation: number; hue_rotate: number;
  sepia: number; grayscale: number; vignette: number;
  overlay_color: string; overlay_opacity: number;
  position: string; size: string;
}

export const MAX_CHAT_BACKGROUND_LENGTH = 3 * 1024 * 1024;
export const CHAT_BACKGROUND_PRESETS = [
  { id: 'vk', name: 'VK Blue', color: '#071b35', image: 'radial-gradient(ellipse at 10% 10%,#0077ff99,transparent 55%),radial-gradient(ellipse at 90% 90%,#00c8ff66,transparent 60%),linear-gradient(135deg,#071b35,#122750)' },
  { id: 'aurora', name: 'Aurora', color: '#0e1c26', image: 'radial-gradient(ellipse at 0% 10%,#00d9ff88,transparent 55%),radial-gradient(ellipse at 95% 90%,#a855f777,transparent 60%),linear-gradient(145deg,#0e1c26,#192744)' },
  { id: 'synthwave', name: 'Synthwave', color: '#262335', image: 'radial-gradient(ellipse at 5% 100%,#ff7edb88,transparent 60%),radial-gradient(ellipse at 100% 0%,#7c3aedaa,transparent 60%),linear-gradient(145deg,#17152b,#35213e)' },
  { id: 'forest', name: 'Forest', color: '#10251f', image: 'radial-gradient(ellipse at 0% 0%,#5fb38188,transparent 60%),radial-gradient(ellipse at 100% 100%,#00b9a766,transparent 55%),linear-gradient(135deg,#10251f,#172f36)' },
  { id: 'ember', name: 'Ember', color: '#291513', image: 'radial-gradient(ellipse at 10% 90%,#ff6b3577,transparent 60%),radial-gradient(ellipse at 90% 5%,#e9567866,transparent 55%),linear-gradient(135deg,#291513,#362138)' },
  { id: 'amoled', name: 'AMOLED', color: '#050509', image: 'radial-gradient(ellipse at 10% 0%,#0077ff33,transparent 55%),radial-gradient(ellipse at 100% 100%,#a855f733,transparent 60%),linear-gradient(135deg,#050509,#10121c)' },
] as const;

export const DEFAULT_MESSENGER_BACKGROUND: MessengerBackground = {
  mode: 'preset', preset: 'vk', color: '#071b35', image: '', dim: 15,
  blur: 0, opacity: 100, scale: 100, brightness: 100, contrast: 100, saturation: 100,
  hue_rotate: 0, sepia: 0, grayscale: 0, vignette: 0,
  overlay_color: '#000000', overlay_opacity: 0, position: 'center', size: 'cover',
};

const LIMITS = { blur: [0, 50], dim: [0, 90], opacity: [10, 100], scale: [70, 150],
  brightness: [50, 150], contrast: [50, 150], saturation: [0, 200], hue_rotate: [-180, 180],
  sepia: [0, 100], grayscale: [0, 100], vignette: [0, 80], overlay_opacity: [0, 80] } as const;
const POSITIONS = ['center', 'top center', 'bottom center', 'center left', 'center right'];
const SIZES = ['cover', 'contain', 'auto', '100% 100%'];
const isColor = (value: unknown): value is string => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);

/** Only raster data URLs and web resources may reach a CSS image value. */
export function isChatBackgroundImage(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > MAX_CHAT_BACKGROUND_LENGTH) return false;
  if (!value) return true;
  if (/^data:image\/(?:png|jpeg|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/.test(value)) return true;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

export function parseMessengerBackground(value: unknown): MessengerBackground {
  let raw: Partial<MessengerBackground> = {};
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) raw = parsed;
  } catch { /* Use defaults for invalid stored values. */ }
  const result: MessengerBackground = {
    ...DEFAULT_MESSENGER_BACKGROUND,
    mode: raw.mode === 'image' || raw.mode === 'color' ? raw.mode : 'preset',
    preset: CHAT_BACKGROUND_PRESETS.some(p => p.id === raw.preset) ? raw.preset! : 'vk',
    color: isColor(raw.color) ? raw.color : DEFAULT_MESSENGER_BACKGROUND.color,
    image: isChatBackgroundImage(raw.image) ? raw.image : '',
    overlay_color: isColor(raw.overlay_color) ? raw.overlay_color : '#000000',
    position: POSITIONS.includes(raw.position ?? '') ? raw.position! : 'center',
    size: SIZES.includes(raw.size ?? '') ? raw.size! : 'cover',
  };
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    const name = key as keyof typeof LIMITS;
    const value = raw[name];
    if (typeof value === 'number' && Number.isFinite(value)) result[name] = Math.max(min, Math.min(max, value));
  }
  return result;
}

export function isMessengerBackgroundJson(value: unknown): boolean {
  if (typeof value !== 'string' || value.length > MAX_CHAT_BACKGROUND_LENGTH + 4096) return false;
  try {
    const raw = JSON.parse(value);
    return !!raw && typeof raw === 'object' && !Array.isArray(raw) &&
      ['preset', 'color', 'image'].includes(raw.mode) && isColor(raw.color) && isChatBackgroundImage(raw.image) &&
      (raw.preset === undefined || CHAT_BACKGROUND_PRESETS.some(p => p.id === raw.preset)) &&
      (raw.overlay_color === undefined || isColor(raw.overlay_color)) &&
      (raw.position === undefined || POSITIONS.includes(raw.position)) && (raw.size === undefined || SIZES.includes(raw.size)) &&
      Object.entries(LIMITS).every(([key, [min, max]]) => raw[key] === undefined ||
        typeof raw[key] === 'number' && Number.isFinite(raw[key]) && raw[key] >= min && raw[key] <= max);
  } catch { return false; }
}

export function messengerBackgroundImage(settings: MessengerBackground): string {
  // JSON quoting protects quotes, slashes and control characters inside CSS url().
  const url = JSON.stringify(settings.image).replace(/</g, '\\3c ').replace(/>/g, '\\3e ');
  if (settings.mode === 'preset') return CHAT_BACKGROUND_PRESETS.find(p => p.id === settings.preset)!.image;
  return settings.mode === 'image' && settings.image ? `url(${url})` : 'none';
}

/** One renderer for the page layer and the popup preview. Filters never touch messages. */
export function messengerBackgroundLayers(settings: MessengerBackground) {
  const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(' ');
  return {
    color: settings.mode === 'preset' ? CHAT_BACKGROUND_PRESETS.find(p => p.id === settings.preset)!.color : settings.color,
    image: messengerBackgroundImage(settings),
    filter: `blur(${settings.blur}px) brightness(${settings.brightness}%) contrast(${settings.contrast}%) saturate(${settings.saturation}%) hue-rotate(${settings.hue_rotate}deg) sepia(${settings.sepia}%) grayscale(${settings.grayscale}%)`,
    overlay: `radial-gradient(ellipse at center,transparent ${100 - settings.vignette}%,rgb(0 0 0 / ${settings.vignette / 100})),linear-gradient(rgb(0 0 0 / ${settings.dim / 100}),rgb(0 0 0 / ${settings.dim / 100})),linear-gradient(rgb(${rgb(settings.overlay_color)} / ${settings.overlay_opacity / 100}),rgb(${rgb(settings.overlay_color)} / ${settings.overlay_opacity / 100}))`,
  };
}
