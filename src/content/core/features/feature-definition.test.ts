import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compileFeatureDefinition, type FeatureDefinition } from './feature-definition.js';
import { cssPlugin, settingsPlugin, handlerPlugin, type FeaturePlugin } from './feature-plugin.js';
import type { FeatureContext } from '../feature-context.js';

/** Прогоняет очередь микрозадач (reapply вызывается без await внутри listener). */
const flush = () => new Promise((r) => setTimeout(r, 0));

/**
 * Управляемый фейк FeatureContext: пишет вызовы CSS/маркеров и умеет «выстрелить»
 * изменением ключа настройки (эмулируя storage.onChange).
 */
function makeFakeCtx() {
  const settingChangeListeners = new Map<string, Set<(v: unknown) => void>>();
  const settings: Record<string, unknown> = {};
  const active = new Set<string>();

  const calls = {
    injectCSS: [] as Array<{ id: string; css: string }>,
    removeCSS: [] as string[],
    enableCss: [] as string[],
    disableCss: [] as string[],
    observeMatches: [] as string[],
  };
  const observerUnsubs: Array<() => void> = [];

  const ctx = {
    injectCSS: (id: string, css: string) => calls.injectCSS.push({ id, css }),
    removeCSS: (id: string) => calls.removeCSS.push(id),
    enableCss: (id: string) => calls.enableCss.push(id),
    disableCss: (id: string) => calls.disableCss.push(id),
    observeMatches: (id: string) => {
      calls.observeMatches.push(id);
      const off = vi.fn();
      observerUnsubs.push(off);
      return off;
    },
    observeChanges: () => vi.fn(),
    observeResize: () => vi.fn(),
    waitForElement: () => Promise.resolve(document.createElement('div')),
    getSetting: async (key: string) => settings[key] ?? null,
    setSetting: async (key: string, v: unknown) => { settings[key] = v; },
    getAllSettings: async () => ({ ...settings }),
    onSettingChange: (key: string, cb: (v: unknown) => void) => {
      let set = settingChangeListeners.get(key);
      if (!set) { set = new Set(); settingChangeListeners.set(key, set); }
      set.add(cb);
      return () => set!.delete(cb);
    },
    isActive: (id: string) => active.has(id),
    isEnabled: (id: string) => active.has(id),
    injectScript: vi.fn(),
    sendEvent: vi.fn(),
  } as unknown as FeatureContext;

  return {
    ctx,
    calls,
    observerUnsubs,
    settings,
    active,
    fireSettingChange(key: string, value: unknown) {
      settings[key] = value;
      settingChangeListeners.get(key)?.forEach((cb) => cb(value));
    },
    settingWatcherCount(key: string) {
      return settingChangeListeners.get(key)?.size ?? 0;
    },
  };
}

describe('compileFeatureDefinition', () => {
  let env: ReturnType<typeof makeFakeCtx>;
  beforeEach(() => { env = makeFakeCtx(); });

  it('maps init/destroy onto handler enable/disable', async () => {
    const init = vi.fn();
    const destroy = vi.fn();
    const def: FeatureDefinition = { id: 'f', init, destroy };

    const { id, handler, meta } = compileFeatureDefinition(def, env.ctx);
    expect(id).toBe('f');
    expect(meta.settingsKeys).toBeUndefined();

    await handler.enable!();
    expect(init).toHaveBeenCalledTimes(1);
    expect(init.mock.calls[0][0].id).toBe('f'); // scope передан

    await handler.disable!();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('runs plugin lifecycle (setup → onEnable; onDisable on disable)', async () => {
    const order: string[] = [];
    const cleanup = vi.fn(() => order.push('cleanup'));
    const plugin: FeaturePlugin = {
      setup: () => { order.push('setup'); return cleanup; },
      onEnable: () => { order.push('onEnable'); },
      onDisable: () => { order.push('onDisable'); },
    };
    const def: FeatureDefinition = { id: 'p', plugins: [plugin], init: () => { order.push('init'); } };
    const { handler } = compileFeatureDefinition(def, env.ctx);

    await handler.enable!();
    expect(order).toEqual(['setup', 'onEnable', 'init']);

    await handler.disable!();
    expect(order).toEqual(['setup', 'onEnable', 'init', 'onDisable', 'cleanup']);
  });

  it('cssPlugin toggles the marker via the scope', async () => {
    const def: FeatureDefinition = {
      id: 'widescreen',
      plugins: [cssPlugin(['appearance/layout/widescreen.css'])],
    };
    const { handler } = compileFeatureDefinition(def, env.ctx);

    await handler.enable!();
    expect(env.calls.enableCss).toEqual(['widescreen']);

    await handler.disable!();
    expect(env.calls.disableCss).toEqual(['widescreen']);
  });

  it('does not touch the marker without a cssPlugin', async () => {
    const def: FeatureDefinition = { id: 'noCss', init: () => {} };
    const { handler } = compileFeatureDefinition(def, env.ctx);
    await handler.enable!();
    await handler.disable!();
    expect(env.calls.enableCss).toEqual([]);
    expect(env.calls.disableCss).toEqual([]);
  });

  it('settingsPlugin reapplies on a key change and skips the feature id', async () => {
    const order: string[] = [];
    const def: FeatureDefinition = {
      id: 'theme',
      plugins: [settingsPlugin(['theme', 'accent'])],
      init: () => { order.push('init'); },
      destroy: () => { order.push('destroy'); },
    };
    const { handler } = compileFeatureDefinition(def, env.ctx);

    await handler.enable!();
    expect(order).toEqual(['init']);
    // id-ключ ('theme') пропущен (его отслеживает FeatureManager); следим за 'accent'.
    expect(env.settingWatcherCount('theme')).toBe(0);
    expect(env.settingWatcherCount('accent')).toBe(1);

    env.fireSettingChange('accent', '#fff');
    await flush();
    // reapply — МЯГКАЯ пересборка на месте: init повторяется, но destroy НЕ
    // вызывается (нет teardown → нет «пустого кадра» / мерцания).
    expect(order).toEqual(['init', 'init']);

    // После reapply watcher пересоздан (старый снят, новый навешен) — ровно один.
    expect(env.settingWatcherCount('accent')).toBe(1);

    await handler.disable!();
    expect(order).toEqual(['init', 'init', 'destroy']); // destroy — только на disable
    expect(env.settingWatcherCount('accent')).toBe(0);
  });

  it('scope.reapply re-runs the apply cycle', async () => {
    const init = vi.fn();
    let captured: { reapply: () => void } | null = null;
    const def: FeatureDefinition = {
      id: 'r',
      init: (ctx) => { captured = ctx; init(); },
    };
    const { handler } = compileFeatureDefinition(def, env.ctx);

    await handler.enable!();
    expect(init).toHaveBeenCalledTimes(1);

    captured!.reapply();
    await flush();
    expect(init).toHaveBeenCalledTimes(2);
  });

  it('addCSS accumulates into one style and is cleared on disable', async () => {
    const def: FeatureDefinition = {
      id: 'multi',
      init: (ctx) => { ctx.addCSS('a{}'); ctx.addCSS('b{}'); },
    };
    const { handler } = compileFeatureDefinition(def, env.ctx);

    await handler.enable!();
    expect(env.calls.injectCSS).toEqual([
      { id: 'multi', css: 'a{}' },
      { id: 'multi', css: 'a{}\nb{}' },
    ]);

    await handler.disable!();
    expect(env.calls.removeCSS).toEqual(['multi']);
  });

  it('auto-unsubscribes scope observers on disable', async () => {
    const def: FeatureDefinition = {
      id: 'obs',
      init: (ctx) => { ctx.registerMutationObserver('.x', () => {}); },
    };
    const { handler } = compileFeatureDefinition(def, env.ctx);

    await handler.enable!();
    expect(env.calls.observeMatches).toEqual(['obs']);

    await handler.disable!();
    expect(env.observerUnsubs[0]).toHaveBeenCalled();
  });

  it('handlerPlugin forwards the trigger value to the wrapped enable', async () => {
    const enable = vi.fn();
    const disable = vi.fn();
    const def: FeatureDefinition = { id: 'h', plugins: [handlerPlugin({ enable, disable })] };
    const { handler } = compileFeatureDefinition(def, env.ctx);

    await handler.enable!('live-value'); // напр. value из ENABLE_FEATURE (превью)
    expect(enable).toHaveBeenLastCalledWith('live-value');

    await handler.disable!();
    expect(disable).toHaveBeenCalledTimes(1);
  });

  it('handlerPlugin falls back to getOwnSetting when no trigger value', async () => {
    env.settings['h2'] = 'stored';
    const enable = vi.fn();
    const def: FeatureDefinition = { id: 'h2', plugins: [handlerPlugin({ enable })] };
    const { handler } = compileFeatureDefinition(def, env.ctx);

    await handler.enable!(); // без value (reapply / обычный init)
    expect(enable).toHaveBeenCalledWith('stored');
  });

  it('passes reapplyOnNavigate / matchPath through to the handler', () => {
    const matchPath = (p: string) => p === '/feed';
    const def: FeatureDefinition = {
      id: 'nav', reapplyOnNavigate: true, matchPath, init: () => {},
    };
    const { handler } = compileFeatureDefinition(def, env.ctx);
    expect(handler.reapplyOnNavigate).toBe(true);
    expect(handler.matchPath).toBe(matchPath);
  });
});
