/** Move one item to the indicated edge of a drop target. Invalid drops are no-ops. */
export function moveInOrder<T extends string>(items: readonly T[], from: T, target: T, after: boolean): T[] {
  if (from === target || !items.includes(from) || !items.includes(target)) return [...items];
  const next = items.filter(id => id !== from);
  next.splice(next.indexOf(target) + (after ? 1 : 0), 0, from);
  return next;
}
