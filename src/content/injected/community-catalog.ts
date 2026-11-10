type CatalogBlock = {
  url?: unknown;
  title?: unknown;
  data_type?: unknown;
  layout?: { name?: unknown; title?: unknown };
  actions?: Array<{ url?: unknown; action?: { url?: unknown } }>;
  group_items?: unknown[];
  next_from?: unknown;
};

type CatalogSection = { blocks?: CatalogBlock[]; url?: unknown; next_from?: unknown };

function catalogSections(data: unknown): CatalogSection[] {
  const sections = (data as { response?: { catalog?: { sections?: CatalogSection[] } } } | null)
    ?.response?.catalog?.sections;
  return Array.isArray(sections) ? sections : [];
}

/** Preserve the boot catalog's block order and IDs, which VK uses during initialization. */
export function filterMainCatalogForYou(data: unknown): boolean {
  let changed = false;
  for (const section of catalogSections(data)) {
    if (!Array.isArray(section?.blocks)) continue;
    const blocks = section.blocks;
    for (let index = 1; index < blocks.length; index++) {
      const header = blocks[index - 1];
      const slider = blocks[index];
      if (header?.data_type !== 'none' || header.layout?.name !== 'header_large' ||
          slider?.data_type !== 'groups_items' || slider.layout?.name !== 'slider_minimalistic_card' ||
          !Array.isArray(slider.group_items) || !hasForYouUrl(slider.url) ||
          !Array.isArray(header.actions) || !header.actions.some(item => hasForYouUrl(item?.action?.url))) continue;

      blocks[index - 1] = {
        ...header, title: '', layout: { ...header.layout, name: 'header_hidden', title: '' }, actions: [],
      };
      // An empty slider still renders a framed carousel. Use VK's own hidden
      // header layout for the placeholder, retaining the original block ID.
      blocks[index] = {
        ...slider,
        data_type: 'none',
        title: '',
        layout: { name: 'header_hidden', title: '' },
        actions: [],
        group_items: undefined,
        next_from: undefined,
        url: undefined,
      };
      // On the landing catalog this final carousel is followed by more
      // recommendations via the section cursor, independently of its own cursor.
      if (index === blocks.length - 1 &&
          (section.url === '/groups' || section.url === 'https://vk.ru/groups')) {
        delete section.next_from;
      }
      changed = true;
    }
  }
  return changed;
}

function hasForYouUrl(value: unknown): boolean {
  return typeof value === 'string' && /^(?:https:\/\/vk\.ru)?\/groups\/for_you(?:[?#]|$)/.test(value);
}

function isRecommendationUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value, 'https://vk.ru');
    if (url.origin !== 'https://vk.ru') return false;
    return url.pathname === '/groups/side/trends' || url.pathname === '/groups/for_you' ||
      (url.pathname === '/groups' && url.searchParams.get('act') === 'catalog' &&
        url.searchParams.has('c[category]'));
  } catch {
    return false;
  }
}

function blockTitle(block: CatalogBlock): string | undefined {
  const title = block.title ?? block.layout?.title;
  return typeof title === 'string' ? title.trim() || undefined : undefined;
}

function hasRecommendationLink(block: CatalogBlock): boolean {
  return isRecommendationUrl(block.url) || (Array.isArray(block.actions) &&
    block.actions.some(item => isRecommendationUrl(item?.url) || isRecommendationUrl(item?.action?.url)));
}

/** Strip identified recommendation blocks while retaining catalog and entity metadata. */
export function filterCommunityCatalog(data: unknown): boolean {
  let changed = false;
  for (const section of catalogSections(data)) {
    if (!Array.isArray(section?.blocks)) continue;
    const linked = new Set(section.blocks.filter(block => {
      if (!block) return false;
      const title = blockTitle(block);
      return hasRecommendationLink(block) ||
        (block.data_type === 'groups_items' && (title === 'Для вас' || title === 'For you'));
    }));
    const titles = new Set([...linked].map(blockTitle).filter(Boolean));
    const removed = new Set<CatalogBlock>();
    for (const block of section.blocks) {
      if (!block) continue;
      const companion = (block.data_type === 'none' && block.layout?.name === 'header_compact') ||
        (block.data_type === 'action' && block.layout?.name === 'horizontal_buttons');
      const title = blockTitle(block);
      if ((block.data_type === 'groups_items' || companion) &&
          (linked.has(block) || (title && titles.has(title)))) removed.add(block);
    }
    if (!removed.size) continue;
    section.blocks = section.blocks.filter(block => !removed.has(block));
    changed = true;
  }
  return changed;
}
