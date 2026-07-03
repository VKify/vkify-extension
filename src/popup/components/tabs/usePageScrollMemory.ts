import { useRef, useLayoutEffect, useCallback } from 'react';

/**
 * Память прокрутки контент-панели хаба с внутренними страницами (icon-рейл:
 * «Центр», «Скрытие»).
 *
 * @param pageId  id активной страницы хаба.
 * @returns `paneRef` — повесить на прокручиваемую контент-панель (div с
 *   `key={pageId}`); `switchPage(setPageId, id)` — сохраняет позицию уходящей
 *   страницы и переключает на новую.
 */
export function usePageScrollMemory(pageId: string): {
  paneRef: React.RefObject<HTMLDivElement>;
  switchPage: (setPageId: (id: string) => void, id: string) => void;
} {
  const paneRef = useRef<HTMLDivElement>(null);
  const savedScrolls = useRef<Record<string, number>>({});

  const switchPage = useCallback(
    (setPageId: (id: string) => void, id: string): void => {
      const pane = paneRef.current;
      if (pane) savedScrolls.current[pageId] = pane.scrollTop;
      setPageId(id);
    },
    [pageId],
  );

  // Панель только что смонтирована (key=pageId) и стоит на 0; для повторного
  // визита возвращаем сохранённую позицию — до кадра, без мигания.
  useLayoutEffect(() => {
    const pane = paneRef.current;
    if (pane) pane.scrollTop = savedScrolls.current[pageId] ?? 0;
  }, [pageId]);

  return { paneRef, switchPage };
}