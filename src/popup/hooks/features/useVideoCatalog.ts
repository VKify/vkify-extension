import { useEffect, useState } from 'react';
import { api, useTask } from './useCenterTools.js';
import { mergeRows } from '@/shared/center-tools.js';
import { albumPage, videoPage, type CatalogVideo, type VideoAlbum } from '@/shared/video-catalog.js';

export function useVideoCatalog(ownerId: string | null) {
  const [videos, setVideos] = useState<CatalogVideo[]>([]), [albums, setAlbums] = useState<VideoAlbum[]>([]);
  const [album, setAlbum] = useState<number | null>(null), [total, setTotal] = useState<number | null>(null);
  const [offset, setOffset] = useState(0), [albumOffset, setAlbumOffset] = useState(0), [albumTotal, setAlbumTotal] = useState<number | null>(null);
  const videoTask = useTask(), albumTask = useTask();
  const { cancel: cancelVideos } = videoTask, { cancel: cancelAlbums } = albumTask;
  useEffect(() => {
    cancelVideos(); cancelAlbums(); setVideos([]); setAlbums([]); setAlbum(null);
    setOffset(0); setAlbumOffset(0); setTotal(null); setAlbumTotal(null);
  }, [ownerId, cancelVideos, cancelAlbums]);
  const loadVideos = (reset = false, selected = album) => videoTask.run(async current => {
    if (!ownerId) return;
    const page = videoPage(await api('video.get', { owner_id: ownerId, count: 200, offset: reset ? 0 : offset,
      ...(selected === null ? {} : { album_id: selected }) }));
    if (!current()) return;
    setVideos(old => reset ? page.rows : mergeRows(old, page.rows, v => v.key));
    setOffset((reset ? 0 : offset) + page.consumed);
    setTotal(page.consumed ? page.count : reset ? 0 : offset);
  });
  const chooseAlbum = (id: number | null) => {
    cancelVideos(); setAlbum(id); setVideos([]); setOffset(0); setTotal(null);
    void loadVideos(true, id);
  };
  const loadAlbums = (reset = false) => albumTask.run(async current => {
    if (!ownerId) return;
    const page = albumPage(await api('video.getAlbums', { owner_id: ownerId, need_system: 1, count: 100, offset: reset ? 0 : albumOffset }));
    if (!current()) return;
    setAlbums(old => reset ? page.rows : mergeRows(old, page.rows, a => a.id));
    setAlbumOffset((reset ? 0 : albumOffset) + page.consumed);
    setAlbumTotal(page.consumed ? page.count : reset ? 0 : albumOffset);
  });
  return { videos, albums, album, total, albumTotal, chooseAlbum, loadVideos, loadAlbums,
    more: total !== null && offset < total, moreAlbums: albumTotal !== null && albumOffset < albumTotal, videoTask, albumTask };
}
