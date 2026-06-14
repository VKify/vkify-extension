/** Мелкие геометрические утилиты центра загрузок. */

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
