import type { ClockSettings } from './types.js';
import { CLOCK_DEFAULTS } from './settings.js';

// Popup-only presets stay separate from validation used by the site bridge.
// Complete appearance snapshots prevent effects from the previous preset leaking
// into the next one. Formatting, output and placement remain user-controlled.
export const CLOCK_APPEARANCE_DEFAULTS = {
  fontSize: CLOCK_DEFAULTS.fontSize, opacity: CLOCK_DEFAULTS.opacity,
  color: CLOCK_DEFAULTS.color, background: CLOCK_DEFAULTS.background,
  backgroundOpacity: CLOCK_DEFAULTS.backgroundOpacity, showBackground: true,
  radius: CLOCK_DEFAULTS.radius, fontWeight: CLOCK_DEFAULTS.fontWeight, glass: false,
  fontFamily: CLOCK_DEFAULTS.fontFamily, letterSpacing: 0, padding: 10, gradient: false,
  backgroundSecondary: CLOCK_DEFAULTS.backgroundSecondary, gradientAngle: 135,
  borderWidth: 0, borderColor: '#ffffff', shadow: 0, glow: 0, blur: 12,
  dateLayout: CLOCK_DEFAULTS.dateLayout, dateSize: CLOCK_DEFAULTS.dateSize,
} satisfies Partial<ClockSettings>;

type ClockAppearance = Pick<ClockSettings, keyof typeof CLOCK_APPEARANCE_DEFAULTS>;
const preset = (settings: Partial<ClockAppearance>): ClockAppearance => ({ ...CLOCK_APPEARANCE_DEFAULTS, ...settings });
export const CLOCK_PRESETS = {
  minimal: preset({}),
  glass: preset({ glass: true, backgroundOpacity: 35, radius: 20, shadow: 12 }),
  transparent: preset({ showBackground: false, fontWeight: 600 }),
  neon: preset({ fontFamily: 'mono', color: '#67e8f9', background: '#081624', backgroundOpacity: 95, borderWidth: 1, borderColor: '#22d3ee', glow: 16, letterSpacing: 2, radius: 12 }),
  sunset: preset({ gradient: true, background: '#be185d', backgroundSecondary: '#f97316', backgroundOpacity: 95, fontWeight: 700, radius: 24, shadow: 18, dateLayout: 'below' }),
  aurora: preset({ gradient: true, background: '#064e3b', backgroundSecondary: '#4338ca', backgroundOpacity: 80, glass: true, radius: 24, shadow: 16, dateLayout: 'below' }),
  terminal: preset({ fontFamily: 'mono', color: '#86efac', background: '#07130b', backgroundOpacity: 100, borderWidth: 1, borderColor: '#166534', radius: 4, letterSpacing: 1, glow: 6 }),
  retro: preset({ fontFamily: 'mono', color: '#fbbf24', background: '#241506', backgroundOpacity: 100, borderWidth: 2, borderColor: '#92400e', radius: 8, glow: 10, letterSpacing: 3 }),
  paper: preset({ fontFamily: 'serif', color: '#44403c', background: '#faf5eb', backgroundOpacity: 100, radius: 6, borderWidth: 1, borderColor: '#d6d3d1', shadow: 12, dateLayout: 'above' }),
  midnight: preset({ gradient: true, background: '#0f172a', backgroundSecondary: '#312e81', backgroundOpacity: 100, borderWidth: 1, borderColor: '#6366f1', fontWeight: 300, letterSpacing: 2, shadow: 20, dateLayout: 'below' }),
  candy: preset({ fontFamily: 'rounded', gradient: true, background: '#fbcfe8', backgroundSecondary: '#c4b5fd', color: '#581c87', backgroundOpacity: 100, radius: 36, fontWeight: 800, shadow: 12 }),
  capsule: preset({ fontFamily: 'rounded', background: '#ffffff', color: '#0f172a', backgroundOpacity: 95, radius: 48, fontWeight: 700, padding: 14, shadow: 16 }),
} satisfies Record<string, Partial<ClockSettings>>;
