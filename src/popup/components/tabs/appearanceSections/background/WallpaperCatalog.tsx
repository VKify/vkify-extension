import { VideoIcon, HashtagIcon, LayoutRowsIcon, SearchIcon } from '@/popup/components/icons/Icons.js';
import { Input, Select } from '@/popup/components/ui/FormControls.js';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWallpaperCatalog } from '@/popup/hooks/features/useWallpaperCatalog.js';
import { filterWallpapers, wallpaperTagCategories, type WallpaperCatalogKind, type WallpaperCatalogSort } from '@/shared/wallpaper-catalog.js';
import type { WallpaperSelection } from '@/shared/wallpaper-catalog.js';
import MediaCard from './MediaCard.js';

interface Props {
  kind: WallpaperCatalogKind;
  onSelect: (wallpaper: WallpaperSelection) => Promise<void>;
  isSelected: (wallpaper: WallpaperSelection) => boolean;
}

export default function WallpaperCatalog({ kind, onSelect, isSelected }: Props): React.ReactElement {
  const { t, i18n } = useTranslation('appearance');
  const catalog = useWallpaperCatalog(kind);
  const [query, setQuery] = useState(''), [sort, setSort] = useState<WallpaperCatalogSort>('newest');
  const [tag, setTag] = useState('');
  const [applying, setApplying] = useState<string | null>(null), [applyError, setApplyError] = useState(false);
  const items = useMemo(() => filterWallpapers(catalog.items.map(item => ({ ...item,
    name: item.name || (kind === 'photos' ? t('background.gallery.photo_name', { id: item.id.split('_').pop() }) : t('background.untitled')),
  })), query, sort, i18n.language, kind === 'photos' ? tag : ''), [catalog.items, query, sort, i18n.language, kind, tag, t]);
  const categories = useMemo(() => wallpaperTagCategories(catalog.items, i18n.language), [catalog.items, i18n.language]);
  const albums = useMemo(() => [...catalog.albums].sort((a, b) => a.title.localeCompare(b.title, i18n.language)), [catalog.albums, i18n.language]);
  async function select(wallpaper: WallpaperSelection): Promise<void> {
    if (applying) return;
    setApplying(wallpaper.id); setApplyError(false);
    try { await onSelect(wallpaper); } catch { setApplyError(true); } finally { setApplying(null); }
  }

  return <div className="space-y-3" aria-label={t(`background.${kind === 'videos' ? 'video' : 'photo'}_wallpapers`)}>
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs font-semibold text-[var(--text-primary)]">{t(`background.${kind === 'videos' ? 'video' : 'photo'}_wallpapers`)}</p>
      <button type="button" className="text-xs font-medium text-primary disabled:opacity-40" disabled={catalog.busy || catalog.albumsBusy || !!applying} onClick={catalog.refresh}>{t('background.gallery.refresh')}</button>
    </div>
    <fieldset disabled={!!applying} className="space-y-2 disabled:opacity-60">
      {kind === 'videos' && <label className="block text-xs text-[var(--text-secondary)]">
        <span className="mb-1 block">{t('background.gallery.category')}</span>
        <Select icon={<VideoIcon />} className="w-full" value={catalog.album ?? ''} disabled={catalog.albumsBusy} onChange={event => catalog.chooseAlbum(event.target.value === '' ? null : Number(event.target.value))}>
          <option value="">{t('background.gallery.all_categories')}</option>
          {albums.map(album => <option key={album.id} value={album.id}>{album.title || t('background.untitled')} ({album.count})</option>)}
        </Select>
      </label>}
      {kind === 'photos' && <label className="block text-xs text-[var(--text-secondary)]">
        <span className="mb-1 block">{t('background.gallery.photo_category')}</span>
        <Select icon={<HashtagIcon />} className="w-full" value={tag} onChange={event => setTag(event.target.value)}>
          <option value="">{t('background.gallery.all_categories')}</option>
          {tag && !categories.some(category => category.id === tag) && <option value={tag}>#{tag} (0)</option>}
          {categories.map(category => <option key={category.id} value={category.id}>#{category.title} ({category.count})</option>)}
        </Select>
      </label>}
      <Input icon={<SearchIcon />} type="search" className="w-full" aria-label={t('background.gallery.search')} placeholder={t('background.gallery.search')} value={query} onChange={event => setQuery(event.target.value)} />
      <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
        <span>{t('background.gallery.sort')}</span>
        <Select icon={<LayoutRowsIcon />} className="w-full" value={sort} onChange={event => setSort(event.target.value as WallpaperCatalogSort)}>
          {(['newest', 'oldest', 'title'] as const).map(value => <option key={value} value={value}>{t(`background.gallery.${value}`)}</option>)}
        </Select>
      </label>
    </fieldset>
    <p className="text-[10px] text-[var(--text-tertiary)]">{t(kind === 'photos' ? 'background.gallery.photo_hint' : 'background.gallery.hint')}</p>
    {catalog.albumsError && <p role="alert" className="text-xs text-[var(--text-secondary)]">{t('background.gallery.categories_error')}</p>}
    {catalog.error && <div role="alert" className="rounded-xl bg-[var(--bg-secondary)] p-3 text-xs text-[var(--text-secondary)] space-y-2">
      <p>{t('background.gallery.load_error')}</p>
      <button type="button" className="font-medium text-primary" disabled={catalog.busy} onClick={() => { if (catalog.items.length) void catalog.loadMore(); else catalog.refresh(); }}>{t('background.gallery.retry')}</button>
    </div>}
    {applyError && <p role="alert" className="text-xs text-[var(--text-secondary)]">{t('background.gallery.apply_error')}</p>}
    <div className="grid grid-cols-2 gap-2" aria-busy={catalog.busy || !!applying}>
      {items.map(item => {
        const wallpaper: WallpaperSelection = { ...item, preserveOriginal: kind === 'photos' };
        return <MediaCard key={item.id} wallpaper={wallpaper} variant={kind === 'videos' ? 'video' : 'image'} isSelected={isSelected(wallpaper)} disabled={!!applying} onSelect={value => { void select(value); }} />;
      })}
    </div>
    {(catalog.busy || applying) && <p role="status" className="py-2 text-center text-xs text-[var(--text-secondary)]">{t(applying ? 'background.gallery.applying' : 'background.gallery.loading')}</p>}
    {!catalog.busy && !catalog.error && !items.length && <p className="py-4 text-center text-xs text-[var(--text-tertiary)]">{t(query || (kind === 'photos' && tag) ? 'background.gallery.no_matches' : 'background.gallery.empty')}</p>}
    {catalog.total !== null && <p className="text-[10px] text-[var(--text-tertiary)]">{t('background.gallery.loaded', { count: catalog.items.length, total: catalog.total })}</p>}
    {catalog.more && <button type="button" className="w-full rounded-xl bg-[var(--bg-secondary)] py-2.5 text-xs font-medium text-primary disabled:opacity-40" disabled={catalog.busy || !!applying} onClick={() => { void catalog.loadMore(); }}>{t('background.gallery.more')}</button>}
  </div>;
}
