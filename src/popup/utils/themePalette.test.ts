import { describe, it, expect } from 'vitest';
import { deriveAccentFromBg } from './themePalette.js';

/** Минимальный hex→HSL для проверок (повторяет логику themePalette). */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const lig = (max + min) / 2;
  let hue = 0, sat = 0;
  if (max !== min) {
    const d = max - min;
    sat = lig > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: hue = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: hue = ((b - r) / d + 2) / 6; break;
      default: hue = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(hue * 360), s: Math.round(sat * 100), l: Math.round(lig * 100) };
}

describe('deriveAccentFromBg', () => {
  it('возвращает null для не-hex входа', () => {
    expect(deriveAccentFromBg('')).toBeNull();
    expect(deriveAccentFromBg('красный')).toBeNull();
    expect(deriveAccentFromBg('#12345')).toBeNull();
  });

  it('нормализует короткий/верхний регистр и выдаёт валидный #rrggbb', () => {
    const out = deriveAccentFromBg('#1E1E2E');
    expect(out).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('почти белый → тёмно-серый, почти чёрный → светло-серый (без крайностей)', () => {
    const onWhite = hexToHsl(deriveAccentFromBg('#ffffff')!);
    expect(onWhite.l).toBeLessThan(35);
    expect(onWhite.l).toBeGreaterThan(15);   // не почти-чёрный
    const onBlack = hexToHsl(deriveAccentFromBg('#000000')!);
    expect(onBlack.l).toBeGreaterThan(60);
    expect(onBlack.l).toBeLessThan(85);      // не почти-белый
  });

  it('почти-серый фон → нейтральный (без оттенка) акцент', () => {
    expect(hexToHsl(deriveAccentFromBg('#202020')!).s).toBeLessThanOrEqual(2); // тёмно-серый
    expect(hexToHsl(deriveAccentFromBg('#ededed')!).s).toBeLessThanOrEqual(2); // светло-серый
  });

  it('сохраняет оттенок цветного фона (гармония)', () => {
    for (const bg of ['#1e2a4a', '#ffd21e', '#e53935', '#2196f3']) {
      const bgHsl = hexToHsl(bg);
      const accentHsl = hexToHsl(deriveAccentFromBg(bg)!);
      expect(Math.abs(accentHsl.h - bgHsl.h), bg).toBeLessThanOrEqual(6);
    }
  });

  it('яркие цвета → глубокий тёмный акцент того же тона (жёлтый→горчичный и т.п.)', () => {
    // Жёлтый, красный, синий — светлые пипеточные выборы → тёмный сочный акцент.
    for (const bg of ['#ffd21e', '#f44336', '#42a5f5']) {
      const a = hexToHsl(deriveAccentFromBg(bg)!);
      expect(a.l, bg).toBeGreaterThanOrEqual(26);
      expect(a.l, bg).toBeLessThanOrEqual(45);
      expect(a.s, bg).toBeGreaterThanOrEqual(45); // насыщенный, не серый
    }
  });

  it('на тёмном фоне акцент светлее, чем на светлом того же оттенка', () => {
    const darkAccent = hexToHsl(deriveAccentFromBg('#15233f')!);   // тёмно-синий фон
    const lightAccent = hexToHsl(deriveAccentFromBg('#aac4ff')!);  // светло-синий фон
    expect(darkAccent.l).toBeGreaterThan(lightAccent.l);
  });

  it('акцент сочный, но не неоновый: насыщенность в коридоре 45–78', () => {
    for (const bg of ['#2a1e3a', '#0a2a12', '#3a1010', '#102a3a', '#aac4ff']) {
      const s = hexToHsl(deriveAccentFromBg(bg)!).s;
      expect(s, bg).toBeGreaterThanOrEqual(40); // допуск на округление hex↔hsl
      expect(s, bg).toBeLessThanOrEqual(80);
    }
  });

  it('акцент заметно отличается от фона по светлоте (читаемость)', () => {
    for (const bg of ['#7a6a20', '#4a5568', '#b08030']) { // средние тона
      const bgL = hexToHsl(bg).l;
      const aL = hexToHsl(deriveAccentFromBg(bg)!).l;
      expect(Math.abs(aL - bgL), bg).toBeGreaterThanOrEqual(20);
    }
  });
});
