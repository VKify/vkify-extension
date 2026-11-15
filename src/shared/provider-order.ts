/** Complete a saved order without losing newly added or disabled providers. */
export function providerOrder<T extends string>(known: readonly T[], saved: unknown): T[] {
  const ordered = Array.isArray(saved) ? [...new Set(saved.filter((id): id is T => known.includes(id)))] : [];
  return [...ordered, ...known.filter(id => !ordered.includes(id))];
}
