import type { FeaturePlugin } from '@/content/core/features/feature-plugin.js';

/** Add a real keyboard-accessible trigger without replacing VK's footer links. */
export const miniFooterPlugin: FeaturePlugin = {
  name: 'mini-footer',
  setup(ctx) {
    const cleanups = new Map<Element, () => void>();
    ctx.registerMutationObserver('#ads_with_extra', root => {
      cleanups.forEach((cleanup, element) => { if (!element.isConnected) { cleanup(); cleanups.delete(element); } });
      if (!(root instanceof HTMLElement)) return;
      if (root.querySelector(':scope > [data-vkify-footer-trigger]')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.vkifyFooterTrigger = '';
      button.setAttribute('aria-label', document.documentElement.lang.startsWith('ru') ? 'Ссылки ВКонтакте' : 'VK links');
      button.setAttribute('aria-expanded', 'false');
      button.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';
      root.prepend(button);
      const stopRepair = ctx.observeChanges(() => {
        if (root.isConnected && button.parentElement !== root) root.prepend(button);
      }, { container: root, schedule: 'frame' });
      let timer: ReturnType<typeof setTimeout> | undefined;
      let pointerInside = false;
      const close = () => {
        clearTimeout(timer);
        root.removeAttribute('data-vkify-footer-open');
        button.setAttribute('aria-expanded', 'false');
      };
      const open = () => {
        clearTimeout(timer);
        const panel = root.querySelector<HTMLElement>(':scope > div');
        if (!panel) return;
        root.setAttribute('data-vkify-footer-open', '');
        button.setAttribute('aria-expanded', 'true');
        const box = button.getBoundingClientRect();
        const left = document.documentElement.hasAttribute('data-vkify-sidebar_right')
          ? box.left - panel.offsetWidth - 6 : box.right + 6;
        root.style.setProperty('--vkify-footer-left', `${Math.max(8, Math.min(left, innerWidth - panel.offsetWidth - 8))}px`);
        root.style.setProperty('--vkify-footer-top', `${Math.max(8, Math.min(box.top, innerHeight - panel.offsetHeight - 8))}px`);
      };
      const leave = () => {
        pointerInside = false;
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (!root.contains(document.activeElement) && !pointerInside) close();
        }, 300);
      };
      const focusOut = () => {
        clearTimeout(timer);
        timer = setTimeout(() => { if (!root.contains(document.activeElement) && !pointerInside) close(); }, 0);
      };
      const outside = (event: PointerEvent) => {
        if (!root.hasAttribute('data-vkify-footer-open') || !(event.target instanceof Node)) return;
        if (root.contains(event.target)) { pointerInside = true; clearTimeout(timer); return; }
        // The detached popup has a small horizontal gap. Keep that bridge
        // interactive too, so slow crossings do not race the close timer.
        const panel = root.querySelector<HTMLElement>(':scope > div');
        if (panel) {
          const triggerBox = button.getBoundingClientRect(), panelBox = panel.getBoundingClientRect();
          const gapLeft = Math.min(triggerBox.right, panelBox.right), gapRight = Math.max(triggerBox.left, panelBox.left);
          if (event.clientX >= gapLeft && event.clientX <= gapRight &&
              event.clientY >= Math.max(triggerBox.top, panelBox.top) && event.clientY <= Math.min(triggerBox.bottom, panelBox.bottom)) {
            pointerInside = true; clearTimeout(timer); return;
          }
        }
        leave();
      };
      const click = () => { if (root.hasAttribute('data-vkify-footer-open')) close(); else open(); };
      const enter = () => { pointerInside = true; open(); };
      const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { button.focus(); close(); event.stopPropagation(); } };
      root.addEventListener('mouseenter', enter);
      root.addEventListener('mouseleave', leave);
      root.addEventListener('focusin', open);
      root.addEventListener('focusout', focusOut);
      root.addEventListener('keydown', key as EventListener);
      button.addEventListener('click', click);
      document.addEventListener('pointermove', outside);
      // Keyboard navigation can scroll the focused trigger into view.
      const reposition = () => { if (root.contains(document.activeElement)) open(); else close(); };
      window.addEventListener('scroll', reposition, true);
      window.addEventListener('resize', reposition);
      cleanups.set(root, () => {
        stopRepair(); close(); button.remove();
        root.style.removeProperty('--vkify-footer-left'); root.style.removeProperty('--vkify-footer-top');
        root.removeEventListener('mouseenter', enter); root.removeEventListener('mouseleave', leave);
        root.removeEventListener('focusin', open); root.removeEventListener('focusout', focusOut);
        root.removeEventListener('keydown', key as EventListener);
        document.removeEventListener('pointermove', outside);
        window.removeEventListener('scroll', reposition, true); window.removeEventListener('resize', reposition);
      });
    });
    return () => cleanups.forEach(cleanup => cleanup());
  },
};
