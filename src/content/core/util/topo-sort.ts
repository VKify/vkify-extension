/**
 * Обобщённая топологическая сортировка (DFS, post-order) с детерминированным
 * порядком корней и толерантностью к битым/циклическим зависимостям.
 *
 * Вынесена из двух почти идентичных реализаций — `FeatureRegistry.resolveDependencies`
 * (сортировка фич по их зависимостям) и `PluginManager.orderPlugins` (сортировка
 * плагинов одной фичи). Обе теперь — тонкие обёртки над этим алгоритмом
 * (паттерн Strategy: вызывающий задаёт identity/deps/порядок/диагностику).
 *
 * Контракт совпадает с прежними реализациями:
 *   • корни обходятся в порядке `compare` (детерминированный тай-брейк);
 *   • зависимости каждого узла раскрываются раньше него (post-order push);
 *   • неразрешимая зависимость пропускается через `onSkippedDep` (не падаем);
 *   • цикл разрывается на повторно посещаемом узле через `onCycle` (связь
 *     игнорируется, обход продолжается).
 */

export interface TopoSortSpec<T> {
  /** Зависимости узла — ключи, которые должны отработать раньше него. */
  deps(item: T): readonly string[];
  /** Разрешает ключ зависимости в сортируемый узел (или undefined — пропуск). */
  resolveDep(dep: string): T | undefined;
  /** Порядок обхода корней; задаёт детерминированный тай-брейк. */
  compare(a: T, b: T): number;
  /** Человекочитаемый ключ узла — только для диагностики. */
  key?(item: T): string | undefined;
  /** Зависимость не разрешилась (resolveDep вернул undefined). */
  onSkippedDep?(itemKey: string | undefined, dep: string): void;
  /** Обнаружен цикл на узле (его связь проигнорирована). */
  onCycle?(itemKey: string | undefined): void;
}

/**
 * Возвращает `items` в безопасном по зависимостям порядке. Узлы, не входящие в
 * `items`, в результат не попадают (resolveDep отвечает за «что считается узлом»).
 */
export function topoSort<T>(items: readonly T[], spec: TopoSortSpec<T>): T[] {
  const { deps, resolveDep, compare, key, onSkippedDep, onCycle } = spec;

  const roots = [...items].sort(compare);
  const result: T[] = [];
  const visited = new Set<T>();
  const visiting = new Set<T>();

  const visit = (item: T): void => {
    if (visited.has(item)) return;
    if (visiting.has(item)) {
      onCycle?.(key?.(item));
      return;
    }
    visiting.add(item);

    for (const dep of deps(item)) {
      const target = resolveDep(dep);
      if (!target) {
        onSkippedDep?.(key?.(item), dep);
        continue;
      }
      visit(target);
    }

    visiting.delete(item);
    visited.add(item);
    result.push(item);
  };

  for (const root of roots) visit(root);
  return result;
}
