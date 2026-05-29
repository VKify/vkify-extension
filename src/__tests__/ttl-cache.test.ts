import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TtlCache } from '../shared/utils/ttl-cache.js';

describe('TtlCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and retrieves values', () => {
    const c = new TtlCache<string, number>();
    c.set('a', 1);
    expect(c.get('a')).toBe(1);
    expect(c.has('a')).toBe(true);
    expect(c.get('missing')).toBeUndefined();
    expect(c.has('missing')).toBe(false);
  });

  it('expires entries older than ttl', () => {
    const c = new TtlCache<string, number>(100, 1000);
    c.set('a', 1);
    vi.setSystemTime(999);
    expect(c.get('a')).toBe(1);     // ещё жив
    vi.setSystemTime(1001);
    expect(c.get('a')).toBeUndefined(); // протух
    expect(c.has('a')).toBe(false);
  });

  it('evicts the oldest entry when over capacity', () => {
    const c = new TtlCache<string, number>(2, 100000);
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3); // вытесняет 'a' (самый старый)
    expect(c.get('a')).toBeUndefined();
    expect(c.get('b')).toBe(2);
    expect(c.get('c')).toBe(3);
    expect(c.size).toBe(2);
  });

  it('re-inserting a key refreshes its recency', () => {
    const c = new TtlCache<string, number>(2, 100000);
    c.set('a', 1);
    c.set('b', 2);
    c.set('a', 10); // 'a' снова самый свежий
    c.set('c', 3);  // теперь вытесняется 'b', а не 'a'
    expect(c.get('a')).toBe(10);
    expect(c.get('b')).toBeUndefined();
    expect(c.get('c')).toBe(3);
  });

  it('supports delete and clear', () => {
    const c = new TtlCache<string, number>();
    c.set('a', 1);
    c.delete('a');
    expect(c.has('a')).toBe(false);
    c.set('b', 2);
    c.set('c', 3);
    c.clear();
    expect(c.size).toBe(0);
  });
});
