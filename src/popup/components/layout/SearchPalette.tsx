import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';
import Modal from '../ui/Modal.js';
import { SearchIcon, StarIcon } from '../icons/Icons.js';
import { FUNCTIONS, type FunctionEntry } from '../../constants/functions.js';
import { StorageKey } from '@/shared/constants/storage-keys.js';
import { getStorage, setStorage, subscribeStorage } from '@/popup/utils/storageClient.js';

interface SearchPaletteProps {
  open: boolean;
  onClose: () => void;
  /** anchorId — id из FUNCTIONS, передаём приложению для авто-прокрутки. */
  onNavigate: (tabId: string, anchorId?: string) => void;
}

/**
 * Локализованное имя вкладки по её id — для подписи под результатом и для матча.
 * Берём из namespace `settings` через i18n-инстанс (актуальный язык на момент
 * вызова); `defaultValue` = id, если ключа нет.
 */
function tabLabel(tabId: string): string {
  return i18n.t(`settings:tabs.${tabId}`, { defaultValue: tabId });
}

/** Локализованные title/desc записи (namespace `functions`); фолбэк — исходный текст. */
function fnTitle(e: FunctionEntry): string {
  return i18n.t(`functions:${e.id}.title`, { defaultValue: e.title });
}
function fnDesc(e: FunctionEntry): string {
  return e.desc ? i18n.t(`functions:${e.id}.desc`, { defaultValue: e.desc }) : '';
}

/** Быстрый lookup FunctionEntry по id (для рендера избранного в исходном порядке). */
const BY_ID: Record<string, FunctionEntry> = Object.fromEntries(FUNCTIONS.map(f => [f.id, f]));

/**
 * Простой матч: запрос разбит на токены (по пробелам), каждый токен должен
 * встречаться хотя бы в одном из полей (title, desc, keywords, tab-label).
 * Сортировка — сначала те, у кого title начинается с первого токена, потом
 * те, где есть в title, потом всё остальное.
 */
function rankAndFilter(query: string): FunctionEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return FUNCTIONS;

  const tokens = q.split(/\s+/);

  function bag(e: FunctionEntry): string {
    return [
      fnTitle(e),
      fnDesc(e),
      // Исходные RU title/desc тоже в мешке — чтобы при английском UI поиск
      // по-русски всё равно находил функцию (и наоборот, keywords двуязычны).
      e.title,
      e.desc ?? '',
      (e.keywords ?? []).join(' '),
      tabLabel(e.tab),
    ].join(' ').toLowerCase();
  }

  const hits = FUNCTIONS
    .map(e => ({ e, bagStr: bag(e) }))
    .filter(({ bagStr }) => tokens.every(t => bagStr.includes(t)));

  hits.sort((a, b) => {
    const at = fnTitle(a.e).toLowerCase();
    const bt = fnTitle(b.e).toLowerCase();
    // Префиксный матч в title — наверх.
    const aPrefix = at.startsWith(tokens[0]) ? 0 : at.includes(tokens[0]) ? 1 : 2;
    const bPrefix = bt.startsWith(tokens[0]) ? 0 : bt.includes(tokens[0]) ? 1 : 2;
    if (aPrefix !== bPrefix) return aPrefix - bPrefix;
    return at.localeCompare(bt);
  });

  return hits.map(({ e }) => e);
}

export default function SearchPalette({ open, onClose, onNavigate }: SearchPaletteProps) {
  // Подписка на namespace `settings` — палитра ре-рендерится при смене языка,
  // чтобы подписи вкладок под результатами обновлялись вместе с остальным UI.
  const { t } = useTranslation('settings');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [favorites, setFavorites] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Загружаем избранное при открытии и подписываемся на storage-изменения,
  // чтобы при правке из другой вкладки/попапа список обновлялся в реальном
  // времени. Подписка снимается на unmount.
  useEffect(() => {
    let alive = true;

    const load = async (): Promise<void> => {
      try {
        const r = await getStorage([StorageKey.VKIFY_FAVORITES]);
        if (!alive) return;
        setFavorites((r[StorageKey.VKIFY_FAVORITES] as string[] | undefined) ?? []);
      } catch { /* первый запуск/нет доступа — пусто */ }
    };
    void load();

    const unsubscribe = subscribeStorage([StorageKey.VKIFY_FAVORITES], (changes) => {
      const next = changes[StorageKey.VKIFY_FAVORITES].newValue as string[] | undefined;
      if (alive) setFavorites(next ?? []);
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  // Сброс query/active при каждом открытии палитры.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const favSet = useMemo(() => new Set(favorites), [favorites]);

  // Избранное показываем только когда запрос пустой — иначе фильтр работает
  // как обычно. Сохраняем порядок добавления (тот, в котором лежит в storage).
  const favoriteEntries = useMemo<FunctionEntry[]>(() => {
    if (query.trim()) return [];
    return favorites.map(id => BY_ID[id]).filter((e): e is FunctionEntry => Boolean(e));
  }, [favorites, query]);

  const results = useMemo(() => rankAndFilter(query), [query]);

  // Линейный список «всё, по чему можно навигировать стрелками».
  // Сначала избранное (если запрос пустой), потом основной список.
  const flatList = useMemo<FunctionEntry[]>(() => {
    if (favoriteEntries.length === 0) return results;
    // Дедуп: избранные не дублируем во втором блоке.
    const rest = results.filter(e => !favSet.has(e.id));
    return [...favoriteEntries, ...rest];
  }, [favoriteEntries, results, favSet]);

  // Активный индекс не должен вылетать за пределы.
  useEffect(() => {
    if (active >= flatList.length) setActive(0);
  }, [flatList, active]);

  // Прокрутка активного элемента в зону видимости.
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const toggleFav = useCallback(async (id: string): Promise<void> => {
    const next = favSet.has(id)
      ? favorites.filter(x => x !== id)
      : [...favorites, id];
    setFavorites(next);
    try {
      await setStorage({ [StorageKey.VKIFY_FAVORITES]: next });
    } catch (err) {
      console.error('[VKify] Save favorites failed:', err);
    }
  }, [favorites, favSet]);

  if (!open) return null;

  const pick = (e: FunctionEntry): void => {
    onNavigate(e.tab, e.id);
    onClose();
  };

  const handleKey = (ev: React.KeyboardEvent): void => {
    if (ev.key === 'Escape')      { onClose();                                                             return; }
    if (ev.key === 'ArrowDown')   { ev.preventDefault(); setActive(i => Math.min(i + 1, flatList.length - 1)); return; }
    if (ev.key === 'ArrowUp')     { ev.preventDefault(); setActive(i => Math.max(i - 1, 0));                   return; }
    if (ev.key === 'Enter')       { ev.preventDefault(); if (flatList[active]) pick(flatList[active]);         return; }
  };

  const renderRow = (e: FunctionEntry, idx: number): React.ReactElement => {
    const isFav = favSet.has(e.id);
    return (
      <div
        key={e.id}
        data-idx={idx}
        onMouseEnter={() => setActive(idx)}
        className={`
          group w-full flex items-center gap-2 px-4 py-2.5 cursor-pointer transition-colors
          ${idx === active ? 'bg-primary/10' : 'hover:bg-[var(--bg-secondary)]'}
        `}
        onClick={(ev) => {
          // Клик по кнопке-звезде не должен открывать функцию.
          if ((ev.target as HTMLElement).closest('[data-vkify-star]')) return;
          pick(e);
        }}
      >
        <button
          type="button"
          data-vkify-star
          onClick={(ev) => { ev.stopPropagation(); void toggleFav(e.id); }}
          title={isFav ? t('search.remove_fav') : t('search.add_fav')}
          aria-label={isFav ? t('search.remove_fav') : t('search.add_fav')}
          aria-pressed={isFav}
          className={`
            flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md transition-colors
            ${isFav
              ? 'text-amber-500 hover:bg-amber-500/15'
              : 'text-[var(--text-tertiary)] opacity-50 group-hover:opacity-100 hover:bg-[var(--bg-tertiary)] hover:text-amber-500'}
          `}
        >
          <StarIcon className="w-4 h-4" filled={isFav} />
        </button>

        <div className="flex-1 min-w-0 text-left">
          <div className="text-sm font-medium text-[var(--text-primary)] truncate">
            {fnTitle(e)}
          </div>
          {e.desc && (
            <div className="text-xs text-[var(--text-tertiary)] truncate">
              {fnDesc(e)}
            </div>
          )}
        </div>
        <span className="flex-shrink-0 text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded uppercase tracking-wide">
          {t(`tabs.${e.tab}`, { defaultValue: e.tab })}
        </span>
      </div>
    );
  };

  // Считаем индексы в plain-режиме (с разделом избранного).
  const showFavoritesSection = favoriteEntries.length > 0;
  const restEntries = showFavoritesSection
    ? results.filter(e => !favSet.has(e.id))
    : results;

  return (
    <Modal bare align="top" ariaLabel={t('search.aria')} onClose={onClose}>
      <div
        className="w-full max-w-[420px] bg-[var(--bg-primary)] rounded-2xl shadow-2xl border border-[var(--border-color)] overflow-hidden flex flex-col max-h-[440px]"
        onKeyDown={handleKey}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-color)]">
          <SearchIcon className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0" />
          <input
            ref={inputRef}
            type="search"
            placeholder={t('search.placeholder')}
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
            autoComplete="off"
          />
          <kbd className="text-[10px] font-mono text-[var(--text-tertiary)] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded border border-[var(--border-color)]">Esc</kbd>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto py-1">
          {flatList.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--text-tertiary)]">
              {t('search.empty')}
            </div>
          ) : showFavoritesSection ? (
            <>
              <div className="px-4 pt-3 pb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-500/90">
                <StarIcon className="w-3 h-3" filled />
                {t('search.favorites')}
              </div>
              {favoriteEntries.map((e, i) => renderRow(e, i))}
              {restEntries.length > 0 && (
                <>
                  <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                    {t('search.all')}
                  </div>
                  {restEntries.map((e, i) => renderRow(e, favoriteEntries.length + i))}
                </>
              )}
            </>
          ) : (
            results.map((e, idx) => renderRow(e, idx))
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border-color)] text-[11px] text-[var(--text-tertiary)] bg-[var(--bg-secondary)]/60">
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono">↑↓</kbd> {t('search.hint_nav')}</span>
            <span><kbd className="font-mono">Enter</kbd> {t('search.hint_open')}</span>
            <span className="flex items-center gap-1">
              <StarIcon className="w-3 h-3" />
              {t('search.hint_fav')}
            </span>
          </div>
          <span>{flatList.length}</span>
        </div>
      </div>
    </Modal>
  );
}
