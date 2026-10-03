import { copyText } from '@/popup/utils/clipboard.js';
import { sendMessage } from '@/shared/messaging.js';
import { readNotes } from '@/shared/notes.js';
import { useNoteAuthors, type NoteAuthor } from '@/popup/hooks/features/useNoteAuthors.js';
import './notes-tab.css';
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext.js';
import { useVKApi } from '../../hooks/core/useVKApi.js';
import { useApiMethod } from '../../hooks/features/useApiMethod.js';
import BackButton from '../ui/BackButton.js';
import {
  BookmarkIcon, CopyIcon, TrashIcon, SearchIcon, SettingsIcon,
  ExternalLinkIcon, MessageIcon, DatabaseIcon,
} from '../icons/Icons.js';
import { requestNavigate } from '../../utils/pendingAnchor.js';
import type { PinnedNote } from '@/types/index.js';
import { StorageKey } from '@/shared/constants/storage-keys.js';
import DocsLink from '../ui/DocsLink.js';
import { DashboardHero, DashboardHeroArtwork, DashboardPanel } from '../ui/DashboardPrimitives.js';
import { getStorage, subscribeStorage } from '@/popup/utils/storageClient.js';

/**
 * Архив сохранённых сообщений («Заметки») — отдельная вкладка попапа.
 *
 * Навигация двухуровневая, как список чатов в VK: сначала собеседники
 * (чаты, из которых сохранялись заметки), по клику — заметки этого чата.
 * Поиск глобальный: при непустом запросе уровни схлопываются в плоский
 * список совпавших заметок по всем чатам.
 *
 * У заметки с сохранённым cmid есть прямая ссылка на сообщение в VK
 * (vk.ru/im/convo/<peer>?cmid=…); без cmid — ссылка просто на чат.
 */

function formatAdded(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Короткая дата без времени — для правого края карточки чата (21.06.2026). */
function formatDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Метка дня для разделителей в списке заметок — «21 июня 2026» / «June 21, 2026». */
function formatDayLabel(ts: number): string {
  return new Intl.DateTimeFormat(i18n.language, {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(ts));
}

/** Стабильный ключ календарного дня (для группировки разделителями). */
function dayKeyOf(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Ссылка на чат / конкретное сообщение в VK. Новый мессенджер понимает
 * /im/convo/<peerId> для всех типов peer (пользователь, сообщество, беседа),
 * а query-параметр cmid прокручивает к нужному сообщению.
 */
function vkLinkForNote(note: Pick<PinnedNote, 'peerId' | 'cmid'>): string | null {
  if (note.peerId === undefined) return null;
  const base = `https://vk.ru/im/convo/${note.peerId}`;
  return note.cmid !== undefined ? `${base}?cmid=${note.cmid}` : base;
}

// ── Группировка по собеседникам ─────────────────────────────────────────────

interface PeerGroup {
  /** Стабильный ключ группы: peerId, либо заголовок, либо «без чата». */
  key: string;
  title: string;
  peerId?: number;
  notes: PinnedNote[];
  lastAddedAt: number;
  /** Самая свежая заметка чата — для превью в карточке списка. */
  lastNote: PinnedNote;
}

function groupKeyOf(n: PinnedNote): string {
  if (n.peerId !== undefined) return `p:${n.peerId}`;
  if (n.peerTitle)            return `t:${n.peerTitle}`;
  return 'unknown';
}

function groupNotes(notes: PinnedNote[]): PeerGroup[] {
  const map = new Map<string, PeerGroup>();
  for (const n of notes) {
    const key = groupKeyOf(n);
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        title: n.peerTitle ?? (n.peerId !== undefined ? i18n.t('notes:chat_n', { id: n.peerId }) : i18n.t('notes:no_chat')),
        peerId: n.peerId,
        notes: [],
        lastAddedAt: 0,
        lastNote: n,
      };
      map.set(key, g);
    }
    g.notes.push(n);
    if (n.addedAt > g.lastAddedAt) { g.lastAddedAt = n.addedAt; g.lastNote = n; }
    // Заголовок чата мог меняться между закреплениями — берём самый свежий.
    if (n.peerTitle && n.addedAt === g.lastAddedAt) g.title = n.peerTitle;
  }
  return [...map.values()].sort((a, b) => b.lastAddedAt - a.lastAddedAt);
}

// ── Цвет автора заметки ──────────────────────────────────────────────────────
//
// У заметок внутри одного чата разные отправители; чтобы их было видно с одного
// взгляда, мини-аватар каждого автора красится в стабильный цвет, выведенный из
// имени. Палитра — насыщенные тона, читаемые на белой букве.

const AUTHOR_COLORS = [
  '#e64980', '#7950f2', '#4c6ef5', '#1098ad', '#0ca678',
  '#f59f00', '#f76707', '#e8590c', '#9c36b5', '#2f9e44',
];

function authorColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AUTHOR_COLORS[h % AUTHOR_COLORS.length];
}

// ── Аватарки собеседников через VK API ──────────────────────────────────────
//
// peer_id трёх видов: пользователь (>0), сообщество (<0), беседа (≥2e9).
// Каждый вид — свой метод; всё батчится в один вызов на вид и кэшируется на
// время жизни вкладки. Без токена (нет открытой вкладки VK) тихо остаёмся
// на буквенных кружках.

const CHAT_PEER_OFFSET = 2_000_000_000;

type ApiCall = (method: string, params?: Record<string, unknown>) => Promise<unknown>;

function usePeerAvatars(peerIds: number[], hasToken: boolean, call: ApiCall): Record<number, string> {
  const [avatars, setAvatars] = useState<Record<number, string>>({});
  const requestedRef = useRef<Set<number>>(new Set());
  const peersKey = useMemo(() => [...peerIds].sort((a, b) => a - b).join(','), [peerIds]);

  useEffect(() => {
    if (!hasToken) return;
    const pending = peerIds.filter(id => !requestedRef.current.has(id));
    if (pending.length === 0) return;
    pending.forEach(id => requestedRef.current.add(id));

    const users  = pending.filter(id => id > 0 && id < CHAT_PEER_OFFSET);
    const clubs  = pending.filter(id => id < 0);
    const chats  = pending.filter(id => id >= CHAT_PEER_OFFSET);

    void (async () => {
      const next: Record<number, string> = {};

      if (users.length > 0) {
        try {
          const r = await call('users.get', {
            user_ids: users.join(','), fields: 'photo_50',
          }) as Array<{ id: number; photo_50?: string }> | null;
          r?.forEach(u => { if (u.photo_50) next[u.id] = u.photo_50; });
        } catch { /* токен без прав / сеть — остаёмся на буквах */ }
      }

      if (clubs.length > 0) {
        try {
          const r = await call('groups.getById', {
            group_ids: clubs.map(id => -id).join(','), fields: 'photo_50',
          });
          // До API 5.199 ответ — массив, после — { groups: [...] }.
          const arr = Array.isArray(r) ? r : (r as { groups?: unknown[] } | null)?.groups;
          (arr as Array<{ id: number; photo_50?: string }> | undefined)
            ?.forEach(g => { if (g.photo_50) next[-g.id] = g.photo_50; });
        } catch { /* ignore */ }
      }

      if (chats.length > 0) {
        try {
          const r = await call('messages.getConversationsById', {
            peer_ids: chats.join(','),
          }) as { items?: Array<{ peer?: { id?: number }; chat_settings?: { photo?: { photo_50?: string } } }> } | null;
          r?.items?.forEach(c => {
            const id = c.peer?.id;
            const photo = c.chat_settings?.photo?.photo_50;
            if (id && photo) next[id] = photo;
          });
        } catch { /* ignore */ }
      }

      if (Object.keys(next).length > 0) {
        setAvatars(prev => ({ ...prev, ...next }));
      }
    })();
    // peersKey — содержимое peerIds; сам массив пересоздаётся каждый рендер.
  }, [peersKey, hasToken, call]); // eslint-disable-line react-hooks/exhaustive-deps

  return avatars;
}

interface PeerAvatarProps {
  title: string;
  photo?: string;
  /** Размер в tailwind-классах, по умолчанию 10 (40px). */
  sizeClass?: string;
}

function PeerAvatar({ title, photo, sizeClass = 'w-10 h-10' }: PeerAvatarProps) {
  const [failedPhoto, setFailedPhoto] = useState<string>();
  if (photo && photo !== failedPhoto) {
    return <img src={photo} alt={title} onError={() => setFailedPhoto(photo)} className={`${sizeClass} rounded-full object-cover flex-shrink-0`} />;
  }
  return (
    <div role="img" aria-label={title} style={{ backgroundColor: authorColor(title) }} className={`${sizeClass} rounded-full flex items-center justify-center flex-shrink-0`}>
      <span className="text-sm font-semibold text-white">
        {title.trim().charAt(0).toUpperCase() || '?'}
      </span>
    </div>
  );
}

// ── Карточка заметки ────────────────────────────────────────────────────────

interface NoteCardProps {
  note: PinnedNote;
  authorInfo?: NoteAuthor;
  /** Показывать ли название чата в мета-строке (в режиме группы оно лишнее). */
  showPeer: boolean;
  onCopy: (text: string) => void;
  onDelete: (id: string) => void;
}

function NoteCard({ note: n, authorInfo, showPeer, onCopy, onDelete }: NoteCardProps) {
  const { t } = useTranslation('notes');
  const link = vkLinkForNote(n);
  // Имя отправителя из DOM может отсутствовать — показываем «Неизвестный»
  // серым, но никогда не оставляем строку пустой.
  const name = n.author?.trim() || authorInfo?.name;
  const known = Boolean(name);
  const author = name || t('unknown');

  return (
    <article className="group rounded-xl border border-[var(--dashboard-item-border)] bg-[var(--dashboard-surface-muted)] p-3 transition-colors hover:border-primary/30">
      {/* Шапка: автор + дата закрепления */}
      <div className="note-card__header mb-2">
        <PeerAvatar title={author} photo={authorInfo?.photo || n.authorPhoto} sizeClass="w-8 h-8" />
        <span
          className={`truncate text-[13px] font-semibold ${known ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] font-medium italic'}`}
        >
          {author}
        </span>
        {showPeer && n.peerTitle && (
          <span className="note-card__peer truncate text-xs text-[var(--text-secondary)]" title={n.peerTitle}>
            {t('in_chat', { title: n.peerTitle })}
          </span>
        )}
        <span className="note-card__date ml-auto whitespace-nowrap text-xs text-[var(--text-tertiary)]">
          {formatAdded(n.addedAt)}
        </span>
      </div>

      {/* Текст заметки */}
      <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap break-words leading-relaxed">
        {n.text}
      </p>

      {/* Подвал: время сообщения · переход к сообщению · действия */}
      <div className="mt-2.5 flex items-center gap-3 border-t border-[var(--dashboard-item-border)] pt-2">
        {n.origTime && (
          <span className="whitespace-nowrap text-xs text-[var(--text-tertiary)]">{n.origTime}</span>
        )}
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            title={n.cmid !== undefined ? t('open_message') : t('open_chat')}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <MessageIcon className="w-3.5 h-3.5" />
            {n.cmid !== undefined ? t('go_to_message') : t('open_chat')}
          </a>
        )}
        <div className="ml-auto flex items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            onClick={() => onCopy(n.text)}
            title={t('copy')}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-primary/10 text-[var(--text-tertiary)] hover:text-primary transition-colors"
          >
            <CopyIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(n.id)}
            title={t('delete')}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-error/10 text-[var(--text-tertiary)] hover:text-error transition-colors"
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}

// ── Список заметок с разделителями по дням ───────────────────────────────────

interface NotesListProps {
  /** Заметки, уже отсортированные по убыванию addedAt. */
  notes: PinnedNote[];
  authors: Record<string, NoteAuthor>;
  showPeer: boolean;
  onCopy: (text: string) => void;
  onDelete: (id: string) => void;
}

function NotesList({ notes, authors, showPeer, onCopy, onDelete }: NotesListProps) {
  const items: React.ReactNode[] = [];
  let lastDay = '';
  for (const n of notes) {
    const day = dayKeyOf(n.addedAt);
    if (day !== lastDay) {
      lastDay = day;
      items.push(
        <div key={`day-${day}`} className="flex items-center gap-3 pt-1 pb-0.5 first:pt-0">
          <div className="flex-1 h-px bg-[var(--border-color)]" />
          <span className="whitespace-nowrap text-xs text-[var(--text-secondary)]">{formatDayLabel(n.addedAt)}</span>
          <div className="flex-1 h-px bg-[var(--border-color)]" />
        </div>,
      );
    }
    items.push(
      <NoteCard key={n.id} note={n} authorInfo={authors[n.id]} showPeer={showPeer} onCopy={onCopy} onDelete={onDelete} />,
    );
  }
  return <div className="px-4 pt-3 pb-4 space-y-2">{items}</div>;
}

// ── Вкладка ─────────────────────────────────────────────────────────────────

export default function NotesTab(): React.ReactElement {
  const { t } = useTranslation('notes');
  const { showToast } = useToast();
  const pluralNotes = (n: number): string => t('count', { count: n });
  const pluralChats = (n: number): string => t('chats', { count: n });
  const [notes, setNotes] = useState<PinnedNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let changed = false;

    const load = async (): Promise<void> => {
      try {
        const cur = await getStorage([StorageKey.VKIFY_NOTES]);
        if (alive && !changed) setNotes(readNotes(cur[StorageKey.VKIFY_NOTES]));
      } catch { if (alive) showToast(t('toast_load_failed'), 'error'); }
      finally { if (alive) setLoading(false); }
    };
    void load();

    const unsubscribe = subscribeStorage([StorageKey.VKIFY_NOTES], (changes) => {
      changed = true;
      const next = changes[StorageKey.VKIFY_NOTES]?.newValue;
      if (alive) setNotes(readNotes(next));
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [showToast, t]);

  const groups = useMemo(() => groupNotes(notes), [notes, t]);
  const openGroup = openGroupKey !== null
    ? groups.find(g => g.key === openGroupKey) ?? null
    : null;

  const { hasToken, call } = useVKApi();
  const { apiMethod } = useApiMethod();
  const canLoadPhotos = hasToken || apiMethod?.type === 'native';
  const peerIds = useMemo(
    () => groups.map(g => g.peerId).filter((id): id is number => id !== undefined),
    [groups],
  );
  const avatars = usePeerAvatars(peerIds, canLoadPhotos, call);

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  // Глобальный поиск — плоский список по всем чатам, новые сверху.
  const searchResults = useMemo(() => {
    if (!searching) return [];
    return notes
      .filter(n =>
        n.text.toLowerCase().includes(q) ||
        (n.author ?? '').toLowerCase().includes(q) ||
        (n.peerTitle ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => b.addedAt - a.addedAt);
  }, [notes, q, searching]);

  const openGroupNotes = useMemo(() => (
    openGroup ? [...openGroup.notes].sort((a, b) => b.addedAt - a.addedAt) : []
  ), [openGroup]);

  const visibleNotes = searching ? searchResults : openGroupNotes;
  const authors = useNoteAuthors(visibleNotes, canLoadPhotos, call);

  const handleCopy = useCallback(async (text: string): Promise<void> => {
    try {
      await copyText(text);
      showToast(t('toast_copied'), 'success');
    } catch {
      showToast(t('toast_copy_failed'), 'error');
    }
  }, [showToast, t]);

  const handleDelete = useCallback(async (id: string): Promise<void> => {
    try {
      const result = await sendMessage({ type: 'MUTATE_NOTES', action: 'delete', id });
      if (!result?.success) throw new Error('Delete failed');
      showToast(t('toast_deleted'), 'success');
    } catch { showToast(t('toast_save_failed'), 'error'); }
  }, [showToast, t]);

  const handleClearAll = useCallback(async (): Promise<void> => {
    if (!notes.length || !confirm(t('confirm_clear', { count: notes.length }))) return;
    try {
      const result = await sendMessage({ type: 'MUTATE_NOTES', action: 'clear' });
      if (!result?.success) throw new Error('Clear failed');
      setOpenGroupKey(null);
      setQuery('');
      showToast(t('toast_cleared'), 'success');
    } catch { showToast(t('toast_save_failed'), 'error'); }
  }, [notes.length, showToast, t]);

  const copyCb   = useCallback((text: string) => { void handleCopy(text); },  [handleCopy]);
  const deleteCb = useCallback((id: string)   => { void handleDelete(id); },  [handleDelete]);

  const openGroupChatLink = openGroup ? vkLinkForNote({ peerId: openGroup.peerId }) : null;

  const panelActions = <div className="flex flex-shrink-0 items-center gap-1">
          {openGroup && <BackButton onClick={() => searching ? setQuery('') : setOpenGroupKey(null)} />}
          <DocsLink featureId="notes_view" />
          {openGroup && !searching && openGroupChatLink && (
            <a
              href={openGroupChatLink}
              target="_blank"
              rel="noopener noreferrer"
              title={t('open_chat')}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <ExternalLinkIcon className="w-4 h-4" />
            </a>
          )}
          {!openGroup && notes.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-2.5 py-1 text-xs font-medium text-error bg-error/10 hover:bg-error/15 rounded-lg transition-colors"
            >
              {t('clear')}
            </button>
          )}
          {/* Быстрый переход к настройкам сохранения — «Центр → Сообщения»,
              с подсветкой ряда «Заметки из сообщений». */}
          <button
            onClick={() => requestNavigate('center', 'message_pin_notes')}
            title={t('settings_title')}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>;

  return (
    <div data-vkify-anchor="notes_view" className="space-y-4 pb-4">
      {!openGroup && <DashboardHero title={t('title')} subtitle={t('hero_subtitle')}
        description={t('hero_description')}
        artwork={<DashboardHeroArtwork name="notes" />} />}

      <DashboardPanel
        title={searching ? t('search_results') : openGroup ? openGroup.title : t('library_title')}
        description={searching ? pluralNotes(searchResults.length) : openGroup
          ? pluralNotes(openGroup.notes.length)
          : notes.length > 0
            ? `${pluralNotes(notes.length)} · ${pluralChats(groups.length)}`
            : t('library_description')}
        icon={openGroup ? <MessageIcon className="h-5 w-5" /> : <BookmarkIcon className="h-5 w-5" />}
        action={panelActions}
        className="pb-1"
      >

      <div className="px-4 pb-3 pt-1">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)] pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('search_placeholder')}
            aria-label={t('search_placeholder')}
            className="notes-search w-full rounded-xl border border-[var(--dashboard-item-border)] bg-[var(--dashboard-surface-muted)] py-2.5 pl-9 pr-9 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-primary/40 focus:outline-none"
          />
          {query && <button type="button" onClick={() => setQuery('')} aria-label={t('clear_search')}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg text-[var(--text-secondary)] hover:bg-primary/10">×</button>}
        </div>
      </div>

      <div className="mx-4 border-t border-[var(--dashboard-panel-border)]" />

      {loading ? (
        <div role="status" className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">{t('loading')}</div>
      ) : notes.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <div className="mb-1.5 flex justify-center"><DatabaseIcon className="w-8 h-8 text-[var(--text-tertiary)]" /></div>
          <p className="text-sm font-medium text-[var(--text-secondary)]">{t('empty_title')}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            {t('empty_hint')}
          </p>
        </div>
      ) : searching ? (
        /* Глобальный поиск — плоский список по всем чатам */
        searchResults.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <div className="mb-1.5 flex justify-center"><DatabaseIcon className="w-8 h-8 text-[var(--text-tertiary)]" /></div>
            <p className="text-sm font-medium text-[var(--text-secondary)]">{t('not_found')}</p>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{t('not_found_hint')}</p>
          </div>
        ) : (
          <NotesList authors={authors} notes={searchResults} showPeer onCopy={copyCb} onDelete={deleteCb} />
        )
      ) : openGroup ? (
        /* Уровень 2: заметки выбранного чата */
        <NotesList authors={authors} notes={openGroupNotes} showPeer={false} onCopy={copyCb} onDelete={deleteCb} />
      ) : (
        /* Уровень 1: собеседники */
        <div className="px-4 pt-3 pb-4 space-y-1.5">
          {groups.map(g => {
            const preview = g.lastNote.text.replace(/\s+/g, ' ').trim();
            return (
              <button
                key={g.key}
                onClick={() => setOpenGroupKey(g.key)}
                className="group flex w-full items-center gap-3 rounded-xl border border-[var(--dashboard-item-border)] bg-[var(--dashboard-surface-muted)] p-3 text-left transition-colors hover:border-primary/30"
              >
                <PeerAvatar
                  title={g.title}
                  photo={g.peerId !== undefined ? avatars[g.peerId] : undefined}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{g.title}</div>
                  <div className="truncate text-[13px] leading-relaxed text-[var(--text-secondary)]">
                    {preview}
                    {g.lastNote.origTime && <span className="opacity-80"> · {g.lastNote.origTime}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="whitespace-nowrap text-xs text-[var(--text-tertiary)]">
                    {formatDate(g.lastAddedAt)}
                  </span>
                  <span className="whitespace-nowrap rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    {pluralNotes(g.notes.length)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
      </DashboardPanel>
    </div>
  );
}
