// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeatureManager } from './feature-manager.js';
import type { StorageManager } from './storage.js';

/** Минимальный storage-дубль: фичам в этих тестах хватает get/getAll/onChange. */
const fakeStorage = {
  getAll: async () => ({}),
  get: async () => null,
  set: async () => {},
  onChange: () => () => {},
} as unknown as StorageManager;

function mkManager() {
  const perf = {
    recordFeatureInit: vi.fn(),
    addFeatureRuntime: vi.fn(),
    clearFeature: vi.fn(),
  };
  // domObserver/vkApi не задействованы этими тестами — оставляем дефолтные.
  const fm = new FeatureManager(fakeStorage, { perfCollector: perf as never });
  return { fm, perf };
}

describe('FeatureManager — Result-паттерн активации', () => {
  let errSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { errSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); });

  it('фиксирует упавшую фичу вместо «молчаливого» проглатывания', async () => {
    const { fm } = mkManager();
    fm.registerHandlerFeature('boom', { enable: () => { throw new Error('kaboom'); }, disable: () => {} });

    await fm.enable('boom', true);

    expect(fm.isActive('boom')).toBe(false);
    expect(fm.getFailedFeatures()).toEqual([{ id: 'boom', error: 'kaboom' }]);
    expect(errSpy).toHaveBeenCalled();
  });

  it('очищает failed-состояние при успешной активации', async () => {
    let shouldThrow = true;
    const { fm, perf } = mkManager();
    fm.registerHandlerFeature('flaky', { enable: () => { if (shouldThrow) throw new Error('x'); }, disable: () => {} });

    await fm.enable('flaky');
    expect(fm.getFailedFeatures()).toHaveLength(1);

    shouldThrow = false;
    await fm.enable('flaky');

    expect(fm.getFailedFeatures()).toEqual([]);
    expect(fm.isActive('flaky')).toBe(true);
    expect(perf.recordFeatureInit).toHaveBeenCalledWith('flaky', expect.any(Number));
  });

  it('disable снимает фичу из failed-набора', async () => {
    const { fm } = mkManager();
    fm.registerHandlerFeature('boom', { enable: () => { throw new Error('e'); }, disable: () => {} });
    await fm.enable('boom');
    expect(fm.getFailedFeatures()).toHaveLength(1);

    await fm.disable('boom');
    expect(fm.getFailedFeatures()).toEqual([]);
  });
});

describe('FeatureManager — reapply vs enable', () => {
  it('reapply переактивирует без жёсткого disable-перед-enable', async () => {
    const enable = vi.fn();
    const disable = vi.fn();
    const { fm } = mkManager();
    fm.registerHandlerFeature('f', { enable, disable });

    await fm.enable('f', true);
    expect(enable).toHaveBeenCalledTimes(1);
    expect(disable).not.toHaveBeenCalled();

    await fm.reapply('f', true);
    expect(enable).toHaveBeenCalledTimes(2);
    expect(disable).not.toHaveBeenCalled(); // ключевое: без teardown (нет мерцания)
    expect(fm.isActive('f')).toBe(true);
  });

  it('повторный enable активной фичи ДЕЛАЕТ жёсткий сброс (disable → enable)', async () => {
    const enable = vi.fn();
    const disable = vi.fn();
    const { fm } = mkManager();
    fm.registerHandlerFeature('f', { enable, disable });

    await fm.enable('f', true);
    await fm.enable('f', true);

    expect(disable).toHaveBeenCalledTimes(1);
    expect(enable).toHaveBeenCalledTimes(2);
  });
});

describe('FeatureManager — телеметрия ресурсов', () => {
  it('snapshot() отдаёт нулевые счётчики на чистом менеджере', () => {
    const { fm } = mkManager();
    expect(fm.telemetry.snapshot()).toEqual({
      injectedStyles: 0,
      injectedCssBytes: 0,
      cssMarkers: 0,
      injectedScripts: 0,
    });
  });
});
