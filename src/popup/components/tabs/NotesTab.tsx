import React, { useEffect, useMemo, useState, useCallback } from 'react';
import InfoBlock from '../ui/InfoBlock.js';
import { useToast } from '../../context/ToastContext.js';
import { BookmarkIcon, CopyIcon, TrashIcon, SearchIcon } from '../icons/Icons.js';
import type { PinnedNote } from '../../../types/index.js';
import { StorageKey } from '../../../shared/constants/storage-keys.js';

function formatAdded(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Ссылка на чат в VK по сохранённому peer_id. */
function vkLinkForPeer(peerId: number | undefined): string | null {
  if (peerId === undefined) return null;
  if (peerId >= 2_000_000_000) return `https://vk.com/im?sel=c${peerId - 2_000_000_000}`;
  if (peerId > 0)              return `https://vk.com/id${peerId}`;
  if (peerId < 0)              return `https://vk.com/club${-peerId}`;
  return null;
}

export default function NotesTab(): React.ReactElement {
  const { showToast } = useToast();
  const [notes, setNotes] = useState<PinnedNote[]>([]);
  const [query, setQuery] = useState('');

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...notes].sort((a, b) => b.addedAt - a.addedAt);
    return notes
      .filter(n =>
        n.text.toLowerCase().includes(q) ||
        (n.author ?? '').toLowerCase().includes(q) ||
        (n.peerTitle ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => b.addedAt - a.addedAt);
  }, [notes, query]);

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
    await chrome.storage.local.set({ [StorageKey.VKIFY_NOTES]: [] });
    showToast('Заметки очищены', 'success');
  }, [notes.length, showToast]);

  return (
    <div className="space-y-4">

      <section data-vkify-anchor="notes_view" className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center flex-shrink-0">
              <BookmarkIcon className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Заметки</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Сохранённые сообщения из ВК — {notes.length}
              </p>
            </div>
          </div>
          {notes.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-2 py-1 text-xs font-medium text-error hover:bg-error/10 rounded-lg transition-colors"
            >
              Очистить
            </button>
          )}
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
      </section>

      {filtered.length === 0 ? (
        <InfoBlock variant="info" icon="📌" title={notes.length === 0 ? 'Заметок пока нет' : 'Ничего не найдено'}>
          {notes.length === 0
            ? 'В чате нажмите иконку «закладка» рядом с сообщением — оно сохранится сюда.'
            : 'Попробуйте другой запрос.'}
        </InfoBlock>
      ) : (
        <section className="space-y-2">
          {filtered.map(n => {
            const link = vkLinkForPeer(n.peerId);
            return (
              <article key={n.id} className="bg-[var(--bg-primary)] rounded-xl shadow-card p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)] mb-1.5">
                      {n.author && <span className="font-semibold text-primary">{n.author}</span>}
                      {n.origTime && <span>· {n.origTime}</span>}
                      {n.peerTitle && (
                        link ? (
                          <a href={link} target="_blank" rel="noopener noreferrer" className="opacity-80 hover:text-primary truncate max-w-[140px]" title={n.peerTitle}>
                            · в «{n.peerTitle}»
                          </a>
                        ) : (
                          <span className="opacity-80 truncate max-w-[140px]" title={n.peerTitle}>· в «{n.peerTitle}»</span>
                        )
                      )}
                      <span className="ml-auto opacity-60 whitespace-nowrap">{formatAdded(n.addedAt)}</span>
                    </div>
                    <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap break-words leading-relaxed">
                      {n.text}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button
                      onClick={() => void handleCopy(n.text)}
                      title="Скопировать"
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-primary/10 text-[var(--text-secondary)] hover:text-primary transition-colors"
                    >
                      <CopyIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => void handleDelete(n.id)}
                      title="Удалить"
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-error/10 text-[var(--text-secondary)] hover:text-error transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
