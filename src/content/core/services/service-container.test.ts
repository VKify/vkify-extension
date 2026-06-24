import { describe, it, expect, vi } from 'vitest';
import { ServiceContainer } from './service-container.js';

describe('ServiceContainer', () => {
  it('registers and resolves a value', () => {
    const c = new ServiceContainer();
    const svc = { name: 'x' };
    c.registerValue('a', svc);
    expect(c.get('a')).toBe(svc);
    expect(c.has('a')).toBe(true);
  });

  it('throws on unregistered service', () => {
    const c = new ServiceContainer();
    expect(() => c.get('missing')).toThrow(/not registered/);
    expect(c.tryGet('missing')).toBeUndefined();
  });

  it('lazily instantiates a factory only once', () => {
    const c = new ServiceContainer();
    const factory = vi.fn(() => ({ created: true }));
    c.registerFactory('lazy', factory);

    expect(factory).not.toHaveBeenCalled(); // не вызвана до get()
    const first = c.get('lazy');
    const second = c.get('lazy');

    expect(factory).toHaveBeenCalledTimes(1); // singleton-кэш
    expect(first).toBe(second);
  });

  it('passes the container to the factory (для разрешения зависимостей)', () => {
    const c = new ServiceContainer();
    c.registerValue('dep', 42);
    c.registerFactory('uses-dep', (container) => container.get<number>('dep') + 1);
    expect(c.get('uses-dep')).toBe(43);
  });

  it('detects circular factory dependencies', () => {
    const c = new ServiceContainer();
    c.registerFactory('a', (container) => container.get('b'));
    c.registerFactory('b', (container) => container.get('a'));
    expect(() => c.get('a')).toThrow(/Circular/);
  });

  it('registerValue overwrites a prior factory (идемпотентная перерегистрация)', () => {
    const c = new ServiceContainer();
    c.registerFactory('s', () => 'from-factory');
    c.registerValue('s', 'from-value');
    expect(c.get('s')).toBe('from-value');
  });

  it('reset clears one service or all', () => {
    const c = new ServiceContainer();
    c.registerValue('a', 1);
    c.registerValue('b', 2);
    c.reset('a');
    expect(c.has('a')).toBe(false);
    expect(c.has('b')).toBe(true);
    c.reset();
    expect(c.has('b')).toBe(false);
  });
});
