/** Avoid triggering style invalidation when a theme input has not changed. */
export function setThemeProperty(root: HTMLElement, name: string, value?: string): void {
  if (value === undefined) {
    if (root.style.getPropertyValue(name)) root.style.removeProperty(name);
  } else if (root.style.getPropertyValue(name) !== value) root.style.setProperty(name, value);
}

export function setThemeMarker(root: HTMLElement, name: string, enabled: boolean): void {
  if (enabled) {
    if (root.getAttribute(name) !== 'true') root.setAttribute(name, 'true');
  } else if (root.hasAttribute(name)) root.removeAttribute(name);
}
