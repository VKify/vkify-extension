import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import DetailPage from './DetailPage.js';
import type { IconColor } from './iconColors.js';
import { peekAnchor, onAnchor } from '../../utils/pendingAnchor.js';

/**
 * Лёгкий «роутер» подстраниц внутри одной страницы раздела.
 *
 * Идея: страница раздела (например, «Мессенджер») перечисляет свои подстраницы
 * декларативно, рисует базовый список настроек и ряды-переходы (`NavRow`).
 * Пока ничего не открыто — виден базовый список; при открытии подстраницы
 * базовый список заменяется на её содержимое в обёртке `DetailPage` с кнопкой
 * «назад». Так фокус пользователя сосредоточен на одной функции.
 *
 * Состояние навигации (что открыто) живёт здесь, оформление — в `DetailPage`,
 * точка входа — в `NavRow`. Добавить новую отдельную страницу = добавить одну
 * запись в массив `subpages`, не трогая сам хост.
 *
 * Deep-link из Ctrl+K: если ожидающий якорь принадлежит одной из подстраниц,
 * хост открывает её сам — иначе DOM-опрос в App не нашёл бы скрытый элемент.
 */
export interface Subpage {
  /** id подстраницы (на него ссылается `NavRow`). */
  id: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  iconColor?: IconColor;
  /** Якоря поиска (data-vkify-anchor), живущие на этой подстранице. */
  anchors?: readonly string[];
  /** Контент подстраницы. Функция — чтобы тяжёлое тело не строилось, пока закрыто. */
  render: () => React.ReactNode;
}

interface SubpageNavValue {
  /** Открыть подстраницу по её id. */
  open: (id: string) => void;
  /** Вернуться к базовому списку. */
  close: () => void;
  /** id открытой подстраницы или null. */
  activeId: string | null;
}

const SubpageNavContext = createContext<SubpageNavValue | null>(null);

/** Доступ к навигации подстраниц. Только внутри `<SubpageHost>`. */
export function useSubpageNav(): SubpageNavValue {
  const ctx = useContext(SubpageNavContext);
  if (!ctx) {
    throw new Error('useSubpageNav должен использоваться внутри <SubpageHost>');
  }
  return ctx;
}

interface SubpageHostProps {
  subpages: readonly Subpage[];
  /** Базовый список раздела — содержит ряды-переходы (`NavRow`). */
  children: React.ReactNode;
}

export default function SubpageHost({ subpages, children }: SubpageHostProps): React.ReactElement {
  const [activeId, setActiveId] = useState<string | null>(null);

  const open = useCallback((id: string) => setActiveId(id), []);
  const close = useCallback(() => setActiveId(null), []);

  // Deep-link: открыть подстраницу, на которой лежит ожидающий/новый якорь.
  useEffect(() => {
    const applyAnchor = (anchor: string): void => {
      const target = subpages.find(s => s.anchors?.includes(anchor));
      if (target) setActiveId(target.id);
    };
    const pending = peekAnchor();
    if (pending) applyAnchor(pending);
    return onAnchor(applyAnchor);
  }, [subpages]);

  const value = useMemo<SubpageNavValue>(() => ({ open, close, activeId }), [open, close, activeId]);
  const active = subpages.find(s => s.id === activeId) ?? null;

  return (
    <SubpageNavContext.Provider value={value}>
      {active ? (
        <DetailPage
          key={active.id}
          title={active.title}
          subtitle={active.subtitle}
          icon={active.icon}
          iconColor={active.iconColor}
          onBack={close}
        >
          {active.render()}
        </DetailPage>
      ) : (
        children
      )}
    </SubpageNavContext.Provider>
  );
}
