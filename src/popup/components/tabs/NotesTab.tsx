import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useToast } from '../../context/ToastContext.js';
import { useVKApi } from '../../hooks/core/useVKApi.js';
import BackButton from '../ui/BackButton.js';
import {
  BookmarkIcon, CopyIcon, TrashIcon, SearchIcon, SettingsIcon,
  ChevronRightIcon, ExternalLinkIcon,
} from '../icons/Icons.js';
import { requestNavigate } from '../../utils/pendingAnchor.js';
import type { PinnedNote } from '../../../types/index.js';
import { StorageKey } from '../../../shared/constants/storage-keys.js';

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
      };
      map.set(key, g);
    }
    g.notes.push(n);
    if (n.addedAt > g.lastAddedAt) g.lastAddedAt = n.addedAt;
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
  return (
    <article className="group bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-primary/30 hover:shadow-sm rounded-xl p-3 transition-all">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)] mb-1.5">
            {n.author && <span className="font-semibold text-primary">{n.author}</span>}
            {n.origTime && <span>· {n.origTime}</span>}
            {showPeer && n.peerTitle && (
              <span className="opacity-80 truncate max-w-[140px]" title={n.peerTitle}>· в «{n.peerTitle}»</span>
            )}
            <span className="ml-auto opacity-60 whitespace-nowrap">{formatAdded(n.addedAt)}</span>
          </div>
          <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap break-words leading-relaxed">
            {n.text}
          </p>
        </div>
        <div className="flex flex-col gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              title={n.cmid !== undefined ? 'Открыть сообщение в VK' : 'Открыть чат в VK'}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-primary/10 text-[var(--text-secondary)] hover:text-primary transition-colors"
            >
              <ExternalLinkIcon className="w-4 h-4" />
            </a>
          )}
          <button
            onClick={() => onCopy(n.text)}
            title="Скопировать"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-primary/10 text-[var(--text-secondary)] hover:text-primary transition-colors"
          >
            <CopyIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(n.id)}
            title="Удалить"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-error/10 text-[var(--text-secondary)] hover:text-error transition-colors"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </article>
  );
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
        const cur = await chrome.storage.local.get([StorageKey.VKIFY_NOTES]);
        if (alive) setNotes((cur[StorageKey.VKIFY_NOTES] as PinnedNote[] | undefined) ?? []);
      } catch { /* ignore */ }
    };
    void load();

    const onChange = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
      if (area === 'local' && changes[StorageKey.VKIFY_NOTES]) {
        const next = changes[StorageKey.VKIFY_NOTES].newValue as PinnedNote[] | undefined;
        if (alive) setNotes(next ?? []);
      }
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => {
      alive = false;
      chrome.storage.onChanged.removeListener(onChange);
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
    await chrome.storage.local.set({ [StorageKey.VKIFY_NOTES]: next });
    showToast('Заметка удалена', 'success');
  }, [notes, showToast]);

  const handleClearAll = useCallback(async (): Promise<void> => {
    if (!notes.length) return;
    // eslint-disable-next-line no-alert
    if (!confirm(`Удалить все заметки (${notes.length})? Действие необратимо.`)) return;
    setNotes([]);
    setOpenGroupKey(null);
    await chrome.storage.local.set({ [StorageKey.VKIFY_NOTES]: [] });
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
              <div>
                <h3 className="text-base font-semibold text-[var(--text-primary)]">Заметки</h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  {groups.length > 0
                    ? `${pluralChats(groups.length)} · ${pluralNotes(notes.length)}`
                    : 'Сохранённые сообщения из ВК'}
                </p>
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
              className="px-2 py-1 text-xs font-medium text-error hover:bg-error/10 rounded-lg transition-colors"
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
          <div className="px-4 pt-3 pb-4 space-y-2">
            {searchResults.map(n => (
              <NoteCard key={n.id} note={n} showPeer onCopy={copyCb} onDelete={deleteCb} />
            ))}
          </div>
        )
      ) : openGroup ? (
        /* Уровень 2: заметки выбранного чата */
        <div className="px-4 pt-3 pb-4 space-y-2">
          {openGroupNotes.map(n => (
            <NoteCard key={n.id} note={n} showPeer={false} onCopy={copyCb} onDelete={deleteCb} />
          ))}
        </div>
      ) : (
        /* Уровень 1: собеседники */
        <div className="px-4 pt-3 pb-4 space-y-1.5">
          {groups.map(g => (
            <button
              key={g.key}
              onClick={() => setOpenGroupKey(g.key)}
              className="group w-full flex items-center gap-3 p-3 bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-primary/30 hover:shadow-sm rounded-xl transition-all text-left"
            >
              <PeerAvatar
                title={g.title}
                photo={g.peerId !== undefined ? avatars[g.peerId] : undefined}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{g.title}</div>
                <div className="text-xs text-[var(--text-tertiary)]">
                  {pluralNotes(g.notes.length)} · {formatAdded(g.lastAddedAt)}
                </div>
              </div>
              <ChevronRightIcon className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0 transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
