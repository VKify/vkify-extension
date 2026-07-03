// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { derivedCssFeature, derivedCssPlugin, type DerivedCssOutput } from './derived-css-feature.js';
import type { ScopedFeatureContext } from './scoped-context.js';

/** Ручная очередь rAF — управляемый «кадр» вместо реального. */
let rafQueue: FrameRequestCallback[] = [];
function flushRaf(): void {
  for (const cb of rafQueue.splice(0)) cb(0);
}

function mkCtx(settings: Record<string, unknown>, id = 'cw_enabled') {
  const raw = {
    injectCSS: vi.fn(),
    removeCSS: vi.fn(),
    enableCss: vi.fn(),
    disableCss: vi.fn(),
  };
  const ctx = {
    id,
    raw,
    // Плагин читает узкий снимок точечными getSetting (не getAllSettings).
    getSetting: async (key: string) => settings[key] ?? null,
  } as unknown as ScopedFeatureContext;
  return { ctx, raw };
}

beforeEach(() => {
  vi.useFakeTimers();
  rafQueue = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafQueue.push(cb);
    return rafQueue.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => { rafQueue = []; });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  // Чистим :root от переменных, оставшихся после теста.
  const style = document.documentElement.style;
  for (let i = style.length - 1; i >= 0; i--) style.removeProperty(style[i]);
});

describe('derivedCssFeature — форма определения', () => {
  it('собирает плагины и метадату согласованно', () => {
    const def = derivedCssFeature({
      id: 'content_width_enabled',
      name: 'Ширина контента',
      category: 'appearance',
      watch: ['content_width'],
      marker: 'content_width',
      reapplyOnNavigate: true,
      cssFiles: 'appearance/layout/widescreen.css',
      compute: () => null,
    });

    expect(def.phase).toBe('early-css');
    expect(def.impact).toBe('light');
    expect(def.reapplyOnNavigate).toBe(true);
    expect(def.settingsKeys).toEqual(['content_width_enabled', 'content_width']);
    expect(def.cssFiles).toEqual(['appearance/layout/widescreen.css']);
    expect(def.plugins!.map((p) => p.name)).toEqual(['settings', 'derived-css']);
  });

  it('без watch не добавляет settingsPlugin', () => {
    const def = derivedCssFeature({
      id: 'x', name: 'X', category: 'appearance', compute: () => null,
    });
    expect(def.plugins!.map((p) => p.name)).toEqual(['derived-css']);
  });
});

describe('derivedCssPlugin — жизненный цикл', () => {
  it('первое применение: маркер + inline-переменная + немедленный персист', async () => {
    const plugin = derivedCssPlugin({
      marker: 'content_width',
      compute: () => ({ vars: { '--vkify-cw': 'min(1100px, 100vw)' } }),
    });
    const { ctx, raw } = mkCtx({});

    await plugin.onEnable!(ctx);

    expect(raw.enableCss).toHaveBeenCalledWith('content_width');
    expect(document.documentElement.style.getPropertyValue('--vkify-cw'))
      .toBe('min(1100px, 100vw)');
    // Персист сразу (reconcile после init() не должен вычистить зеркало).
    expect(raw.injectCSS).toHaveBeenCalledWith(
      'cw_enabled_vars',
      ':root { --vkify-cw: min(1100px, 100vw); }',
    );
  });

  it('null-compute: визуально выключено — маркер снят, CSS убран', async () => {
    let active = true;
    const plugin = derivedCssPlugin({
      compute: () => (active ? { vars: { '--a': '1' } } : null),
    });
    const { ctx, raw } = mkCtx({}, 'f');

    await plugin.onEnable!(ctx);
    expect(document.documentElement.style.getPropertyValue('--a')).toBe('1');

    active = false;
    await plugin.onEnable!(ctx);

    expect(raw.disableCss).toHaveBeenCalledWith('f');
    expect(document.documentElement.style.getPropertyValue('--a')).toBe('');
    expect(raw.removeCSS).toHaveBeenCalledWith('f_vars');
    expect(raw.removeCSS).toHaveBeenCalledWith('f_css');
  });

  it('пересчёт: DOM-запись коалесируется в кадр, персист — с дебаунсом', async () => {
    let width = 1100;
    const plugin = derivedCssPlugin({
      compute: () => ({ vars: { '--w': `${width}px` } }),
    });
    const { ctx, raw } = mkCtx({}, 'f');

    await plugin.onEnable!(ctx); // первое применение — сразу
    raw.injectCSS.mockClear();

    width = 1200;
    await plugin.onEnable!(ctx); // пересчёт (реактивность watch-ключа)
    width = 1300;
    await plugin.onEnable!(ctx); // ещё до кадра — коалесится

    // До кадра inline не изменился.
    expect(document.documentElement.style.getPropertyValue('--w')).toBe('1100px');
    flushRaf();
    // Один кадр — последнее значение.
    expect(document.documentElement.style.getPropertyValue('--w')).toBe('1300px');

    // Персист ещё не писался (дебаунс).
    expect(raw.injectCSS).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(raw.injectCSS).toHaveBeenCalledWith('f_vars', ':root { --w: 1300px; }');
  });

  it('удаляет устаревшие inline-переменные при смене набора vars', async () => {
    let out: DerivedCssOutput = { vars: { '--a': '1' } };
    const plugin = derivedCssPlugin({ compute: () => out });
    const { ctx } = mkCtx({}, 'f');

    await plugin.onEnable!(ctx);
    expect(document.documentElement.style.getPropertyValue('--a')).toBe('1');

    out = { vars: { '--b': '2' } };
    await plugin.onEnable!(ctx);
    flushRaf();

    expect(document.documentElement.style.getPropertyValue('--a')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--b')).toBe('2');
  });

  it('сгенерированный CSS-текст инжектируется под <id>_css', async () => {
    const plugin = derivedCssPlugin({
      compute: () => ({ css: '.avatar { border-radius: 50%; }' }),
    });
    const { ctx, raw } = mkCtx({}, 'br');

    await plugin.onEnable!(ctx);

    expect(raw.injectCSS).toHaveBeenCalledWith('br_css', '.avatar { border-radius: 50%; }');
    // vars нет — их зеркало убирается.
    expect(raw.removeCSS).toHaveBeenCalledWith('br_vars');
  });

  it('onDisable: полный teardown (маркер, переменные, оба CSS-id, таймеры)', async () => {
    let width = 100;
    const plugin = derivedCssPlugin({
      marker: 'm',
      compute: () => ({ vars: { '--w': `${width}px` } }),
    });
    const { ctx, raw } = mkCtx({}, 'f');

    await plugin.onEnable!(ctx);
    width = 200;
    await plugin.onEnable!(ctx); // запланирован rAF + (после кадра) дебаунс-персист
    flushRaf();
    raw.injectCSS.mockClear();

    await plugin.onDisable!(ctx);

    expect(raw.disableCss).toHaveBeenCalledWith('m');
    expect(document.documentElement.style.getPropertyValue('--w')).toBe('');
    expect(raw.removeCSS).toHaveBeenCalledWith('f_vars');
    expect(raw.removeCSS).toHaveBeenCalledWith('f_css');

    // Отложенный персист отменён — после disable ничего не пишется.
    vi.advanceTimersByTime(500);
    expect(raw.injectCSS).not.toHaveBeenCalled();
  });

  it('после teardown повторное включение снова персистит немедленно', async () => {
    const plugin = derivedCssPlugin({ compute: () => ({ vars: { '--a': '1' } }) });
    const { ctx, raw } = mkCtx({}, 'f');

    await plugin.onEnable!(ctx);
    await plugin.onDisable!(ctx);
    raw.injectCSS.mockClear();

    await plugin.onEnable!(ctx);
    expect(raw.injectCSS).toHaveBeenCalledWith('f_vars', ':root { --a: 1; }');
  });
});
