import { domObserver } from '../core/dom/dom-observer.js';
import { coalesceFrame } from '../utils/raf-coalesce.js';
import { startAdjacentStyleRelations } from './adjacent-style-relations.js';

interface Rule { attribute: string; select(root: Element): Iterable<Element>; }
interface Group {
  flags: string[];
  roots: string;
  parent?: boolean;
  childrenOnly?: boolean;
  rules: Rule[];
}

function hasChild(element: Element, selector: string): boolean {
  return [...element.children].some(child => child.matches(selector));
}
function skeletonItem(element: Element): boolean {
  return element.matches('li:not([data-testid])') && [...element.children].some(child => child.matches('div') && hasChild(child, '.vkitInternalImageBase'));
}
function relation(attribute: string, selector: string, matches: (element: Element) => boolean): Rule {
  return { attribute, select: root => [...(root.matches(selector) ? [root] : []), ...root.querySelectorAll(selector)].filter(matches) };
}

// Structural facts are resolved locally. Both non-subject :has() and substring
// class selectors on ancestors can invalidate a long discussion on unrelated
// mutations, even when their feature flag is absent from html.
const GROUPS: Group[] = [
  {
    flags: ['edge_sidebar'], roots: '#page_layout', childrenOnly: true, rules: [
      { attribute: 'data-vkify-layout-body', select: root => [...root.children].filter(element => element.matches('[class*="LayoutWrapper__body"]')) },
    ],
  },
  {
    flags: ['minimalistic_sidebar'], roots: '#page_header_cont', rules: [
      relation('data-vkify-navigation-logo', '[class*="TopNavigation__logo"]', () => true),
    ],
  },
  {
    flags: ['hide_profile_right_column'], roots: 'body', rules: [
      { attribute: 'data-vkify-has-profile-header', select: root => ancestorsOf(root, '[data-testid="profile-header"]') },
      relation('data-vkify-profile-skeleton-layout', 'div[class*="ProfileSkeleton__layout"]', () => true),
    ],
  },
  {
    flags: ['tile_sidebar', 'edge_sidebar', 'menu_items_order'], roots: '#layout_sidebar', rules: [
      relation('data-vkify-menu-loaded-list', 'ol', element => hasChild(element, 'li[data-testid="leftmenuitem"]')),
      relation('data-vkify-menu-skeleton-list', 'nav[data-testid="leftmenu"] > ol', element => [...element.children].some(skeletonItem)),
      relation('data-vkify-menu-skeleton-item', 'nav[data-testid="leftmenu"] > ol > li:not([data-testid])', skeletonItem),
      relation('data-vkify-menu-divider', 'div', element => hasChild(element, 'hr')),
    ],
  },
  {
    flags: ['edge_sidebar'], roots: '#profile_redesigned', rules: [
      relation('data-vkify-edge-profile-row', 'div', element => hasChild(element, '.Profile__column') && hasChild(element, '.ScrollStickyWrapper')),
    ],
  },
  {
    flags: ['block_recommendations_calls'], roots: '[data-testid="calls_aside_menu"]', parent: true, rules: [
      relation('data-vkify-calls-aside', 'div', element => hasChild(element, '[data-testid="calls_aside_menu"]')),
      relation('data-vkify-calls-promo', 'section:is(.vkuiInternalTappable, .vkuiBanner__host)', element => !!element.querySelector('img') && !!element.querySelector('a[href]')),
    ],
  },
  {
    flags: ['communities_swap_columns'], roots: 'body', rules: [
      { attribute: 'data-vkify-has-group-tabs', select: root => ancestorsOf(root, '#group_tabs') },
      { attribute: 'data-vkify-has-community-cover', select: root => ancestorsOf(root, '[data-testid="communityheader_cover"]') },
    ],
  },
  {
    flags: ['hide_feed_right_column'], roots: 'body', rules: [
      relation('data-vkify-has-feed-news', 'body', element => !!element.querySelector('[data-testid="feed_right_menu_news"][href="/feed"]')),
      relation('data-vkify-feed-menu-wrapper', 'div', element => [...element.children].some(child => child.matches('div') && hasChild(child, 'section[data-testid="rightmenu"]'))),
      relation('data-vkify-feed-menu-column', '.vkuiSplitCol__host.vkitInternalTwoColumnLayoutColumn', element => ['photos', 'friends', 'search', 'likes'].every(id => !!element.querySelector(`[data-testid="rightmenu"] #${id}`))),
    ],
  },
];

interface Bound { stop(): void; }

function ancestorsOf(root: Element, selector: string): Set<Element> {
  const result = new Set<Element>();
  for (const anchor of root.querySelectorAll(selector)) {
    for (let element = anchor.parentElement; element && root.contains(element); element = element.parentElement) result.add(element);
  }
  return result;
}

function bind(root: Element, rules: Rule[], childrenOnly = false): Bound {
  const marked = rules.map(() => new Set<Element>());
  const update = (): void => {
    // Query all relations before writing their markers. These are selector
    // queries, not layout/style reads; own markers aren't observed below.
    const next = rules.map(rule => new Set(rule.select(root)));
    rules.forEach((rule, i) => {
      for (const element of marked[i]) if (!next[i].has(element)) {
        element.removeAttribute(rule.attribute);
      }
      for (const element of next[i]) if (!element.hasAttribute(rule.attribute)) {
        element.setAttribute(rule.attribute, '');
      }
      marked[i] = next[i];
    });
  };
  // MutationObserver already batches a DOM commit. Resolve structural facts
  // in its microtask, before paint, without waiting for an extra frame.
  const observer = new MutationObserver(records => {
    if (!childrenOnly || records.some(record => record.type === 'childList'
      ? record.target === root : record.target.parentNode === root)) update();
  });
  observer.observe(root, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['class', 'id', 'data-testid', 'href'],
  });
  update();
  return { stop: () => {
    observer.disconnect();
    rules.forEach((rule, i) => { for (const element of marked[i]) element.removeAttribute(rule.attribute); });
  } };
}

/** Owns local structural markers for the enabled CSS features; no polling. */
export function startStyleRelations(): () => void {
  const stopAdjacent = startAdjacentStyleRelations();
  const html = document.documentElement;
  const active = new Map<Group, Map<Element, Bound>>();
  let offChanges: (() => void) | null = null;
  const discover = (): void => {
    for (const [group, bound] of active) {
      const roots = new Set([...document.querySelectorAll(group.roots)]
        .map(element => group.parent ? element.parentElement : element)
        .filter((element): element is Element => element !== null));
      for (const [root, state] of bound) if (!roots.has(root)) { state.stop(); bound.delete(root); }
      for (const root of roots) if (!bound.has(root)) bound.set(root, bind(root, group.rules, group.childrenOnly));
    }
  };
  const scheduleDiscover = coalesceFrame(discover);
  // Root/anchor identity can change through attributes without a childList
  // mutation. Class/href changes inside an existing root use its local observer.
  const identities = new MutationObserver(scheduleDiscover);
  const reconcile = (): void => {
    for (const group of GROUPS) {
      const enabled = group.flags.some(flag => html.hasAttribute(`data-vkify-${flag}`));
      if (enabled && !active.has(group)) active.set(group, new Map());
      if (!enabled && active.has(group)) {
        for (const state of active.get(group)!.values()) state.stop();
        active.delete(group);
      }
    }
    if (active.size && !offChanges) {
      offChanges = domObserver.observeChanges(discover);
      identities.observe(html, { attributes: true, subtree: true, attributeFilter: ['id', 'data-testid'] });
    } else if (!active.size && offChanges) {
      offChanges(); offChanges = null; identities.disconnect(); scheduleDiscover.cancel();
    }
    discover();
  };
  const flags = new MutationObserver(reconcile);
  flags.observe(html, { attributes: true, attributeFilter: [...new Set(GROUPS.flatMap(group => group.flags))].map(flag => `data-vkify-${flag}`) });
  reconcile();
  return () => {
    stopAdjacent();
    flags.disconnect(); identities.disconnect(); scheduleDiscover.cancel(); offChanges?.();
    for (const bound of active.values()) for (const state of bound.values()) state.stop();
    active.clear();
  };
}
