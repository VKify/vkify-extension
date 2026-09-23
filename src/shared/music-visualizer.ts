export const VISUALIZER_DEFAULTS = {
  mode: 'spectrum', intensity: 70, smoothing: 65, bass: 100, mids: 100,
  treble: 100, speed: 100, opacity: 70, blur: 0, scale: 100, glow: 35,
  colorMode: 'accent', color: '#5181b8', color2: '#a855f7',
  position: 'bottom', fps: 'auto', quality: 'auto',
  width: 100, height: 100, offsetX: 0, offsetY: 0,
  lyricsSecondaryOpacity: 18, lyricsLineCount: 7, lyricsAlignment: 'left', lyricsLineSpacing: 100,
  lyricsShowCover: false, lyricsCoverSize: 20, lyricsCoverX: 5, lyricsCoverY: 5,
  lyricsCoverOpacity: 100, lyricsCoverRadius: 12, lyricsCoverBlur: 0, lyricsLayer: 'background',
  hideWhenPaused: false, lyricsStyle: 'flow', lyricsLayoutVersion: 2, lyricsSize: 100, lyricsSensitivity: 100, lyricsNeighbors: true,
} as const;

export type VisualizerSettings = { -readonly [K in keyof typeof VISUALIZER_DEFAULTS]: typeof VISUALIZER_DEFAULTS[K] extends number ? number : typeof VISUALIZER_DEFAULTS[K] extends boolean ? boolean : string };
export const VISUALIZER_MODES = {
  lyrics: { label: 'Текст песни', position: 'full', symmetric: true },
  spectrum: { label: 'Спектр', position: 'bottom', symmetric: false },
  wave: { label: 'Волна', position: 'center', symmetric: true },
  bars: { label: 'Полосы', position: 'bottom', symmetric: false },
  radial: { label: 'Орбита', position: 'center', symmetric: true },
  particles: { label: 'Частицы', position: 'full', symmetric: false },
  aurora: { label: 'Аврора', position: 'center', symmetric: true },
  rings: { label: 'Кольца', position: 'center', symmetric: true },
  helix: { label: 'Спираль', position: 'center', symmetric: true },
  matrix: { label: 'Матрица', position: 'center', symmetric: true },
} as const;
export type VisualizerMode = keyof typeof VISUALIZER_MODES;

const ranges: Partial<Record<keyof VisualizerSettings, [number, number]>> = {
  lyricsSecondaryOpacity: [0, 70], lyricsLineCount: [1, 11], lyricsLineSpacing: [50, 200],
  lyricsCoverSize: [5, 60], lyricsCoverX: [0, 100], lyricsCoverY: [0, 100],
  lyricsCoverOpacity: [0, 100], lyricsCoverRadius: [0, 50], lyricsCoverBlur: [0, 30],
  lyricsLayoutVersion: [2, 2], lyricsSize: [50, 200], lyricsSensitivity: [0, 200],
  intensity: [0, 100], smoothing: [0, 100], bass: [0, 200], mids: [0, 200],
  treble: [0, 200], speed: [25, 200], opacity: [0, 100], blur: [0, 30], scale: [50, 150], glow: [0, 100],
  width: [20, 200], height: [20, 200], offsetX: [-100, 100], offsetY: [-100, 100],
};
const choices: Partial<Record<keyof VisualizerSettings, readonly string[]>> = {
  lyricsAlignment: ['left', 'center', 'right'], lyricsLayer: ['background', 'foreground'],
  lyricsStyle: ['focus', 'flow'],
  mode: Object.keys(VISUALIZER_MODES),
  colorMode: ['theme', 'accent', 'wallpaper', 'custom', 'gradient', 'auto'],
  position: ['center', 'bottom', 'top', 'full'], fps: ['auto', '30', '60'],
  quality: ['auto', 'low', 'medium', 'high'],
};

export function parseVisualizerSettings(raw: unknown): VisualizerSettings {
  let parsed: Record<string, unknown> = {};
  try { parsed = typeof raw === 'string' ? JSON.parse(raw) as Record<string, unknown> : raw as Record<string, unknown>; } catch { /* defaults */ }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) parsed = {};
  const result = { ...VISUALIZER_DEFAULTS } as VisualizerSettings;
  for (const key of Object.keys(result) as (keyof VisualizerSettings)[]) {
    const value = parsed[key];
    const range = ranges[key];
    if (typeof result[key] === 'boolean' && typeof value === 'boolean') { (result as Record<string, unknown>)[key] = value; continue; }
    if (range && typeof value === 'number' && Number.isFinite(value)) (result as Record<string, unknown>)[key] = Math.max(range[0], Math.min(range[1], value));
    else if (choices[key] && typeof value === 'string' && choices[key]?.includes(value)) (result as Record<string, unknown>)[key] = value;
    else if ((key === 'color' || key === 'color2') && typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) (result as Record<string, unknown>)[key] = value;
  }
  // Upgrade the original compact Lyrics layout once; subsequent edits remain user-controlled.
  if (parsed.mode === 'lyrics' && parsed.lyricsLayoutVersion !== 2) {
    Object.assign(result, { lyricsStyle: 'flow', lyricsNeighbors: true, lyricsSize: 100,
      width: 100, position: 'full', offsetX: 0, offsetY: 0, opacity: 95, colorMode: 'custom', color: '#ffffff' });
  }
  return result;
}

export const isVisualizerSettingsJson = (value: unknown): boolean =>
  typeof value === 'string' && value.length < 4096 && (() => { try { return !!JSON.parse(value) && typeof JSON.parse(value) === 'object'; } catch { return false; } })();

/** Presets are complete snapshots: selecting one never inherits the previous preset's bass or blur. */
export const VISUALIZER_PRESETS = [
  { id: 'neon', name: 'Neon', description: 'Сияющий спектр', color: '#22d3ee', color2: '#c084fc', mode: 'spectrum', position: 'bottom', glow: 60, intensity: 85, smoothing: 75 },
  { id: 'silk', name: 'Silk', description: 'Шёлковые волны', color: '#a5b4fc', color2: '#f9a8d4', mode: 'wave', position: 'center', glow: 25, intensity: 60, smoothing: 85 },
  { id: 'chrome', name: 'Chrome', description: 'Точный ритм', color: '#e2e8f0', color2: '#7dd3fc', mode: 'bars', position: 'bottom', glow: 10, intensity: 75, smoothing: 55 },
  { id: 'orbit', name: 'Orbit', description: 'Световая корона', color: '#818cf8', color2: '#2dd4bf', mode: 'radial', position: 'center', glow: 55, intensity: 80, smoothing: 70 },
  { id: 'stardust', name: 'Stardust', description: 'Облако искр', color: '#fbbf24', color2: '#fb7185', mode: 'particles', position: 'full', glow: 45, intensity: 70, smoothing: 80 },
  { id: 'minimal', name: 'Minimal', description: 'Тихий акцент', color: '#94a3b8', color2: '#cbd5e1', mode: 'spectrum', position: 'bottom', glow: 0, intensity: 35, smoothing: 85 },
  { id: 'aurora', name: 'Aurora', description: 'Северное сияние', color: '#34d399', color2: '#a78bfa', mode: 'aurora', position: 'center', glow: 55, intensity: 80, smoothing: 85 },
  { id: 'echo', name: 'Echo', description: 'Кольца баса', color: '#38bdf8', color2: '#e879f9', mode: 'rings', position: 'center', glow: 45, intensity: 85, smoothing: 65 },
  { id: 'helix', name: 'Helix', description: 'Двойная спираль', color: '#fb7185', color2: '#67e8f9', mode: 'helix', position: 'center', glow: 30, intensity: 75, smoothing: 70 },
  { id: 'matrix', name: 'Matrix', description: 'Частотная сетка', color: '#4ade80', color2: '#22d3ee', mode: 'matrix', position: 'center', glow: 25, intensity: 80, smoothing: 50 },
] as const;

export function visualizerPreset(id: string): VisualizerSettings {
  const preset = VISUALIZER_PRESETS.find((item) => item.id === id) ?? VISUALIZER_PRESETS[0];
  return parseVisualizerSettings({ ...VISUALIZER_DEFAULTS, ...preset, colorMode: 'gradient' });
}
