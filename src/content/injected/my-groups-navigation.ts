/** VK's router lives in MAIN world, outside the extension's isolated context. */
(() => {
  const targetHref = '/groups/my_all_groups';

  document.addEventListener('click', (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest<HTMLAnchorElement>('a[data-vkify-my-groups="1"]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;

    const nav = (window as Window & { nav?: { go?: (href: string) => unknown } }).nav;
    if (typeof nav?.go !== 'function') return; // Leave native VK navigation intact.
    try {
      nav.go(targetHref);
    } catch {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
})();
