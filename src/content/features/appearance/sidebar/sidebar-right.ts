import type { FeaturePlugin } from '@/content/core/features/feature-plugin.js';

/** Mirror VK's own right offsets without overwriting them, so its chat layout
 * can still reposition windows and disabling the feature restores them exactly. */
export const rightChatPlugin: FeaturePlugin = {
  name: 'right-sidebar-chats',
  setup(ctx) {
    const windows = new Set<HTMLElement>();
    const sync = (element: HTMLElement) => {
      const value = element.style.right || (!document.documentElement.hasAttribute('data-vkify-sidebar_right') ? getComputedStyle(element).right : '');
      if (value && value !== 'auto' && element.style.getPropertyValue('--vkify-chat-left') !== value)
        element.style.setProperty('--vkify-chat-left', value);
    };
    const observer = new MutationObserver(records => {
      for (const record of records) if (record.target instanceof HTMLElement) sync(record.target);
    });
    ctx.registerMutationObserver('.FCApp .FCWindow', element => {
      if (!(element instanceof HTMLElement)) return;
      for (const old of windows) if (!old.isConnected) windows.delete(old);
      if (windows.has(element)) return;
      windows.add(element);
      sync(element);
      observer.observe(element, { attributes: true, attributeFilter: ['style'] });
    });
    return () => {
      observer.disconnect();
      windows.forEach(element => element.style.removeProperty('--vkify-chat-left'));
      windows.clear();
    };
  },
};
