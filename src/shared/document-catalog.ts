import { object, safeUrl } from './center-tools.js';

export interface CatalogDocument {
  key: string; title: string; url: string; source: string | null; preview: string | null;
  date: number; size: number; extension: string; type: number; tags: string[];
}

export function documentPage(raw: unknown) {
  const page = object(raw);
  if (!Array.isArray(page.items)) throw new Error('INVALID_RESPONSE');
  const rows: CatalogDocument[] = page.items.flatMap(rawDoc => {
    const doc = object(rawDoc), owner = Number(doc.owner_id), id = Number(doc.id);
    if (!Number.isSafeInteger(owner) || !owner || !Number.isSafeInteger(id) || id <= 0) return [];
    const sizes = object(object(doc.preview).photo).sizes;
    const images = (Array.isArray(sizes) ? sizes : []).map(object).filter(i => safeUrl(i.src))
      .sort((a, b) => Number(b.width || 0) - Number(a.width || 0));
    return [{ key: `${owner}_${id}`, title: String(doc.title || ''),
      url: `https://vk.ru/doc${owner}_${id}${typeof doc.access_key === 'string' && doc.access_key ? '?access_key=' + encodeURIComponent(doc.access_key) : ''}`,
      source: safeUrl(doc.url), preview: safeUrl(images[0]?.src), date: Math.max(0, Number(doc.date) || 0) * 1000,
      size: Math.max(0, Number(doc.size) || 0), extension: typeof doc.ext === 'string' ? doc.ext.toLowerCase() : '',
      type: Number.isInteger(doc.type) && Number(doc.type) >= 1 && Number(doc.type) <= 8 ? Number(doc.type) : 8,
      tags: Array.isArray(doc.tags) ? doc.tags.filter((tag): tag is string => typeof tag === 'string') : [] }];
  });
  return { rows, consumed: page.items.length, count: Math.max(page.items.length, Number(page.count) || 0) };
}

export function documentSize(bytes: number): string {
  const size = Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
  const units = ['B', 'KB', 'MB', 'GB'];
  const unit = Math.min(3, Math.floor(Math.log(Math.max(1, size)) / Math.log(1024)));
  return `${(size / 1024 ** unit).toFixed(unit ? 1 : 0)} ${units[unit]}`;
}

export function documentFilename(doc: CatalogDocument): string {
  const title = (doc.title || `vkify-document-${doc.key}`).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/, '').slice(0, 160);
  const ext = /^[a-z0-9]{1,10}$/.test(doc.extension) ? doc.extension : '';
  return ext && !title.toLowerCase().endsWith('.' + ext) ? `${title}.${ext}` : title || `vkify-document-${doc.key}`;
}
