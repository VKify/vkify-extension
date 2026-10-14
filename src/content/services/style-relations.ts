import { createCandidateIndex, type CandidateRelation } from '../core/dom/candidate-index.js';
import { perfCollector } from '../core/perf/collector.js';
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
];

interface Bound { stop(): void; }

function ancestorsOf(anchor: Element): Element[] {
  const result: Element[] = [];
  for (let element = anchor.parentElement; element && document.body.contains(element); element = element.parentElement) result.push(element);
  return result;
}

interface IndexedRule extends CandidateRelation { flags: string[]; attribute: string; }
const INDEXED_RULES: IndexedRule[] = [
  { flags: ['hide_profile_right_column'], attribute: 'data-vkify-has-profile-header', selector: '[data-testid="profile-header"]', select: ancestorsOf },
  { flags: ['hide_profile_right_column'], attribute: 'data-vkify-profile-skeleton-layout', selector: 'div[class*="ProfileSkeleton__layout"]', select: anchor => [anchor] },
  { flags: ['communities_swap_columns'], attribute: 'data-vkify-has-group-tabs', selector: '#group_tabs', select: ancestorsOf },
  { flags: ['communities_swap_columns'], attribute: 'data-vkify-has-community-cover', selector: '[data-testid="communityheader_cover"]', select: ancestorsOf },
  {
    flags: ['hide_feed_right_column'], attribute: 'data-vkify-has-feed-news', selector: '[data-testid="feed_right_menu_news"][href="/feed"]',
    select: anchor => document.body.contains(anchor) ? [document.body] : [],
  },
  {
    flags: ['hide_feed_right_column'], attribute: 'data-vkify-feed-menu-wrapper', selector: 'section[data-testid="rightmenu"]',
    select: anchor => anchor.parentElement?.matches('div') && anchor.parentElement.parentElement?.matches('div') ? [anchor.parentElement.parentElement] : [],
  },
  {
    flags: ['hide_feed_right_column'], attribute: 'data-vkify-feed-menu-column', selector: '[data-testid="rightmenu"]',
    context: anchor => ancestorsOf(anchor).reverse().find(element => element.matches('.vkuiSplitCol__host.vkitInternalTwoColumnLayoutColumn')) ?? anchor,
    select: anchor => ancestorsOf(anchor).filter(element => element.matches('.vkuiSplitCol__host.vkitInternalTwoColumnLayoutColumn')
      && ['photos', 'friends', 'search', 'likes'].every(id => !!element.querySelector(`[data-testid="rightmenu"] #${id}`))),
  },
];

function bind(root: Element, rules: Rule[], childrenOnly = false): Bound {
  const marked = rules.map(() => new Set<Element>());
  const update = (): void => {
    if (import.meta.env?.DEV) perfCollector.countDebug('styleRelations.updates');
    // Query all relations before writing their markers. These are selector
    // queries, not layout/style reads; own markers aren't observed below.
    const next = rules.map(rule => new Set(rule.select(root)));
    rules.forEach((rule, i) => {
      for (const element of marked[i]) if (!next[i].has(element)) {
        element.removeAttribute(rule.attribute);
        if (import.meta.env?.DEV) perfCollector.countDebug('styleRelations.writes');
      }
      for (const element of next[i]) if (!element.hasAttribute(rule.attribute)) {
        element.setAttribute(rule.attribute, '');
        if (import.meta.env?.DEV) perfCollector.countDebug('styleRelations.writes');
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
  const index = createCandidateIndex();
  const active = new Map<Group | IndexedRule, () => void>();
  const reconcile = (): void => {
    for (const group of [...GROUPS, ...INDEXED_RULES]) {
      const enabled = group.flags.some(flag => html.hasAttribute(`data-vkify-${flag}`));
      if (enabled && !active.has(group)) {
        if ('roots' in group) {
          const bound = new Map<Element, Bound>();
          active.set(group, index.add({
            selector: group.roots,
            select: anchor => group.parent ? (anchor.parentElement ? [anchor.parentElement] : []) : [anchor],
          }, roots => {
            for (const [root, state] of bound) if (!roots.has(root)) { state.stop(); bound.delete(root); }
            for (const root of roots) if (!bound.has(root)) bound.set(root, bind(root, group.rules, group.childrenOnly));
          }));
        } else {
          let marked = new Set<Element>();
          active.set(group, index.add(group, elements => {
            for (const element of marked) if (!elements.has(element)) element.removeAttribute(group.attribute);
            for (const element of elements) if (!marked.has(element)) element.setAttribute(group.attribute, '');
            marked = new Set(elements);
          }));
        }
      }
      if (!enabled && active.has(group)) { active.get(group)!(); active.delete(group); }
    }
  };
  const flags = new MutationObserver(reconcile);
  flags.observe(html, { attributes: true, attributeFilter: [...new Set([...GROUPS, ...INDEXED_RULES].flatMap(group => group.flags))].map(flag => `data-vkify-${flag}`) });
  reconcile();
  return () => {
    stopAdjacent();
    flags.disconnect();
    for (const stop of active.values()) stop();
    active.clear();
  };
}
