import { VIDEO_MENU_ITEMS, type VideoMenuItem } from '@/shared/constants/video-menu-items.js';

function exclusiveRow(item: Element, menu: Element): Element {
  let row = item;
  while (row.parentElement && row.parentElement !== menu && row.parentElement.children.length === 1) row = row.parentElement;
  return row;
}

/** Resolve native wrappers without moving React nodes or relying on generated classes. */
export function videoMenuRows(menu: Element, definition: VideoMenuItem, ordering = false): Element[] {
  if (definition.before) {
    const following = VIDEO_MENU_ITEMS.find(item => item.id === definition.before)!;
    return Array.from(menu.querySelectorAll('hr')).map(hr => exclusiveRow(hr, menu)).filter(row => {
      for (let next = row.nextElementSibling; next; next = next.nextElementSibling) {
        if (next.matches(following.selector) || next.querySelector(following.selector)) return true;
        if (next.querySelector('[data-testid], a[href]') || next.matches('[data-testid], a[href]')) return false;
      }
      return false;
    });
  }
  const result = new Set<Element>();
  for (const item of menu.querySelectorAll(definition.selector)) {
    let row = exclusiveRow(item, menu);
    if (definition.id === 'main_menu_authors_list') {
      while (row.parentElement && row.parentElement !== menu
        && Array.from(row.parentElement.querySelectorAll('a, [data-testid]')).every(element => element.matches('[data-testid^="main_menu_block_"]'))) row = row.parentElement;
    } else if (definition.id === 'main_menu_tv_install') {
      for (let parent = row.parentElement; parent && parent !== menu; parent = parent.parentElement) {
        if (parent.querySelector('[data-testid]') || Array.from(parent.querySelectorAll('a')).some(link => link !== item)) break;
        const heading = parent.querySelector('[role="heading"]');
        if (heading) {
          if (ordering) result.add(heading);
          else row = parent;
          break;
        }
      }
    }
    result.add(row);
  }
  return [...result];
}

export function videoMenus(): NodeListOf<Element> { return document.querySelectorAll('[data-testid="video_left_menu"]'); }
