type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : undefined;

export const MUSIC_CATALOG_METHODS = new Set([
  'catalog.getAudio', 'catalog.getAudioSearch', 'catalog.getSection', 'catalog.getBlockItems',
]);

function isPromoAction(value: unknown): boolean {
  const action = object(value);
  if (action?.type !== 'open_url' || typeof action.url !== 'string') return false;
  try {
    const url = new URL(action.url, 'https://vk.ru');
    if (url.origin !== 'https://vk.ru' || url.pathname !== '/vk_music') return false;
    return [url.searchParams, new URLSearchParams(url.hash.slice(1))].some(params =>
      ['p', 'utm_campaign'].some(key => params.get(key)?.startsWith('musbanner')));
  } catch { return false; }
}

/** Mutate only catalog banner entities and their references; never walk audio data. */
export function filterMusicCatalog(value: unknown): RecordValue[] {
  const data = object(value);
  if (!data || !Array.isArray(data.catalog_banners)) return [];
  const removed = data.catalog_banners.filter(value => {
    const banner = object(value);
    return banner && (typeof banner.id === 'number' || typeof banner.id === 'string') &&
      (isPromoAction(object(banner.click_action)?.action) ||
        (Array.isArray(banner.buttons) && banner.buttons.some(button => isPromoAction(object(button)?.action))));
  }) as RecordValue[];
  if (!removed.length) return [];
  const ids = new Set(removed.map(banner => String(banner.id)));
  data.catalog_banners = data.catalog_banners.filter(banner => !removed.includes(banner));
  const keepBlock = (value: unknown): boolean => {
    const block = object(value);
    if (block?.data_type !== 'catalog_banners' || !Array.isArray(block.catalog_banner_ids)) return true;
    const remaining = block.catalog_banner_ids.filter(id => !ids.has(String(id)));
    if (remaining.length === block.catalog_banner_ids.length) return true;
    block.catalog_banner_ids = remaining;
    return remaining.length > 0;
  };
  const filterContainer = (value: unknown): void => {
    const container = object(value);
    if (Array.isArray(container?.blocks)) container.blocks = container.blocks.filter(keepBlock);
  };
  const catalog = object(data.catalog);
  filterContainer(catalog);
  filterContainer(catalog?.header);
  if (Array.isArray(catalog?.sections)) catalog.sections.forEach(filterContainer);
  filterContainer(data.section);
  filterContainer(data);
  // getBlockItems can return a single block, which must retain its shape.
  keepBlock(data.block);
  return removed;
}

export function musicBatchIds(body: unknown): Set<string> {
  const ids = new Set<string>();
  if (typeof body !== 'string') return ids;
  try {
    const requests = object(JSON.parse(body))?.requests;
    if (Array.isArray(requests)) for (const value of requests) {
      const request = object(value);
      if (typeof request?.method === 'string' && MUSIC_CATALOG_METHODS.has(request.method) &&
        (typeof request.id === 'string' || typeof request.id === 'number')) ids.add(String(request.id));
    }
  } catch { /* Unknown request encoding: leave the batch untouched. */ }
  return ids;
}

export function filterMusicResponse(value: unknown, ids?: Set<string>): RecordValue[] {
  const data = object(value);
  if (!data) return [];
  if (!ids) return filterMusicCatalog(data.response);
  const removed: RecordValue[] = [];
  if (Array.isArray(data.responses)) for (const value of data.responses) {
    const item = object(value);
    if (item && ids.has(String(item.id))) removed.push(...filterMusicCatalog(object(item.body)?.response));
  }
  return removed;
}
