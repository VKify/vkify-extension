import React, { useState, useEffect } from 'react';
import { ELEMENTS_PAGES, pageForAnchor } from './pages.js';
import { peekAnchor, onAnchor } from '../../../utils/pendingAnchor.js';

/**
 * Хаб «Элементы» — вкладка-контейнер с внутренними страницами, как хаб
 * «Центр» (../center/CenterTab.tsx): вертикальный icon-рейл слева, контент
 * активной страницы справа, мгновенное переключение с лёгким fade.
 */
export default function ElementsTab(): React.ReactElement {
  const [pageId, setPageId] = useState<string>(ELEMENTS_PAGES[0]?.id ?? '');
  const active = ELEMENTS_PAGES.find(p => p.id === pageId) ?? ELEMENTS_PAGES[0];
  const ActivePage = active.component;

  // Навигация из Ctrl+K: якорь может лежать на неактивной странице хаба —
  // открываем её, чтобы App нашёл элемент в DOM и подсветил его.
  useEffect(() => {
    const apply = (anchor: string): void => {
      const page = pageForAnchor(anchor);
      if (page) setPageId(page.id);
    };
    const pending = peekAnchor();
    if (pending) apply(pending);
    return onAnchor(apply);
  }, []);

  return (
    <div className="flex gap-3">
      <aside className="sticky top-0 self-start flex flex-col gap-1.5 w-[58px] flex-shrink-0">
        {ELEMENTS_PAGES.map(page => {
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
      </aside>

      <div key={active.id} className="flex-1 min-w-0 animate-fade-in">
        <ActivePage />
      </div>
    </div>
  );
}
