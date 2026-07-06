import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { XIcon } from '../icons/Icons.js';
import { useEmbedViewport } from '../../hooks/core/useEmbedViewport.js';

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
  /** Заголовок в шапке. Если не задан и showHeader=false — шапки нет. */
  title?: React.ReactNode;
  /** Контент подвала (кнопки и т.п.). */
  footer?: React.ReactNode;
  /** Доп. элементы в шапке слева от крестика. */
  headerActions?: React.ReactNode;
  /** Класс ширины карточки (Tailwind). По умолчанию max-w-md. */
  maxWidthClass?: string;
  /** Вертикальное выравнивание в видимой области. */
  align?: 'center' | 'top';
  /** Показывать ли стандартную шапку (заголовок + крестик). */
  showHeader?: boolean;
  /** Доп. классы карточки. */
  cardClassName?: string;
  /** Обработчик клавиш на карточке (напр. стрелки в палитре поиска). */
  onCardKeyDown?: (e: React.KeyboardEvent) => void;
  ariaLabel?: string;
  /**
   * Режим «без карточки»: Modal даёт только затемнение, позиционирование,
   * портал, Escape и клик-вне, а `children` сам является карточкой (со своей
   * шириной/версткой). Для сложных модалок с собственным flex-layout.
   */
  bare?: boolean;
}

/**
 * Единое модальное окно для всего расширения. За основу взято оформление
 * палитры поиска: затемнение с блюром, карточка со скруглением/тенью, закрытие
 * по клику вне и по Escape.
 *
 * Позиционирование embed-aware: в обычном popup'е это `fixed inset-0` по центру
 * окна; во встроенном iframe (vk.com/vkify_settings) окно центрируется по
 * присланной видимой полосе (useEmbedViewport), а не по середине длинного
 * iframe — иначе модалка появлялась бы за пределами экрана.
 */
export default function Modal({
  onClose,
  children,
  title,
  footer,
  headerActions,
  maxWidthClass = 'max-w-md',
  align = 'center',
  showHeader = true,
  cardClassName = '',
  onCardKeyDown,
  ariaLabel,
  bare = false,
}: ModalProps) {
  const { t } = useTranslation('common');
  const viewport = useEmbedViewport();

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const alignClass = align === 'top' ? 'items-start pt-20' : 'items-center';

  // В embed-режиме оверлей — absolute по видимой полосе iframe; иначе fixed по
  // окну. Inline-стиль перекрывает позиционирование из className при embed.
  const overlayStyle: React.CSSProperties = viewport
    ? { position: 'absolute', left: 0, right: 0, top: viewport.top, height: viewport.height }
    : {};
  const overlayPosClass = viewport ? '' : 'fixed inset-0';
  const overlayClass = `${overlayPosClass} z-[60] flex justify-center ${alignClass} px-4 py-4 bg-black/40 backdrop-blur-sm animate-fade-in`;
  const onOverlayMouseDown = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) onClose();
  };

  // Потолок высоты карточки = доступная высота − отступы, но не выше HARD_CAP,
  // чтобы оставался виден интерфейс за окном. «Доступная высота»:
  //  • popup: высота окна расширения (≈660);
  //  • embed: присланная видимая полоса (vh относится к высокому iframe и врёт).
  const VERTICAL_PADDING = 48; // py-4 overlay + воздух сверху/снизу
  const CARD_HARD_CAP_PX = 560;
  const available = viewport
    ? viewport.height
    : (typeof window !== 'undefined' ? window.innerHeight : 660);
  const cardStyle: React.CSSProperties = {
    maxHeight: Math.max(240, Math.min(available - VERTICAL_PADDING, CARD_HARD_CAP_PX)),
  };

  if (bare) {
    return createPortal(
      <div
        className={overlayClass}
        style={overlayStyle}
        onMouseDown={onOverlayMouseDown}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        {children}
      </div>,
      document.body,
    );
  }

  const overlay = (
    <div
      className={overlayClass}
      style={overlayStyle}
      onMouseDown={onOverlayMouseDown}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div
        className={`w-full ${maxWidthClass} bg-[var(--bg-primary)] rounded-2xl shadow-2xl border border-[var(--border-color)] overflow-hidden flex flex-col ${cardClassName}`}
        style={cardStyle}
        onKeyDown={onCardKeyDown}
      >
        {showHeader && (title || headerActions) && (
          <div className="flex items-center justify-between gap-2 p-4 border-b border-[var(--border-color)] flex-shrink-0">
            <h3 className="text-base font-semibold text-[var(--text-primary)] truncate">{title}</h3>
            <div className="flex items-center gap-1 flex-shrink-0">
              {headerActions}
              <button
                onClick={onClose}
                className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                aria-label={t('action.close')}
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0">{children}</div>

        {footer && (
          <div className="flex gap-3 p-4 border-t border-[var(--border-color)] flex-shrink-0">{footer}</div>
        )}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
