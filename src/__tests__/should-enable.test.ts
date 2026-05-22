import { describe, it, expect } from 'vitest';
import { shouldEnable } from '../content/core/should-enable.js';

describe('shouldEnable', () => {

  it('включает при true', () => {
    expect(shouldEnable(true)).toBe(true);
  });

  it('включает при положительном числе', () => {
    expect(shouldEnable(1)).toBe(true);
    expect(shouldEnable(100)).toBe(true);
    expect(shouldEnable(0.1)).toBe(true);
  });

  it('включает при непустой строке', () => {
    expect(shouldEnable('dark')).toBe(true);
    expect(shouldEnable('auto')).toBe(true);
    expect(shouldEnable(' ')).toBe(true);
  });

  it('включает при непустом массиве (spy_tracked_users)', () => {
    expect(shouldEnable([{ id: '123', name: 'Test' }])).toBe(true);
    expect(shouldEnable([1, 2, 3])).toBe(true);
    expect(shouldEnable(['a'])).toBe(true);
  });


  it('не включает при false', () => {
    expect(shouldEnable(false)).toBe(false);
  });

  it('не включает при 0', () => {
    expect(shouldEnable(0)).toBe(false);
  });

  it('не включает при пустой строке', () => {
    expect(shouldEnable('')).toBe(false);
  });

  it('не включает при пустом массиве', () => {
    expect(shouldEnable([])).toBe(false);
  });

  it('не включает при null', () => {
    expect(shouldEnable(null)).toBe(false);
  });

  it('не включает при undefined', () => {
    expect(shouldEnable(undefined)).toBe(false);
  });

  it('не включает при объекте (не массиве)', () => {
    expect(shouldEnable({})).toBe(false);
    expect(shouldEnable({ key: 'value' })).toBe(false);
  });

  it('не включает при отрицательном числе', () => {
    expect(shouldEnable(-1)).toBe(false);
  });


  it('spy_tracked_users: [] → не включает', () => {
    expect(shouldEnable([])).toBe(false);
  });

  it('spy_tracked_users: [user] → включает', () => {
    expect(shouldEnable([{ id: '1', name: 'Иван' }])).toBe(true);
  });

  it('extension_theme: "auto" → включает', () => {
    expect(shouldEnable('auto')).toBe(true);
  });

  it('spy_online_interval: 60 → включает', () => {
    expect(shouldEnable(60)).toBe(true);
  });

  it('background_opacity: 0 → не включает (opacity=0 не имеет смысла)', () => {
    expect(shouldEnable(0)).toBe(false);
  });

  it('custom_font_size: 14 → включает', () => {
    expect(shouldEnable(14)).toBe(true);
  });
});