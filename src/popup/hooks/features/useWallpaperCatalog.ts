import { useCallback, useEffect, useRef, useState } from 'react';
import type { VideoAlbum } from '@/shared/video-catalog.js';
import type { CatalogWallpaper, WallpaperCatalogKind } from '@/shared/wallpaper-catalog.js';
import { wallpaperCatalog } from '@/popup/utils/wallpaperCatalog.js';

export function useWallpaperCatalog(kind: WallpaperCatalogKind) {
  const [album, setAlbum] = useState<number | null>(null);
  const [albums, setAlbums] = useState<VideoAlbum[]>([]);
  const [items, setItems] = useState<CatalogWallpaper[]>([]);
  const [offset, setOffset] = useState(0), [total, setTotal] = useState<number | null>(null);
  const [busy, setBusy] = useState(true), [albumsBusy, setAlbumsBusy] = useState(false);
  const [error, setError] = useState(false), [albumsError, setAlbumsError] = useState(false);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0), pending = useRef(false);

  useEffect(() => {
    let current = true;
    setAlbums([]); setAlbumsError(false);
    if (kind !== 'videos') { setAlbumsBusy(false); return; }
    setAlbumsBusy(true);
    void wallpaperCatalog.albums().then(rows => {
      if (current) setAlbums(rows);
    }).catch(() => {
      if (current) setAlbumsError(true);
    }).finally(() => { if (current) setAlbumsBusy(false); });
    return () => { current = false; };
  }, [kind, revision]);

  useEffect(() => {
    const version = ++generation.current;
    pending.current = true;
    setItems([]); setOffset(0); setTotal(null); setError(false); setBusy(true);
    void wallpaperCatalog.page(kind, album, 0).then(page => {
      if (generation.current !== version) return;
      setItems(page.items); setOffset(page.consumed); setTotal(page.consumed ? page.total : 0);
    }).catch(() => {
      if (generation.current === version) setError(true);
    }).finally(() => {
      if (generation.current === version) { pending.current = false; setBusy(false); }
    });
    return () => { generation.current++; };
  }, [kind, album, revision]);

  const loadMore = useCallback(async () => {
    if (pending.current || (total !== null && offset >= total)) return;
    const version = generation.current;
    pending.current = true; setBusy(true); setError(false);
    try {
      const page = await wallpaperCatalog.page(kind, album, offset);
      if (generation.current !== version) return;
      setItems(old => [...new Map([...old, ...page.items].map(item => [item.id, item])).values()]);
      const next = offset + page.consumed;
      setOffset(next); setTotal(page.consumed ? Math.max(next, page.total) : next);
    } catch {
      if (generation.current === version) setError(true);
    } finally {
      if (generation.current === version) { pending.current = false; setBusy(false); }
    }
  }, [kind, album, offset, total]);

  const refresh = () => { wallpaperCatalog.refresh(); setRevision(value => value + 1); };
  return { items, albums, album, chooseAlbum: setAlbum, busy, albumsBusy, error, albumsError, total,
    more: total !== null && offset < total, loadMore, refresh };
}
