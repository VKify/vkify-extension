import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useToast } from '../../context/ToastContext.js';
import { useVKApi } from '../../hooks/core/useVKApi.js';
import BackButton from '../ui/BackButton.js';
import {
  BookmarkIcon, CopyIcon, TrashIcon, SearchIcon, SettingsIcon,
  ExternalLinkIcon, MessageIcon,
} from '../icons/Icons.js';
import { requestNavigate } from '../../utils/pendingAnchor.js';
import type { PinnedNote } from '@/types/index.js';
import { StorageKey } from '@/shared/constants/storage-keys.js';
import { getStorage, setStorage, subscribeStorage } from '@/popup/utils/storageClient.js';

/**
 * Архив сохранённых сообщений («Заметки») — отдельная вкладка попапа.
 *
 * Навигация двухуровневая, как список чатов в VK: сначала собеседники
 * (чаты, из которых сохранялись заметки), по клику — заметки этого чата.
 * Поиск глобальный: при непустом запросе уровни схлопываются в плоский
 * список совпавших заметок по всем чатам.
 *
 * У заметки с сохранённым cmid есть прямая ссылка на сообщение в VK
 * (vk.com/im/convo/<peer>?cmid=…); без cmid — ссылка просто на чат.
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

const MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

/** Метка дня для разделителей в списке заметок — «21 июня 2026». */
function formatDayLabel(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`;
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
  const base = `https://vk.com/im/convo/${note.peerId}`;
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
        title: n.peerTitle ?? (n.peerId !== undefined ? `Чат ${n.peerId}` : 'Без чата'),
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

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11)                             return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

const pluralNotes = (n: number): string => plural(n, 'заметка', 'заметки', 'заметок');
const pluralChats = (n: number): string => plural(n, 'чат', 'чата', 'чатов');

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

/** Мини-аватар автора (22px): цветной кружок с инициалом, серый — если неизвестен. */
function AuthorAvatar({ name, color }: { name: string; color?: string }) {
  const initial = name.charAt(0).toUpperCase() || '?';
  return (
    <div
      className={`w-[22px] h-[22px] rounded-full flex items-center justify-center flex-shrink-0 ${color ? '' : 'bg-[var(--bg-tertiary)]'}`}
      style={color ? { backgroundColor: color } : undefined}
    >
      <span className={`text-[10px] font-semibold leading-none ${color ? 'text-white' : 'text-[var(--text-tertiary)]'}`}>
        {initial}
      </span>
    </div>
  );
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
  if (photo) {
    return <img src={photo} alt="" className={`${sizeClass} rounded-full object-cover flex-shrink-0`} />;
  }
  return (
    <div className={`${sizeClass} rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0`}>
      <span className="text-sm font-semibold text-orange-500">
        {title.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

// ── Карточка заметки ────────────────────────────────────────────────────────

interface NoteCardProps {
  note: PinnedNote;
  /** Показывать ли название чата в мета-строке (в режиме группы оно лишнее). */
  showPeer: boolean;
  onCopy: (text: string) => void;
  onDelete: (id: string) => void;
}

function NoteCard({ note: n, showPeer, onCopy, onDelete }: NoteCardProps) {
  const link = vkLinkForNote(n);
  // Имя отправителя из DOM может отсутствовать — показываем «Неизвестный»
  // серым, но никогда не оставляем строку пустой.
  const known = Boolean(n.author && n.author.trim());
  const author = known ? n.author!.trim() : 'Неизвестный';
  const color = known ? authorColor(author) : undefined;

  return (
    <article className="group bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-primary/30 hover:shadow-sm rounded-[10px] p-3 transition-all">
      {/* Шапка: автор + дата закрепления */}
      <div className="flex items-center gap-2 mb-2">
        <AuthorAvatar name={author} color={color} />
        <span
          className={`text-xs font-semibold truncate ${known ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] font-medium italic'}`}
        >
          {author}
        </span>
        {showPeer && n.peerTitle && (
          <span className="text-[11px] text-[var(--text-tertiary)] truncate" title={n.peerTitle}>
            · в «{n.peerTitle}»
          </span>
        )}
        <span className="ml-auto text-[11px] text-[var(--text-tertiary)] whitespace-nowrap">
          {formatAdded(n.addedAt)}
        </span>
      </div>

      {/* Текст заметки */}
      <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap break-words leading-relaxed">
        {n.text}
      </p>

      {/* Подвал: время сообщения · переход к сообщению · действия */}
      <div className="mt-2.5 pt-2 border-t border-[var(--border-color)] flex items-center gap-3">
        {n.origTime && (
          <span className="text-[11px] text-[var(--text-tertiary)] whitespace-nowrap">{n.origTime}</span>
        )}
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            title={n.cmid !== undefined ? 'Открыть сообщение в VK' : 'Открыть чат в VK'}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            <MessageIcon className="w-3.5 h-3.5" />
            Перейти к сообщению
          </a>
        )}
        <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            onClick={() => onCopy(n.text)}
            title="Скопировать"
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-primary/10 text-[var(--text-tertiary)] hover:text-primary transition-colors"
          >
            <CopyIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(n.id)}
            title="Удалить"
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
  showPeer: boolean;
  onCopy: (text: string) => void;
  onDelete: (id: string) => void;
}

function NotesList({ notes, showPeer, onCopy, onDelete }: NotesListProps) {
  const items: React.ReactNode[] = [];
  let lastDay = '';
  for (const n of notes) {
    const day = dayKeyOf(n.addedAt);
    if (day !== lastDay) {
      lastDay = day;
      items.push(
        <div key={`day-${day}`} className="flex items-center gap-3 pt-1 pb-0.5 first:pt-0">
          <div className="flex-1 h-px bg-[var(--border-color)]" />
          <span className="text-[11px] text-[var(--text-tertiary)] whitespace-nowrap">{formatDayLabel(n.addedAt)}</span>
          <div className="flex-1 h-px bg-[var(--border-color)]" />
        </div>,
      );
    }
    items.push(
      <NoteCard key={n.id} note={n} showPeer={showPeer} onCopy={onCopy} onDelete={onDelete} />,
    );
  }
  return <div className="px-4 pt-3 pb-4 space-y-2">{items}</div>;
}

// ── Вкладка ─────────────────────────────────────────────────────────────────

export default function NotesTab(): React.ReactElement {
  const { showToast } = useToast();
  const [notes, setNotes] = useState<PinnedNote[]>([]);
  const [query, setQuery] = useState('');
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const load = async (): Promise<void> => {
      try {
        const cur = await getStorage([StorageKey.VKIFY_NOTES]);
        if (alive) setNotes((cur[StorageKey.VKIFY_NOTES] as PinnedNote[] | undefined) ?? []);
      } catch { /* ignore */ }
    };
    void load();

    const unsubscribe = subscribeStorage([StorageKey.VKIFY_NOTES], (changes) => {
      const next = changes[StorageKey.VKIFY_NOTES].newValue as PinnedNote[] | undefined;
      if (alive) setNotes(next ?? []);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const groups = useMemo(() => groupNotes(notes), [notes]);
  const openGroup = openGroupKey !== null
    ? groups.find(g => g.key === openGroupKey) ?? null
    : null;

  const { hasToken, call } = useVKApi();
  const peerIds = useMemo(
    () => groups.map(g => g.peerId).filter((id): id is number => id !== undefined),
    [groups],
  );
  const avatars = usePeerAvatars(peerIds, hasToken, call);

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

  const handleCopy = useCallback(async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Скопировано', 'success');
    } catch {
      showToast('Не удалось скопировать', 'error');
    }
  }, [showToast]);

  const handleDelete = useCallback(async (id: string): Promise<void> => {
    const next = notes.filter(n => n.id !== id);
    setNotes(next);
    await setStorage({ [StorageKey.VKIFY_NOTES]: next });
    showToast('Заметка удалена', 'success');
  }, [notes, showToast]);

  const handleClearAll = useCallback(async (): Promise<void> => {
    if (!notes.length) return;
    // eslint-disable-next-line no-alert
    if (!confirm(`Удалить все заметки (${notes.length})? Действие необратимо.`)) return;
    setNotes([]);
    setOpenGroupKey(null);
    await setStorage({ [StorageKey.VKIFY_NOTES]: [] });
    showToast('Заметки очищены', 'success');
  }, [notes.length, showToast]);

  const copyCb   = useCallback((text: string) => { void handleCopy(text); },  [handleCopy]);
  const deleteCb = useCallback((id: string)   => { void handleDelete(id); },  [handleDelete]);

  const openGroupChatLink = openGroup ? vkLinkForNote({ peerId: openGroup.peerId }) : null;

  return (
    <section data-vkify-anchor="notes_view" className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-3 min-w-0">
          {openGroup ? (
            <>
              <BackButton onClick={() => setOpenGroupKey(null)} />
              <PeerAvatar
                title={openGroup.title}
                photo={openGroup.peerId !== undefined ? avatars[openGroup.peerId] : undefined}
                sizeClass="w-8 h-8"
              />
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-[var(--text-primary)] truncate" title={openGroup.title}>
                  {openGroup.title}
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  {pluralNotes(openGroup.notes.length)}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 ring-1 ring-inset ring-orange-500/20 flex items-center justify-center flex-shrink-0">
                <BookmarkIcon className="w-5 h-5 text-orange-500" />
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">Заметки</h3>
                {notes.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[11px] font-medium text-[var(--text-secondary)] whitespace-nowrap">
                    {pluralNotes(notes.length)} · {pluralChats(groups.length)}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {openGroup && openGroupChatLink && (
            <a
              href={openGroupChatLink}
              target="_blank"
              rel="noopener noreferrer"
              title="Открыть чат в VK"
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
              Очистить
            </button>
          )}
          {/* Быстрый переход к настройкам сохранения — «Центр → Сообщения»,
              с подсветкой ряда «Заметки из сообщений». */}
          <button
            onClick={() => requestNavigate('center', 'message_pin_notes')}
            title="Настройки сообщений"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)] pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Поиск по тексту, автору, чату…"
            className="w-full pl-9 pr-3 py-2 bg-[var(--bg-secondary)] border border-transparent rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-primary/40"
          />
        </div>
      </div>

      <div className="mx-3 border-t border-[var(--border-color)]" />

      {notes.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <div className="text-2xl mb-1.5">📌</div>
          <p className="text-sm font-medium text-[var(--text-secondary)]">Заметок пока нет</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
            В чате нажмите иконку «закладка» рядом с сообщением.
          </p>
        </div>
      ) : searching ? (
        /* Глобальный поиск — плоский список по всем чатам */
        searchResults.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <div className="text-2xl mb-1.5">📌</div>
            <p className="text-sm font-medium text-[var(--text-secondary)]">Ничего не найдено</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Попробуйте другой запрос.</p>
          </div>
        ) : (
          <NotesList notes={searchResults} showPeer onCopy={copyCb} onDelete={deleteCb} />
        )
      ) : openGroup ? (
        /* Уровень 2: заметки выбранного чата */
        <NotesList notes={openGroupNotes} showPeer={false} onCopy={copyCb} onDelete={deleteCb} />
      ) : (
        /* Уровень 1: собеседники */
        <div className="px-4 pt-3 pb-4 space-y-1.5">
          {groups.map(g => {
            const preview = g.lastNote.text.replace(/\s+/g, ' ').trim();
            return (
              <button
                key={g.key}
                onClick={() => setOpenGroupKey(g.key)}
                className="group w-full flex items-center gap-3 p-3 bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-primary/30 hover:shadow-sm rounded-[10px] transition-all text-left"
              >
                <PeerAvatar
                  title={g.title}
                  photo={g.peerId !== undefined ? avatars[g.peerId] : undefined}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{g.title}</div>
                  <div className="text-xs text-[var(--text-tertiary)] truncate">
                    {preview}
                    {g.lastNote.origTime && <span className="opacity-80"> · {g.lastNote.origTime}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-[11px] text-[var(--text-tertiary)] whitespace-nowrap">
                    {formatDate(g.lastAddedAt)}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold whitespace-nowrap">
                    {pluralNotes(g.notes.length)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
