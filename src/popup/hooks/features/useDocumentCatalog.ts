import { useEffect, useState } from 'react';
import { api, useTask } from './useCenterTools.js';
import { mergeRows } from '@/shared/center-tools.js';
import { documentPage, type CatalogDocument } from '@/shared/document-catalog.js';

export function useDocumentCatalog(ownerId: string | null) {
  const [documents, setDocuments] = useState<CatalogDocument[]>([]);
  const [total, setTotal] = useState<number | null>(null), [offset, setOffset] = useState(0);
  const task = useTask(), { cancel } = task;
  useEffect(() => { cancel(); setDocuments([]); setTotal(null); setOffset(0); }, [ownerId, cancel]);
  const load = (reset = false, all = false) => task.run(async current => {
    if (!ownerId) return;
    let cursor = reset ? 0 : offset, first = true;
    while (current()) {
      const page = documentPage(await api('docs.get', { owner_id: ownerId, count: 200, offset: cursor, return_tags: 1 }));
      if (!current()) return;
      const replace = reset && first;
      setDocuments(old => replace ? page.rows : mergeRows(old, page.rows, d => d.key));
      cursor += page.consumed; first = false;
      setOffset(cursor); setTotal(page.consumed ? page.count : cursor);
      if (!all || !page.consumed || cursor >= page.count) break;
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  });
  const removeDocument = (key: string) => {
    setDocuments(old => old.filter(d => d.key !== key));
    setOffset(old => Math.max(0, old - 1)); setTotal(old => old === null ? null : Math.max(0, old - 1));
  };
  return { documents, total, more: total !== null && offset < total, load, removeDocument, ...task };
}
