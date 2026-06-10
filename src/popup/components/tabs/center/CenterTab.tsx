import React, { useState, useEffect } from 'react';
import { CENTER_PAGES, pageForAnchor } from './pages.js';
import { PlusIcon } from '../../icons/Icons.js';
import { consumeAnchor, onAnchor } from '../../../utils/pendingAnchor.js';

/**
 * Хаб «Центр» — вкладка-контейнер с внутренними страницами (как разделы в VK).
 * Компактная навигация — вертикальный icon-рейл слева, контент активной
 * страницы справа. Переключение — мгновенное, с лёгким fade.
 *
 * Архитектура (см. pages.tsx) рассчитана на произвольное число разделов.
 * Заглушка «Скоро» в рейле сообщает, что разделы будут добавляться, не
 * создавая самих страниц.
 */
export default function CenterTab(): React.ReactElement {
  const [pageId, setPageId] = useState<string>(CENTER_PAGES[0]?.id ?? '');
  const active = CENTER_PAGES.find(p => p.id === pageId) ?? CENTER_PAGES[0];
  const ActivePage = active.component;

  // Навигация из Ctrl+K: якорь может лежать на неактивной странице хаба —
  // открываем её, чтобы App нашёл элемент в DOM и подсветил его.
  useEffect(() => {
    const apply = (anchor: string): void => {
      const page = pageForAnchor(anchor);
      if (page) setPageId(page.id);
    };
    const pending = consumeAnchor();
    if (pending) apply(pending);
    return onAnchor(apply);
  }, []);

  return (
    <div className="flex gap-3">
      <aside className="sticky top-0 self-start flex flex-col gap-1.5 w-[58px] flex-shrink-0">
        {CENTER_PAGES.map(page => {
          const Icon = page.icon;
          const isActive = page.id === active.id;
          return (
            <button
              key={page.id}
              onClick={() => setPageId(page.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-primary text-white shadow-md shadow-primary/25'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-semibold leading-tight text-center">{page.label}</span>
            </button>
          );
        })}

        {/* Заглушка будущих разделов — не страница, не кликается. */}
        <div
          title="Новые разделы появятся здесь"
          className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border border-dashed border-[var(--border-color)] text-[var(--text-tertiary)] opacity-60 cursor-default select-none"
        >
          <PlusIcon className="w-5 h-5" />
          <span className="text-[9px] font-semibold leading-tight text-center">Скоро</span>
        </div>
      </aside>

      <div key={active.id} className="flex-1 min-w-0 animate-fade-in">
        <ActivePage />
      </div>
    </div>
  );
}
