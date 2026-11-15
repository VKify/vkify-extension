import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpIcon, GripIcon } from '../icons/Icons.js';

interface Props<T extends string> {
  items: T[];
  name: (id: T) => string;
  onReorder: (items: T[]) => void;
  children: (id: T) => React.ReactNode;
}

export default function ProviderOrderList<T extends string>({ items, name, onReorder, children }: Props<T>): React.ReactElement {
  const { t } = useTranslation('center');
  const source = useRef<T | null>(null);
  const [dragging, setDragging] = useState<T | null>(null);
  const [over, setOver] = useState<{ id: T; after: boolean } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const reset = () => { source.current = null; setDragging(null); setOver(null); };
  const commit = (next: T[], id: T) => {
    if (next.every((value, index) => value === items[index])) return;
    onReorder(next);
    setAnnouncement(t('provider_order.position', { name: name(id), position: next.indexOf(id) + 1, count: next.length }));
  };
  const afterMiddle = (event: React.DragEvent<HTMLElement>): boolean => {
    const rect = event.currentTarget.getBoundingClientRect(); return event.clientY >= rect.top + rect.height / 2;
  };
  return <>
    <p className="photo-search-settings__hint">{t('provider_order.hint')}</p>
    <div role="list" className="provider-order-list">
      {items.map((id, index) => <div key={id} role="listitem" data-provider-id={id}
        className="photo-search-settings__provider"
        data-dragging={dragging === id || undefined}
        data-drop={over?.id === id && dragging !== id ? (over.after ? 'after' : 'before') : undefined}
        onDragOver={event => {
          if (!source.current) return;
          event.preventDefault(); event.dataTransfer.dropEffect = 'move';
          const after = afterMiddle(event);
          setOver(previous => previous?.id === id && previous.after === after ? previous : { id, after });
        }}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(null); }}
        onDrop={event => {
          const from = source.current;
          if (!from) return;
          event.preventDefault(); event.stopPropagation();
          if (from !== id) {
            const next = items.filter(value => value !== from);
            next.splice(next.indexOf(id) + (afterMiddle(event) ? 1 : 0), 0, from);
            commit(next, from);
          }
          reset();
        }}>
        <button type="button" draggable className="photo-search-settings__drag"
          aria-label={t('provider_order.drag', { name: name(id) })} title={t('provider_order.drag', { name: name(id) })}
          onDragStart={event => {
            source.current = id; setDragging(id);
            event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id);
            const row = event.currentTarget.parentElement!;
            event.dataTransfer.setDragImage(row, 16, row.offsetHeight / 2);
          }} onDragEnd={reset}>
          <GripIcon className="w-4 h-4" />
        </button>
        {children(id)}
        {([-1, 1] as const).map(offset => <button key={offset} type="button" className="photo-search-settings__move"
          disabled={index + offset < 0 || index + offset >= items.length}
          aria-label={t(offset < 0 ? 'photo.search_up' : 'photo.search_down') + ': ' + name(id)}
          onClick={() => {
            const next = [...items]; next.splice(index, 1); next.splice(index + offset, 0, id); commit(next, id);
          }}><ArrowUpIcon className={'w-4 h-4' + (offset > 0 ? ' rotate-180' : '')} /></button>)}
      </div>)}
    </div>
    <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
  </>;
}
