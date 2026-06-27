import { describe, it, expect, vi } from 'vitest';
import { topoSort, type TopoSortSpec } from './topo-sort.js';

/** Узлы-строки с зависимостями — компактная модель для проверки алгоритма. */
function specFor(
  graph: Record<string, string[]>,
  extra: Partial<TopoSortSpec<string>> = {},
): TopoSortSpec<string> {
  return {
    deps: (id) => graph[id] ?? [],
    resolveDep: (dep) => (dep in graph ? dep : undefined),
    compare: (a, b) => a.localeCompare(b),
    key: (id) => id,
    ...extra,
  };
}

describe('topoSort', () => {
  it('orders dependencies before dependents', () => {
    const out = topoSort(['app', 'core'], specFor({ app: ['core'], core: [] }));
    expect(out).toEqual(['core', 'app']);
  });

  it('breaks ties deterministically via compare on the roots', () => {
    // Нет зависимостей → порядок целиком определяется compare (по алфавиту).
    const out = topoSort(['c', 'a', 'b'], specFor({ a: [], b: [], c: [] }));
    expect(out).toEqual(['a', 'b', 'c']);
  });

  it('resolves transitive chains', () => {
    const out = topoSort(['a', 'b', 'c'], specFor({ a: ['b'], b: ['c'], c: [] }));
    expect(out).toEqual(['c', 'b', 'a']);
  });

  it('reports unresolved deps via onSkippedDep and keeps the node', () => {
    const onSkippedDep = vi.fn();
    const out = topoSort(['x'], specFor({ x: ['ghost'] }, { onSkippedDep }));
    expect(out).toEqual(['x']);
    expect(onSkippedDep).toHaveBeenCalledWith('x', 'ghost');
  });

  it('breaks cycles via onCycle without infinite recursion', () => {
    const onCycle = vi.fn();
    const out = topoSort(['a', 'b'], specFor({ a: ['b'], b: ['a'] }, { onCycle }));
    expect(out).toHaveLength(2);
    expect(onCycle).toHaveBeenCalled();
  });

  it('excludes nodes not present in items (resolveDep returns undefined)', () => {
    // 'b' зависимость, но не в items и не разрешается → пропуск, в выводе только 'a'.
    const out = topoSort(['a'], {
      deps: (id) => (id === 'a' ? ['b'] : []),
      resolveDep: () => undefined,
      compare: (a, b) => a.localeCompare(b),
    });
    expect(out).toEqual(['a']);
  });
});
