import { describe, it, expect } from 'vitest';
import {
  FEATURE_CONFLICTS,
  CONFLICTS_BY_ID,
  conflictsFor,
  otherSide,
  findConflict,
} from '../shared/constants/feature-conflicts.js';
import { BUILTIN_PRESETS } from '../shared/constants/presets.js';

describe('feature-conflicts — целостность карты', () => {
  it('пары не дублируются (в любом порядке сторон)', () => {
    const seen = new Set<string>();
    for (const c of FEATURE_CONFLICTS) {
      const key = [c.a, c.b].sort().join('×');
      expect(seen.has(key), `дубль пары ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it('фича не конфликтует сама с собой, у каждой пары есть причина', () => {
    for (const c of FEATURE_CONFLICTS) {
      expect(c.a).not.toBe(c.b);
      expect(c.reason.length).toBeGreaterThan(0);
    }
  });

  it('индекс CONFLICTS_BY_ID содержит обе стороны каждой пары', () => {
    for (const c of FEATURE_CONFLICTS) {
      expect(CONFLICTS_BY_ID[c.a]).toContain(c);
      expect(CONFLICTS_BY_ID[c.b]).toContain(c);
    }
  });

  it('conflictsFor/otherSide/findConflict согласованы', () => {
    const c = FEATURE_CONFLICTS[0];
    expect(conflictsFor(c.a)).toContain(c);
    expect(otherSide(c, c.a)).toBe(c.b);
    expect(otherSide(c, c.b)).toBe(c.a);
    expect(findConflict(c.a, c.b)).toBe(c);
    expect(findConflict(c.b, c.a)).toBe(c);
    expect(findConflict(c.a, '__nope__')).toBeUndefined();
    expect(conflictsFor('__nope__')).toEqual([]);
  });
});

describe('presets — целостность встроенных пресетов', () => {
  // Ключи settings проверяются на этапе typecheck (Partial<ExtensionSettings>),
  // поэтому здесь — только структурные инварианты.
  it('id уникальны, имена/описания заполнены, настройки не пустые', () => {
    const ids = new Set<string>();
    for (const p of BUILTIN_PRESETS) {
      expect(ids.has(p.id), `дубль id ${p.id}`).toBe(false);
      ids.add(p.id);
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
      expect(Object.keys(p.settings).length).toBeGreaterThan(0);
    }
  });
});
