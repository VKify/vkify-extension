import { useEffect, useState } from 'react';
import { api, useTask } from './useCenterTools.js';
import { mergeRows } from '@/shared/center-tools.js';
import { photoAlbumPage, photoPage, type CatalogPhoto, type PhotoAlbum } from '@/shared/photo-catalog.js';

export function usePhotoCatalog(ownerId: string | null) {
  const [photos, setPhotos] = useState<CatalogPhoto[]>([]), [albums, setAlbums] = useState<PhotoAlbum[]>([]);
  const [album, setAlbum] = useState<number | null>(null), [total, setTotal] = useState<number | null>(null);
  const [offset, setOffset] = useState(0), [albumOffset, setAlbumOffset] = useState(0), [albumTotal, setAlbumTotal] = useState<number | null>(null);
  const photoTask = useTask(), albumTask = useTask();
  const { cancel: cancelPhotos } = photoTask, { cancel: cancelAlbums } = albumTask;
  useEffect(() => {
    cancelPhotos(); cancelAlbums(); setPhotos([]); setAlbums([]); setAlbum(null);
    setOffset(0); setAlbumOffset(0); setTotal(null); setAlbumTotal(null);
  }, [ownerId, cancelPhotos, cancelAlbums]);
  const loadPhotos = (reset = false, selected = album, all = false) => photoTask.run(async current => {
    if (!ownerId) return;
    let cursor = reset ? 0 : offset, first = true;
    while (current()) {
      const page = photoPage(await api(selected === null ? 'photos.getAll' : 'photos.get', { owner_id: ownerId, count: 200, photo_sizes: 1, offset: cursor,
        ...(selected === null ? {} : { album_id: selected }) }));
      if (!current()) return;
      const replace = reset && first;
      setPhotos(old => replace ? page.rows : mergeRows(old, page.rows, v => v.key));
      cursor += page.consumed; first = false;
      setOffset(cursor); setTotal(page.consumed ? page.count : cursor);
      if (!all || !page.consumed || cursor >= page.count) break;
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  });
  const chooseAlbum = (id: number | null) => {
    cancelPhotos(); setAlbum(id); setPhotos([]); setOffset(0); setTotal(null);
    void loadPhotos(true, id);
  };
  const loadAlbums = (reset = false) => albumTask.run(async current => {
    if (!ownerId) return;
    const page = photoAlbumPage(await api('photos.getAlbums', { owner_id: ownerId, need_system: 1, count: 100, offset: reset ? 0 : albumOffset }));
    if (!current()) return;
    setAlbums(old => reset ? page.rows : mergeRows(old, page.rows, a => a.id));
    setAlbumOffset((reset ? 0 : albumOffset) + page.consumed);
    setAlbumTotal(page.consumed ? page.count : reset ? 0 : albumOffset);
  });
  const removePhoto = (key: string) => {
    setPhotos(old => old.filter(v => v.key !== key));
    setOffset(old => Math.max(0, old - 1));
    setTotal(old => old === null ? null : Math.max(0, old - 1));
    // Album counts are refreshed explicitly after changes.
    setAlbums([]); setAlbumOffset(0); setAlbumTotal(null);
  };
  return { photos, albums, album, total, albumTotal, chooseAlbum, loadPhotos, loadAlbums, removePhoto,
    more: total !== null && offset < total, moreAlbums: albumTotal !== null && albumOffset < albumTotal, photoTask, albumTask };
}

