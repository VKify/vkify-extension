import type { FeatureContext } from '@/content/core/feature-context.js';
import { handlerFeature } from '@/content/core/features/index.js';
import { normalizeVideoMenuOrder, VIDEO_MENU_ITEMS } from '@/shared/constants/video-menu-items.js';
import { videoMenuRows, videoMenus } from './video-menu-dom.js';

export function createVideoMenuOrderFeature(ctx: FeatureContext) {
  const id = 'video_menu_items_order';
  let off: (() => void) | undefined;
  let marked = new Map<Element, Set<string>>();
  const sync = (): void => {
    const next = new Map<Element, Set<string>>();
    const mark = (element: Element, name: string, value = ''): void => {
      const attribute = `data-vkify-video-menu-order-${name}`;
      if (element.getAttribute(attribute) !== value) element.setAttribute(attribute, value);
      const attributes = next.get(element) ?? new Set<string>();
      attributes.add(attribute); next.set(element, attributes);
    };
    for (const menu of videoMenus()) {
      const rows = VIDEO_MENU_ITEMS.flatMap(item => videoMenuRows(menu, item, true).map(row => ({ row, id: item.id })));
      if (rows.length < 2) continue;
      let root = rows[0].row.parentElement;
      while (root && root !== menu && !rows.every(({ row }) => root!.contains(row))) root = root.parentElement;
      if (!root || !rows.every(({ row }) => root!.contains(row))) continue;
      mark(root, 'root');
      const rowSet = new Set(rows.map(entry => entry.row));
      for (const { row, id: itemId } of rows) {
        mark(row, 'row', itemId);
        for (let parent = row.parentElement; parent && parent !== root; parent = parent.parentElement) {
          // Subscribed creators remain an atomic group.
          if (rowSet.has(parent)) break;
          mark(parent, 'wrapper');
        }
      }
    }
    for (const [element, attributes] of marked) for (const attribute of attributes) {
      if (!next.get(element)?.has(attribute)) element.removeAttribute(attribute);
    }
    marked = next;
  };
  return handlerFeature({ id, name: 'Порядок меню VK Видео', category: 'hiding', requiresDomLayer: true, reapplyOnUpdate: true,
    handler: {
      enable: (value: unknown): void => {
        const order = normalizeVideoMenuOrder(value);
        ctx.injectCSS(`${id}_css`, '[data-vkify-video-menu-order-root]{display:flex!important;flex-direction:column!important;gap:6px!important}'
          + '[data-vkify-video-menu-order-wrapper]:not([data-vkify-video-menu-hidden]){display:contents!important}'
          + `[data-vkify-video-menu-order-root]>*,[data-vkify-video-menu-order-wrapper]>*{order:${order.length}!important}`
          + '[data-vkify-video-menu-order-root]>:empty,[data-vkify-video-menu-order-wrapper]>:empty{display:none!important}'
          + order.map((item, index) => `[data-vkify-video-menu-order-row="${item}"]{order:${index}!important}`).join(''));
        if (!off) off = ctx.observeChanges(id, sync);
        sync();
      },
      disable: (): void => {
        off?.(); off = undefined;
        for (const [element, attributes] of marked) for (const attribute of attributes) element.removeAttribute(attribute);
        marked.clear(); ctx.removeCSS(`${id}_css`);
      },
    },
  });
}
