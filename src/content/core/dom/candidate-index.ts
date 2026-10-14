/** A source selector must describe the element itself, without ancestor or :has conditions. */
export interface CandidateRelation {
  selector: string;
  select(anchor: Element): Iterable<Element>;
  /** Smallest subtree whose mutations can change select(anchor). */
  context?(anchor: Element): Element | null;
}

interface Entry {
  relation: CandidateRelation;
  candidates: Map<Element, Set<Element>>;
  selected: Set<Element>;
  changed(elements: ReadonlySet<Element>): void;
}

/** Discover once, then search only added subtrees and changed element identities. */
export function createCandidateIndex() {
  const entries = new Set<Entry>();
  let observer: MutationObserver | undefined;
  let selector = '';
  const publish = (entry: Entry): void => {
    const next = new Set([...entry.candidates.values()].flatMap(elements => [...elements]));
    if (next.size === entry.selected.size && [...next].every(element => entry.selected.has(element))) return;
    entry.selected = next;
    entry.changed(next);
  };
  const update = (records: MutationRecord[]): void => {
    const dirty = new Set<Element>();
    const added = new Set<Element>();
    for (const record of records) {
      if (record.target instanceof Element) dirty.add(record.target);
      for (const node of record.addedNodes) if (node instanceof Element && node.isConnected) added.add(node);
    }
    // A single DOM commit may report both a parent and its children.
    const roots = [...added].filter(root => {
      for (let parent = root.parentElement; parent; parent = parent.parentElement) if (added.has(parent)) return false;
      return true;
    });
    const discovered = new Set<Element>(dirty);
    for (const root of roots) {
      discovered.add(root);
      if (root.firstElementChild) for (const element of root.querySelectorAll(selector)) discovered.add(element);
    }
    const targets = [...dirty];
    for (const entry of entries) {
      const { relation, candidates } = entry;
      const fresh = new Set<Element>();
      for (const anchor of discovered) if (anchor.isConnected && !candidates.has(anchor) && anchor.matches(relation.selector)) {
        candidates.set(anchor, new Set());
        fresh.add(anchor);
      }
      for (const anchor of candidates.keys()) {
        if (!anchor.isConnected || !anchor.matches(relation.selector)) { candidates.delete(anchor); continue; }
        const context = relation.context?.(anchor) ?? anchor;
        if (fresh.has(anchor) || targets.some(target => context.contains(target) || target.contains(anchor))) {
          candidates.set(anchor, new Set(relation.select(anchor)));
        }
      }
      publish(entry);
    }
  };
  return {
    add(relation: CandidateRelation, changed: Entry['changed']): () => void {
      const entry: Entry = { relation, changed, candidates: new Map(), selected: new Set() };
      for (const anchor of document.querySelectorAll(relation.selector)) entry.candidates.set(anchor, new Set(relation.select(anchor)));
      entries.add(entry);
      selector = [...new Set([...entries].map(item => item.relation.selector))].join(',');
      if (!observer) {
        observer = new MutationObserver(update);
        observer.observe(document.documentElement, {
          childList: true, subtree: true, attributes: true,
          attributeFilter: ['id', 'class', 'data-testid', 'href', 'title', 'aria-label', 'data-ad-slot'],
        });
      }
      publish(entry);
      return () => {
        if (!entries.delete(entry)) return;
        entry.candidates.clear();
        if (entry.selected.size) changed(new Set());
        entry.selected.clear();
        selector = [...new Set([...entries].map(item => item.relation.selector))].join(',');
        if (!entries.size) { observer?.disconnect(); observer = undefined; }
      };
    },
  };
}
