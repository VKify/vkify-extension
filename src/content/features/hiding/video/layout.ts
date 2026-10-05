import type { FeatureContext } from '@/content/core/feature-context.js';
import { queryShadowAll } from '@/content/utils/video-player.js';

type LayoutFeature = 'hide_video_comments' | 'hide_video_recommendations' | 'hide_video_categories' | 'hide_video_login_prompt' | 'hide_video_playlist';
const PLAYER = 'video, [role="region"][aria-label="Видеоплеер"], [role="region"][aria-label="Video player"]';

/** Climb only wrappers exclusively occupied by the hidden block. */
function exclusiveWrapper(start: Element, boundary: Element): Element {
  let current = start;
  while (current.parentElement && current.parentElement !== boundary && current.parentElement.children.length === 1) {
    current = current.parentElement;
  }
  return current;
}

export function createVideoLayoutFeature(ctx: FeatureContext, id: LayoutFeature) {
  let off: (() => void) | undefined;
  let marked = new Map<Element, Set<string>>();
  const sync = (): void => {
    const next = new Map<Element, Set<string>>();
    const mark = (element: Element, name: string): void => {
      const attribute = `data-vkify-${name}`;
      if (!element.hasAttribute(attribute)) element.setAttribute(attribute, '');
      const attributes = next.get(element) ?? new Set<string>();
      attributes.add(attribute);
      next.set(element, attributes);
    };
    if (id === 'hide_video_comments') {
      for (const count of document.querySelectorAll('#spa_root [data-testid="video-comments-count"]')) {
        const section = count.closest('section');
        if (!section) continue;
        const children = Array.from(section.children);
        const first = children.findIndex(child => child.contains(count));
        // The player precedes the comments header in its own branch, outside video-page-info.
        for (const child of children.slice(first)) {
          if (child.matches('[data-testid="video-page-info"]') || child.querySelector('[data-testid="video-page-info"]')
            || (!child.matches('[data-testid="comment"]') && !child.querySelector('[data-testid="comment"]')
              && (child.matches(PLAYER) || queryShadowAll(PLAYER, child).length
                || (child.shadowRoot && queryShadowAll(PLAYER, child.shadowRoot).length)))) continue;
          mark(child, 'video-comment-block');
        }
      }
    } else if (id === 'hide_video_recommendations') {
      for (const related of document.querySelectorAll('#spa_root #video_recommendations')) {
        mark(related, 'video-related-block');
        let side = related.parentElement;
        while (side && side.id !== 'spa_root') {
          const layout = side.parentElement;
          const main = layout && Array.from(layout.children).find(child => child.getAttribute('role') === 'main'
            && child.querySelector('[data-testid="video-page-info"]'));
          if (layout && main && main !== side && layout.children.length === 2) {
            mark(layout, 'video-wide-layout');
            mark(main, 'video-wide-main');
            mark(side, 'video-wide-side');
            for (let inner = related.parentElement; inner && inner !== side; inner = inner.parentElement) mark(inner, 'video-wide-side-inner');
            break;
          }
          side = layout;
        }
      }
    } else if (id === 'hide_video_playlist') {
      for (const playlist of document.querySelectorAll('#spa_root [data-testid="video_page_playlist_videos"]')) {
        mark(playlist, 'video-playlist-block');
        const spacer = playlist.nextElementSibling;
        if (spacer && !spacer.children.length && !spacer.textContent?.trim()) mark(spacer, 'video-playlist-block');
        let side = playlist.parentElement;
        while (side && side.id !== 'spa_root') {
          const layout = side.parentElement;
          const main = layout && Array.from(layout.children).find(child => child.getAttribute('role') === 'main'
            && child.querySelector('[data-testid="video-page-info"]'));
          if (layout && main && main !== side && layout.children.length === 2) {
            if (!side.querySelector('#video_recommendations')) {
              mark(layout, 'video-playlist-wide-layout'); mark(main, 'video-playlist-wide-main'); mark(side, 'video-playlist-wide-side');
              for (let inner = playlist.parentElement; inner && inner !== side; inner = inner.parentElement) mark(inner, 'video-playlist-wide-side-inner');
            }
            break;
          }
          side = layout;
        }
      }
    } else if (id === 'hide_video_categories') {
      for (const tabs of document.querySelectorAll('#spa_root [role="tablist"]:has([data-testid="tab-/"])')) {
        const header = tabs.closest('[data-testid="headerlayout"]');
        const boundary = tabs.closest('section') ?? document.querySelector('#spa_root');
        if (boundary) {
          mark(exclusiveWrapper(tabs, boundary), 'video-categories-block');
          if (header) mark(exclusiveWrapper(header, boundary), 'video-categories-shell');
        }
      }
    } else {
      for (const button of document.querySelectorAll('[data-testid="video_left_menu"] [data-testid="main-menu-sign-in-btn"]')) {
        const section = button.closest('section');
        const menu = button.closest('[data-testid="video_left_menu"]');
        if (section && menu) mark(exclusiveWrapper(section, menu), 'video-login-block');
      }
    }
    for (const [element, attributes] of marked) {
      for (const attribute of attributes) if (!next.get(element)?.has(attribute)) element.removeAttribute(attribute);
    }
    marked = next;
  };
  return {
    enable: (): void => { if (!off) off = ctx.observeChanges(id, sync); sync(); },
    disable: (): void => {
      off?.(); off = undefined;
      for (const [element, attributes] of marked) for (const attribute of attributes) element.removeAttribute(attribute);
      marked.clear();
    },
  };
}
