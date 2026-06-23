import { describe, it, expect } from 'vitest';
import { specCandidates } from '../content/selectors/types.js';
import { SELECTORS } from '../content/selectors/index.js';

describe('specCandidates', () => {
  it('wraps a single string into a one-element list', () => {
    expect(specCandidates('.a')).toEqual(['.a']);
  });

  it('returns array specs as-is', () => {
    expect(specCandidates(['.a', '.b'])).toEqual(['.a', '.b']);
  });
});

describe('SELECTORS registry invariants', () => {
  const allSpecs = Object.values(SELECTORS).flatMap((group) => Object.values(group));

  it('contains no empty candidate strings (guards against typos)', () => {
    for (const spec of allSpecs) {
      for (const sel of specCandidates(spec)) {
        expect(sel.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
