interface AdjacentRule {
  flag: string;
  marker: string;
  selector: string;
  targets(anchor: Element): Element[];
  context?(anchor: Element): Element | null;
}
interface State {
  rule: AdjacentRule;
  anchors: Map<Element, Element[]>;
  marked: Set<Element>;
}

const next = (anchor: Element): Element[] => anchor.nextElementSibling ? [anchor.nextElementSibling] : [];
const PREMIUM = 'a[href="https://vk.ru/vkpremium"]';
const RULES: AdjacentRule[] = [
  { flag: 'data-vkify-block_recommendations_communities', marker: 'data-vkify-after-community-promo', selector: '[data-testid="similar-group-block"]', targets: next },
  { flag: 'data-vkify-hide_open_profile_block', marker: 'data-vkify-after-open-profile', selector: '[data-testid="profile-open-closed-profile-block"]', targets: next },
  {
    flag: 'data-vkify-hide_stories', marker: 'data-vkify-after-stories',
    selector: '[class*="StoriesSection"], [class*="stories_feed"], [class*="StoryBlock"], .stories_feed_wrap, ._stories_wrap, [class^="StoriesBlockFeedSkeleton__root"]',
    targets: next,
  },
  {
    flag: 'data-vkify-hide_post_box', marker: 'data-vkify-after-post-box',
    selector: '[data-testid="feed_publish_block"], [data-testid="posting_form_by_owner_skeleton"]',
    targets: anchor => anchor.matches('[data-testid="posting_form_by_owner_skeleton"]') || anchor.parentElement?.matches('[data-testid="feed_main_container"]') ? next(anchor) : [],
  },
  {
    flag: 'data-vkify-theme-radius', marker: 'data-vkify-after-community-cover', selector: '[data-testid="communityheader_cover"]',
    targets: anchor => anchor.parentElement?.matches('[data-testid="group-header"]') ? next(anchor).filter(element => element.matches('div')) : [],
  },
  {
    flag: 'data-vkify-block_music_ads', marker: 'data-vkify-after-music-subscription', selector: '[data-testid="subscriptionbanner"]',
    targets: anchor => next(anchor).filter(element => element.matches('div[style*="--vkit_internal--spacing_gap_size"], [class^="vkitSpacing__root"]')),
  },
  {
    flag: 'data-vkify-block_recommendations_feed', marker: 'data-vkify-after-browser-promo', selector: 'a[href*="yandex.ru/project/browser/vk/"]',
    context: anchor => anchor.closest('#spa_layout_content') ?? anchor.parentElement,
    targets: anchor => {
      const root = anchor.closest('#spa_layout_content');
      if (!root) return [];
      const targets: Element[] = [];
      for (let element = anchor.parentElement; element && element !== root; element = element.parentElement) {
        if (element.matches('section') && element.parentElement !== root && element.parentElement?.matches('div')) targets.push(...next(element.parentElement));
      }
      return targets;
    },
  },
  {
    flag: 'data-vkify-block_recommendations_video', marker: 'data-vkify-after-premium', selector: PREMIUM,
    context: anchor => anchor.closest('section')?.parentElement ?? anchor.parentElement,
    targets: anchor => {
      const section = anchor.closest('section');
      // Same nearest-section condition as :not(:has(section a[href=...])).
      if (!section || section.querySelector(`:scope section ${PREMIUM}`)) return [];
      // CSS :empty ignores comments and zero-length text nodes. Direct DOM
      // state also avoids selector-engine caches during characterData updates.
      return next(section).filter(element => element.children.length === 0 && element.textContent === '');
    },
  },
];

function discover(state: State, root: Element): void {
  if (root.matches(state.rule.selector)) state.anchors.set(root, state.rule.targets(root));
  for (const anchor of root.querySelectorAll(state.rule.selector)) state.anchors.set(anchor, state.rule.targets(anchor));
}

function paint(state: State): void {
  const marked = new Set([...state.anchors.values()].flat());
  for (const element of state.marked) if (!marked.has(element)) element.removeAttribute(state.rule.marker);
  for (const element of marked) if (!element.hasAttribute(state.rule.marker)) element.setAttribute(state.rule.marker, '');
  state.marked = marked;
}

/**
 * Replaces global sibling rules that make insertion into a long comment list
 * invalidate existing siblings. Query the document once per feature enable;
 * thereafter discover only added subtrees and reevaluate known nearby anchors.
 * No layout reads, polling, or writes when the relation is unchanged.
 */
export function startAdjacentStyleRelations(): () => void {
  const html = document.documentElement;
  const active = new Map<AdjacentRule, State>();
  const mutations = new MutationObserver(records => {
    const dirty = new Set<Element>();
    const added = new Set<Element>();
    for (const record of records) {
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      if (target) dirty.add(target);
      for (const node of record.addedNodes) if (node instanceof Element && node.isConnected) added.add(node);
    }
    // A commit may report both a wrapper and its inserted descendants.
    for (const root of added) {
      for (let parent = root.parentElement; parent; parent = parent.parentElement) {
        if (added.has(parent)) { added.delete(root); break; }
      }
    }
    const changed = [...dirty];
    for (const state of active.values()) {
      for (const root of added) discover(state, root);
      // Attribute changes can turn an existing element into an anchor. Source
      // selectors have no ancestor constraints, so descendants need no rescan.
      for (const element of dirty) if (element.isConnected && element.matches(state.rule.selector) && !state.anchors.has(element)) {
        state.anchors.set(element, state.rule.targets(element));
      }
      for (const anchor of state.anchors.keys()) {
        if (!anchor.isConnected || !anchor.matches(state.rule.selector)) { state.anchors.delete(anchor); continue; }
        const context = state.rule.context?.(anchor) ?? anchor.parentElement;
        if (changed.some(element => context?.contains(element) || element.contains(anchor))) {
          state.anchors.set(anchor, state.rule.targets(anchor));
        }
      }
      paint(state);
    }
  });
  const reconcile = (): void => {
    for (const rule of RULES) {
      if (html.hasAttribute(rule.flag) && !active.has(rule)) {
        const state: State = { rule, anchors: new Map(), marked: new Set() };
        discover(state, html); paint(state); active.set(rule, state);
      } else if (!html.hasAttribute(rule.flag) && active.has(rule)) {
        const state = active.get(rule)!;
        state.anchors.clear(); paint(state); active.delete(rule);
      }
    }
    if (active.size) mutations.observe(html, {
      childList: true, subtree: true, attributes: true, characterData: true,
      attributeFilter: ['id', 'class', 'data-testid', 'href', 'style'],
    });
    else mutations.disconnect();
  };
  const flags = new MutationObserver(reconcile);
  flags.observe(html, { attributes: true, attributeFilter: RULES.map(rule => rule.flag) });
  reconcile();
  return () => {
    flags.disconnect(); mutations.disconnect();
    for (const state of active.values()) { state.anchors.clear(); paint(state); }
    active.clear();
  };
}
