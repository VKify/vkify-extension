import type { FeatureContext } from '@/content/core/feature-context.js';
import { handlerFeature } from '@/content/core/features/index.js';
import { VIDEO_MENU_ITEMS } from '@/shared/constants/video-menu-items.js';
import { videoMenuRows, videoMenus } from './video-menu-dom.js';

export function createVideoMenuItemsFeature(ctx: FeatureContext) {
  const id = 'hidden_video_menu_items';
  const attribute = 'data-vkify-video-menu-hidden';
  let ids: readonly string[] = [];
  let marked = new Set<Element>();
  let off: (() => void) | undefined;
  const sync = (): void => {
    const next = new Set<Element>();
    for (const definition of VIDEO_MENU_ITEMS.filter(item => ids.includes(item.id))) {
      for (const menu of videoMenus()) for (const row of videoMenuRows(menu, definition)) {
        if (!row.hasAttribute(attribute)) row.setAttribute(attribute, '');
        next.add(row);
      }
    }
    for (const row of marked) if (!next.has(row)) row.removeAttribute(attribute);
    marked = next;
  };
  return handlerFeature({ id, name: 'Пункты меню VK Видео', category: 'hiding', requiresDomLayer: true, reapplyOnUpdate: true,
    handler: {
      enable: (value: unknown): void => {
        ids = Array.isArray(value) ? VIDEO_MENU_ITEMS.filter(item => value.includes(item.id)).map(item => item.id) : [];
        ctx.injectCSS(`${id}_css`, `[${attribute}]{display:none!important}`);
        if (!off) off = ctx.observeChanges(id, sync);
        sync();
      },
      disable: (): void => {
        off?.(); off = undefined;
        for (const row of marked) row.removeAttribute(attribute);
        marked.clear(); ids = [];
        ctx.removeCSS(`${id}_css`);
      },
    },
  });
}
