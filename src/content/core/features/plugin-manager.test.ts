import { describe, it, expect, vi } from 'vitest';
import { PluginManager, orderPlugins } from './plugin-manager.js';
import { createFeatureScope } from './scoped-context.js';
import type { FeaturePlugin } from './feature-plugin.js';
import type { FeatureContext } from '../feature-context.js';

const scopeFor = (id = 'f') => createFeatureScope(id, {} as unknown as FeatureContext);
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('orderPlugins', () => {
  it('orders by priority, then declaration index', () => {
    const a: FeaturePlugin = { name: 'a', priority: 50 };
    const b: FeaturePlugin = { name: 'b', priority: 10 };
    const c: FeaturePlugin = { name: 'c' }; // default 100
    expect(orderPlugins([a, b, c]).map((p) => p.name)).toEqual(['b', 'a', 'c']);
  });

  it('puts a dependsOn target before its dependent regardless of priority', () => {
    const base: FeaturePlugin = { name: 'base', priority: 200 };
    const dep: FeaturePlugin = { name: 'dep', priority: 1, dependsOn: ['base'] };
    expect(orderPlugins([dep, base]).map((p) => p.name)).toEqual(['base', 'dep']);
  });

  it('tolerates unknown deps and cycles with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const a: FeaturePlugin = { name: 'a', dependsOn: ['b'] };
    const b: FeaturePlugin = { name: 'b', dependsOn: ['a'] };
    expect(orderPlugins([a, b])).toHaveLength(2);
    const x: FeaturePlugin = { name: 'x', dependsOn: ['ghost'] };
    expect(orderPlugins([x]).map((p) => p.name)).toEqual(['x']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('PluginManager', () => {
  it('runs enable (setup→onEnable→init) and disable (destroy→onDisable reverse→cleanup)', async () => {
    const order: string[] = [];
    const mk = (n: string): FeaturePlugin => ({
      name: n,
      setup: () => { order.push(`setup:${n}`); return () => order.push(`cleanup:${n}`); },
      onEnable: () => { order.push(`onEnable:${n}`); },
      onDisable: () => { order.push(`onDisable:${n}`); },
    });
    const pm = new PluginManager(scopeFor(), [mk('a'), mk('b')], {
      init: () => { order.push('init'); },
      destroy: () => { order.push('destroy'); },
    });

    await pm.enable();
    expect(order).toEqual(['setup:a', 'setup:b', 'onEnable:a', 'onEnable:b', 'init']);

    order.length = 0;
    await pm.disable();
    expect(order).toEqual(['destroy', 'onDisable:b', 'onDisable:a', 'cleanup:a', 'cleanup:b']);
  });

  it('respects plugin order for onEnable', async () => {
    const seen: string[] = [];
    const p = (n: string, priority: number): FeaturePlugin => ({ name: n, priority, onEnable: () => { seen.push(n); } });
    const pm = new PluginManager(scopeFor(), [p('late', 90), p('early', 10)], {});
    await pm.enable();
    expect(seen).toEqual(['early', 'late']);
  });

  it('reapply via the scope re-runs the cycle', async () => {
    const onEnable = vi.fn();
    const scope = scopeFor();
    const pm = new PluginManager(scope, [{ name: 'p', onEnable }], {});
    await pm.enable();
    expect(onEnable).toHaveBeenCalledTimes(1);

    scope.reapply();
    await flush();
    expect(onEnable).toHaveBeenCalledTimes(2);
  });

  it('reapply does NOT tear down (no onDisable/destroy) — flicker-free in-place update', async () => {
    const onEnable = vi.fn();
    const onDisable = vi.fn();
    const destroy = vi.fn();
    const scope = scopeFor();
    const pm = new PluginManager(scope, [{ name: 'p', onEnable, onDisable }], { destroy });

    await pm.enable();
    scope.reapply();
    await flush();

    // onEnable повторился (состояние заменилось на месте)…
    expect(onEnable).toHaveBeenCalledTimes(2);
    // …но НИ onDisable, НИ destroy не вызывались на reapply (нет «пустого кадра»).
    expect(onDisable).not.toHaveBeenCalled();
    expect(destroy).not.toHaveBeenCalled();

    // Полный teardown — только на явном disable().
    await pm.disable();
    expect(onDisable).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
