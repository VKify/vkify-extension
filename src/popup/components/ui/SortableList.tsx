import React, { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpIcon, GripIcon } from '../icons/Icons.js';
import { moveInOrder } from '@/shared/reorder.js';
import { REORDER_CSS } from '@/shared/ui/reorder-style.js';
import './sortable-list.css';

interface Props<T extends string> {
  items: T[];
  name: (id: T) => string;
  onReorder: (items: T[]) => void;
  children: (id: T) => React.ReactNode;
  className?: string;
  rowClassName?: string;
  enabled?: boolean;
  label?: string;
}

export default function SortableList<T extends string>({ items, name, onReorder, children, className = '', rowClassName = '', enabled = true, label }: Props<T>): React.ReactElement {
  const { t } = useTranslation('common');
  useLayoutEffect(() => {
    if (document.getElementById('vkify-reorder-styles')) return;
    const style = document.createElement('style'); style.id = 'vkify-reorder-styles'; style.textContent = REORDER_CSS; document.head.append(style);
  }, []);
  const source = useRef<T | null>(null);
  const [dragging, setDragging] = useState<T | null>(null);
  const [over, setOver] = useState<{ id: T; after: boolean } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const reset = () => { source.current = null; setDragging(null); setOver(null); };
  const commit = (next: T[], id: T) => {
    if (next.every((value, index) => value === items[index])) return;
    onReorder(next);
    setAnnouncement(t('reorder.position', { name: name(id), position: next.indexOf(id) + 1, count: next.length }));
  };
  const afterMiddle = (event: React.DragEvent<HTMLElement>): boolean => {
    const rect = event.currentTarget.getBoundingClientRect(); return event.clientY >= rect.top + rect.height / 2;
  };
  return <>
    {enabled && <p className="sortable-hint">{t('reorder.hint')}</p>}
    <div role="list" aria-label={label} className={className}>
      {items.map((id, index) => <div key={id} role="listitem" data-sortable-id={id}
        className={'vkify-reorder-row ' + rowClassName}
        data-dragging={dragging === id || undefined}
        data-drop={over?.id === id && dragging !== id ? (over.after ? 'after' : 'before') : undefined}
        onDragOver={event => {
          if (!enabled || !source.current) return;
          event.preventDefault(); event.dataTransfer.dropEffect = 'move';
          const after = afterMiddle(event);
          setOver(previous => previous?.id === id && previous.after === after ? previous : { id, after });
        }}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(null); }}
        onDrop={event => {
          const from = source.current;
          if (!enabled || !from || !items.includes(from)) { reset(); return; }
          event.preventDefault(); event.stopPropagation();
          if (from !== id) {
            const next = moveInOrder(items, from, id, afterMiddle(event));
            commit(next, from);
          }
          reset();
        }}>
        {enabled && <button type="button" draggable className="vkify-reorder-handle"
          aria-label={t('reorder.drag', { name: name(id) })} title={t('reorder.drag', { name: name(id) })}
          onDragStart={event => {
            source.current = id; setDragging(id);
            event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id);
            const row = event.currentTarget.parentElement!;
            event.dataTransfer.setDragImage(row, 16, row.offsetHeight / 2);
          }} onDragEnd={reset}>
          <GripIcon className="w-4 h-4" />
        </button>}
        {children(id)}
        {enabled && ([-1, 1] as const).map(offset => <button key={offset} type="button" className="vkify-reorder-button"
          disabled={index + offset < 0 || index + offset >= items.length}
          aria-label={t(offset < 0 ? 'reorder.up' : 'reorder.down') + ': ' + name(id)}
          onClick={() => {
            const next = [...items]; next.splice(index, 1); next.splice(index + offset, 0, id); commit(next, id);
          }}><ArrowUpIcon className={'w-4 h-4' + (offset > 0 ? ' rotate-180' : '')} /></button>)}
      </div>)}
    </div>
    <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
  </>;
}
