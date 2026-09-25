/**
 * Константы и пресеты эквалайзера — ЕДИНЫЙ источник правды, общий для:
 *   • page-world DSP (injected/equalizer.ts) — частоты полос;
 *   • контент-панели (panel.ts) и попап-страницы (EqualizerPage.tsx) — пресеты, диапазоны.
 *
 * Чистые данные/математика, без chrome API → безопасно импортировать из любого
 * контекста (в т.ч. из React-попапа и из инжект-скрипта, который сборка инлайнит).
 */
import type { EqualizerPreset } from '@/types/index.js';

/** Стандартные частоты 10-полосного EQ (Гц). Порядок = порядок полос. */
export const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

export const EQ_BAND_COUNT = EQ_FREQUENCIES.length;

/** Пределы усиления полос и преампа (dB). */
export const EQ_GAIN_MIN = -12;
export const EQ_GAIN_MAX = 12;

/** Id рабочего слота «ручная настройка». */
export const CUSTOM_PRESET_ID = 'custom';

/** Плоская АЧХ — нули по всем полосам. */
export const FLAT_BANDS: readonly number[] = Object.freeze(new Array<number>(EQ_BAND_COUNT).fill(0));

/** Короткая подпись частоты для UI: 31, 125, 1k, 16k. */
export function bandLabel(hz: number): string {
  return hz >= 1000 ? `${hz / 1000}k` : String(hz);
}

/** Усечь/дополнить массив полос до EQ_BAND_COUNT и зажать в пределах. */
export function normalizeBands(bands: readonly number[] | null | undefined): number[] {
  const out = new Array<number>(EQ_BAND_COUNT);
  for (let i = 0; i < EQ_BAND_COUNT; i++) {
    const v = Number(bands?.[i]);
    out[i] = Number.isFinite(v) ? clampGain(v) : 0;
  }
  return out;
}

export function clampGain(db: number): number {
  return Math.max(EQ_GAIN_MIN, Math.min(EQ_GAIN_MAX, db));
}

/**
 * Встроенные пресеты (read-only). Значения подобраны в пределах ±12 dB и дают
 * узнаваемый характер для каждого жанра/назначения.
 *           31  62 125 250 500  1k  2k  4k  8k 16k
 */
export const BUILTIN_PRESETS: readonly EqualizerPreset[] = [
  { id: 'flat',         name: 'Flat',         preamp: 0, bands: [ 0,  0,  0,  0,  0,  0,  0,  0,  0,  0] },
  { id: 'bass_boost',   name: 'Bass Boost',   preamp: 0, bands: [ 7,  6,  5,  3,  1,  0,  0,  0,  0,  0] },
  { id: 'treble_boost', name: 'Treble Boost', preamp: 0, bands: [ 0,  0,  0,  0,  0,  1,  2,  4,  6,  7] },
  { id: 'vocal',        name: 'Vocal',        preamp: 0, bands: [-2, -1,  0,  2,  4,  4,  3,  1,  0, -1] },
  { id: 'electronic',   name: 'Electronic',   preamp: 0, bands: [ 5,  4,  1,  0, -2,  1,  1,  2,  4,  5] },
  { id: 'rock',         name: 'Rock',         preamp: 0, bands: [ 5,  4,  3,  1, -1, -1,  1,  3,  4,  5] },
  { id: 'pop',          name: 'Pop',          preamp: 0, bands: [-1,  1,  3,  4,  3,  1,  0, -1, -1, -1] },
  { id: 'classical',    name: 'Classical',    preamp: 0, bands: [ 4,  3,  2,  1, -1, -1,  0,  2,  3,  4] },
];

/** Найти пресет по id среди встроенных и пользовательских. */
export function findPreset(
  id: string | null | undefined,
  customPresets: readonly EqualizerPreset[] = [],
): EqualizerPreset | undefined {
  if (!id) return undefined;
  return BUILTIN_PRESETS.find(p => p.id === id) ?? customPresets.find(p => p.id === id);
}

/** Совпадает ли текущая настройка с пресетом (для подсветки активной кнопки). */
export function matchesPreset(
  preamp: number,
  bands: readonly number[],
  preset: EqualizerPreset,
): boolean {
  if (Math.round(preamp) !== Math.round(preset.preamp)) return false;
  const norm = normalizeBands(bands);
  const target = normalizeBands(preset.bands);
  return norm.every((v, i) => v === target[i]);
}
