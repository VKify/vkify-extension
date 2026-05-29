import { describe, it, expect } from 'vitest';
import { nonceMatches, createChannelNonce } from '../shared/utils/page-channel.js';

describe('nonceMatches', () => {
  it('accepts only an exact, non-empty string match', () => {
    expect(nonceMatches('abc', 'abc')).toBe(true);
    expect(nonceMatches('abc', 'xyz')).toBe(false);
  });

  it('rejects empty nonces on either side', () => {
    expect(nonceMatches('', '')).toBe(false);
    expect(nonceMatches('abc', '')).toBe(false);
    expect(nonceMatches('', 'abc')).toBe(false);
  });

  it('rejects non-string received values', () => {
    expect(nonceMatches('abc', undefined)).toBe(false);
    expect(nonceMatches('abc', null)).toBe(false);
    expect(nonceMatches('abc', 123)).toBe(false);
    expect(nonceMatches('abc', { toString: () => 'abc' })).toBe(false);
  });
});

describe('createChannelNonce', () => {
  it('returns a non-empty string', () => {
    expect(createChannelNonce().length).toBeGreaterThan(0);
  });

  it('returns a different value each call', () => {
    expect(createChannelNonce()).not.toBe(createChannelNonce());
  });
});
