// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeatureManager } from './feature-manager.js';
import { handlerFeature } from './features/index.js';
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
    fm.registerDefinition(handlerFeature({
      id: 'boom',
      handler: { enable: () => { throw new Error('kaboom'); }, disable: () => {} },
    }));

    await fm.enable('boom', true);

    expect(fm.isActive('boom')).toBe(false);
    expect(fm.getFailedFeatures()).toEqual([{ id: 'boom', error: 'kaboom' }]);
    expect(errSpy).toHaveBeenCalled();
  });

  it('очищает failed-состояние при успешной активации', async () => {
    let shouldThrow = true;
    const { fm, perf } = mkManager();
    fm.registerDefinition(handlerFeature({
      id: 'flaky',
      handler: { enable: () => { if (shouldThrow) throw new Error('x'); }, disable: () => {} },
    }));

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
    fm.registerDefinition(handlerFeature({
      id: 'boom',
      handler: { enable: () => { throw new Error('e'); }, disable: () => {} },
    }));
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
    fm.registerDefinition(handlerFeature({ id: 'f', handler: { enable, disable } }));

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
    fm.registerDefinition(handlerFeature({ id: 'f', handler: { enable, disable } }));

    await fm.enable('f', true);
    await fm.enable('f', true);

    expect(disable).toHaveBeenCalledTimes(1);
    expect(enable).toHaveBeenCalledTimes(2);
  });

  it('reapplyOnUpdate: повторный enable активной фичи НЕ делает disable (нет мерцания)', async () => {
    const enable = vi.fn();
    const disable = vi.fn();
    const { fm } = mkManager();
    fm.registerDefinition(handlerFeature({
      id: 'f',
      handler: { enable, disable, reapplyOnUpdate: true },
    }));

    await fm.enable('f', true);
    await fm.enable('f', '#abcdef'); // смена значения (как боевой коммит цвета)

    expect(disable).not.toHaveBeenCalled(); // ключевое: без кадра-сброса
    expect(enable).toHaveBeenCalledTimes(2);
    expect(enable).toHaveBeenLastCalledWith('#abcdef');
    expect(fm.isActive('f')).toBe(true);
  });
});

describe('FeatureManager — предупреждения о конфликтах фич', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    // spyOn на уже замоканной функции возвращает тот же mock — историю чистим явно.
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnSpy.mockClear();
  });

  // Пара из shared/constants/feature-conflicts.ts — реестр деривирует
  // conflictsWith из неё автоматически (единый источник истины).
  const A = 'filter_grayscale';
  const B = 'filter_sepia';
  const feature = (id: string) =>
    handlerFeature({ id, handler: { enable: () => {}, disable: () => {} } });

  it('активация второй фичи конфликтующей пары — warn + событие feature:conflict', async () => {
    const { fm } = mkManager();
    fm.registerDefinition(feature(A));
    fm.registerDefinition(feature(B));

    const conflicts: Array<{ id: string; with: string; reason: string }> = [];
    fm.eventBus.on('feature:conflict', (p) => conflicts.push(p));

    await fm.enable(A);
    expect(conflicts).toEqual([]); // вторая сторона ещё не активна

    await fm.enable(B);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].id).toBe(B);
    expect(conflicts[0].with).toBe(A);
    expect(conflicts[0].reason.length).toBeGreaterThan(0);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    // Обе фичи продолжают работать — конфликт информационный.
    expect(fm.isActive(A)).toBe(true);
    expect(fm.isActive(B)).toBe(true);
  });

  it('не предупреждает, когда вторая сторона неактивна', async () => {
    const { fm } = mkManager();
    fm.registerDefinition(feature(A));

    await fm.enable(A);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('conflictsWith попадает в метадату из shared-карты', () => {
    const { fm } = mkManager();
    fm.registerDefinition(feature(A));

    expect(fm.featureRegistry.getMeta(A)?.conflictsWith).toContain(B);
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
