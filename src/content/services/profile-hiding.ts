/** Only the right column needs structural markers; other profile hiding is CSS. */
export const PROFILE_HIDING_FLAGS = ['hide_profile_right_column'];
export function profileHidingTargets(root: Element, kind: string): Element[] {
  if (kind !== 'hide_profile_right_column') return [];
  const targets: Element[] = [];
  for (const aside of root.querySelectorAll('aside')) {
    let column: Element = aside;
    while (column.parentElement && column.parentElement !== root && column.parentElement.children.length === 1) column = column.parentElement;
    targets.push(column);
    const gap = column.nextElementSibling;
    if (gap?.matches('div:empty:not([id]):not([role])')) targets.push(gap);
  }
  return targets;
}
