import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HIDING_PAGES, pageForAnchor } from './pages.js';
import { peekAnchor, onAnchor } from '@/popup/utils/pendingAnchor.js';

/**
 * Хаб «Скрытие» — вкладка-контейнер с внутренними страницами, как хаб
 * «Центр» (../center/CenterTab.tsx): вертикальный icon-рейл слева, контент
 * активной страницы справа, мгновенное переключение с лёгким fade.
 */
export default function HidingTab(): React.ReactElement {
  const [pageId, setPageId] = useState<string>(HIDING_PAGES[0]?.id ?? '');
  const active = HIDING_PAGES.find(p => p.id === pageId) ?? HIDING_PAGES[0];
  const ActivePage = active.component;

  const scrollRef = useRef<HTMLDivElement>(null);
  const savedScrolls = useRef<Record<string, number>>({});

  const getScroller = useCallback(
    (): HTMLElement | null => scrollRef.current?.closest('main') ?? null,
    [],
  );

  const switchPage = useCallback((id: string): void => {
    const scroller = getScroller();
    if (scroller) savedScrolls.current[pageId] = scroller.scrollTop;
    setPageId(id);
    const saved = savedScrolls.current[id] ?? 0;
    requestAnimationFrame(() => {
      const s = getScroller();
      if (s) s.scrollTop = saved;
    });
  }, [pageId, getScroller]);

  // Навигация из Ctrl+K: якорь может лежать на неактивной странице хаба —
  // открываем её, чтобы App нашёл элемент в DOM и подсветил его.
  useEffect(() => {
    const apply = (anchor: string): void => {
      const page = pageForAnchor(anchor);
      if (page) switchPage(page.id);
    };
    const pending = peekAnchor();
    if (pending) apply(pending);
    return onAnchor(apply);
  }, []);

  return (
    <div ref={scrollRef} className="flex gap-3">
      <aside className="sticky top-0 self-start flex flex-col gap-1.5 w-[58px] flex-shrink-0">
        {HIDING_PAGES.map(page => {
          const Icon = page.icon;
          const isActive = page.id === active.id;
          return (
            <button
              key={page.id}
              onClick={() => switchPage(page.id)}
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
