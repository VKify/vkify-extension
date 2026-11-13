type Value = Record<string, any>;
const record = (v: unknown): v is Value => !!v && typeof v === 'object' && !Array.isArray(v);

/** Semantic section types from VK's games renderer; leave all game entities intact. */
export function filterGamesPromos(data: unknown): boolean {
  if (!record(data) || !Array.isArray(data.items)) return false;
  const items = data.items.filter(item => !record(item) ||
    !(item.payload?.type === 'app_promo_banner' ||
      (item.section_info?.type_section === 'section' && item.section_info.section_id === 'social_recommend') ||
      (item.header?.button?.action?.games_catalog_section?.type_section === 'section' &&
       item.header.button.action.games_catalog_section.section_id === 'social_recommend')));
  if (items.length === data.items.length) return false;
  data.items = items;
  return true;
}

/** Use exactly the block IDs VK's own clear-recent action removes, including its separator. */
export function filterRecentGroups(data: unknown): boolean {
  if (!record(data) || !Array.isArray(data.catalog?.sections)) return false;
  let changed = false;
  for (const section of data.catalog.sections) {
    if (!Array.isArray(section?.blocks)) continue;
    const ids = new Set<string>();
    for (const block of section.blocks) if (Array.isArray(block?.actions)) {
      for (const action of block.actions) if (action?.action?.type === 'clear_recent_groups' && Array.isArray(action.target_block_ids)) {
        for (const id of action.target_block_ids) if (typeof id === 'string') ids.add(id);
      }
    }
    if (!ids.size) continue;
    const blocks = section.blocks.filter((block: Value) => !ids.has(block?.id));
    if (blocks.length !== section.blocks.length) { section.blocks = blocks; changed = true; }
  }
  return changed;
}

/** The market renderer groups blocks up to a separator into one card. */
export function filterMarketRecommendations(data: unknown): boolean {
  if (!record(data)) return false;
  const sections = Array.isArray(data.catalog?.sections) ? data.catalog.sections : record(data.section) ? [data.section] : [];
  let changed = false;
  for (const section of sections) {
    if (!record(section) || !Array.isArray(section.blocks)) continue;
    const kept: unknown[] = [];
    let card: Value[] = [];
    const flush = () => {
      const recommended = card.some(block => record(block) && /^header(?:_|$)/.test(block.layout?.name ?? '') &&
        typeof block.title === 'string' && block.title.replace(/\s+/g, ' ').trim() === 'Может заинтересовать');
      if (recommended) changed = true; else kept.push(...card);
      card = [];
    };
    for (const block of section.blocks) {
      if (record(block) && block.layout?.name === 'separator') {
        card.push(block); flush();
      } else card.push(block);
    }
    flush();
    if (kept.length !== section.blocks.length) section.blocks = kept;
  }
  return changed;
}

/** Keep the API contract and section metadata while returning no sidebar creative. */
export function filterSidebarAds(data: unknown): boolean {
  if (!record(data) || !('ads_html' in data || 'ads_can_show' in data)) return false;
  const changed = !!data.ads_html || !!data.ads_can_show;
  data.ads_html = '';
  data.ads_can_show = false;
  return changed;
}
