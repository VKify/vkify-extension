import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ColorPickerIcon } from '../icons/Icons.js';
import ColorPickerPanel from './ColorPickerPanel.js';
import { normalizeHex } from '../../utils/color.js';

interface ColorPickerFieldProps {
  /** Текущий цвет `#rrggbb` или пустая строка (цвет не задан). */
  value: string;
  /** Зафиксированное значение (отпускание ползунка/ввод/пресет) — стейт + запись. */
  onChange: (hex: string) => void;
  /**
   * Непрерывный preview во время перетаскивания. ДЕШЁВЫЙ обработчик (только
   * мгновенное применение цвета на странице, без тяжёлого стейта родителя). Если
   * не задан — preview-эмиты игнорируются (цвет применится только на фиксации).
   */
  onInput?: (hex: string) => void;
  /** Внешний вид триггера: широкая пилюля или компактный квадрат-свотч. */
  variant?: 'pill' | 'swatch';
  /** Доступное имя для триггера. */
  ariaLabel?: string;
  /** Текст-плейсхолдер пилюли, когда цвет не выбран. */
  placeholder?: string;
  /** Переопределение пресетов панели. */
  presets?: string[];
}

const noop = (): void => { /* preview не задан */ };

const GAP = 6;            // зазор между триггером и панелью
const MARGIN = 8;         // минимальный отступ от краёв окна
const SWATCH_PANEL_W = 232;

interface PopoverPos { top: number; left: number; maxHeight: number }

/**
 * Триггер (пилюля/свотч) + панель выбора цвета.
 *
 * Замена нативного `<input type="color">` (в Firefox он отображается и
 * позиционируется некорректно и не совпадает с дизайном).
 *
 * • `pill` (во всю ширину) — раскрывается ИНЛАЙН под собой: в потоке, поэтому
 *   контейнер со скроллом сам доезжает до неё, ничего не обрезается.
 * • `swatch` (узкий квадрат в тесном ряду) — рендерится ПОРТАЛОМ в body с
 *   позиционированием по триггеру: абсолютная панель внутри ряда обрезалась
 *   overflow-контейнером popup. Портал + расчёт координат (переворот вверх, если
 *   снизу не помещается, кламп по краям, ограничение высоты со скроллом)
 *   гарантируют, что мини-пикер всегда виден целиком.
 *
 * Закрытие — по клику вне и по Escape.
 */
export default function ColorPickerField({
  value,
  onChange,
  onInput,
  variant = 'pill',
  ariaLabel = 'Выбрать цвет',
  placeholder = 'Выбрать',
  presets,
}: ColorPickerFieldProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<PopoverPos | null>(null);
  const panelId = useId();

  const norm = normalizeHex(value);
  const active = !!norm;
  // Панель всегда работает с валидным цветом; пустое значение → дефолт.
  const panelValue = norm ?? '#0077ff';

  const isPortal = variant === 'swatch';

  // Позиционирование портала: считаем по триггеру, переворачиваем вверх если
  // снизу мало места, клампим по горизонтали, ограничиваем высоту.
  useLayoutEffect(() => {
    if (!open || !isPortal) return;
    const compute = (): void => {
      const anchor = rootRef.current;
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const panelH = panelRef.current?.offsetHeight ?? 320;
      const spaceBelow = vh - r.bottom - GAP - MARGIN;
      const spaceAbove = r.top - GAP - MARGIN;
      const above = spaceBelow < panelH && spaceAbove > spaceBelow;
      const maxHeight = Math.max(160, above ? spaceAbove : spaceBelow);
      const top = above
        ? Math.max(MARGIN, r.top - GAP - Math.min(panelH, maxHeight))
        : r.bottom + GAP;
      const left = Math.min(Math.max(MARGIN, r.left), vw - SWATCH_PANEL_W - MARGIN);
      setPos({ top, left, maxHeight });
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true); // capture — ловим скролл внутренних контейнеров
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [open, isPortal]);

  // Закрытие по клику вне (учитывая портал-панель) и по Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent): void => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const trigger = variant === 'swatch' ? (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-label={ariaLabel}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={panelId}
      title={active ? (norm as string).toUpperCase() : placeholder}
      className="w-10 h-10 rounded-lg border border-[var(--border-color)] cursor-pointer transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
      style={{ backgroundColor: active ? (norm as string) : 'var(--bg-secondary)' }}
    >
      {!active && <ColorPickerIcon className="w-4 h-4 m-auto text-[var(--text-secondary)]" />}
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-label={ariaLabel}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={panelId}
      className={`
        w-full h-11 rounded-xl border-2 flex items-center justify-center gap-2 cursor-pointer transition-all
        focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-1 focus:ring-offset-[var(--bg-primary)]
        ${active ? 'border-[var(--text-primary)]' : 'border-[var(--border-color)] hover:border-[var(--text-tertiary)]'}
      `}
      style={{ backgroundColor: active ? (norm as string) : 'var(--bg-secondary)' }}
    >
      <ColorPickerIcon className={`w-5 h-5 ${active ? 'text-white' : 'text-[var(--text-secondary)]'}`} />
      <span className={`text-sm font-medium ${active ? 'text-white' : 'text-[var(--text-secondary)]'}`}>
        {active ? (norm as string).toUpperCase() : placeholder}
      </span>
    </button>
  );

  const panel = (
    <ColorPickerPanel value={panelValue} onInput={onInput ?? noop} onChange={onChange} presets={presets} />
  );

  return (
    <div ref={rootRef} className="relative">
      {trigger}

      {/* pill — инлайн в потоке (скроллится вместе с контентом) */}
      {open && !isPortal && (
        <div
          id={panelId}
          role="dialog"
          aria-label={ariaLabel}
          className="mt-2 w-full p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] shadow-lg animate-fade-in box-border"
        >
          {panel}
        </div>
      )}

      {/* swatch — портал в body с позиционированием по триггеру */}
      {open && isPortal && createPortal(
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={ariaLabel}
          className="fixed z-[70] p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] shadow-lg animate-fade-in box-border overflow-y-auto overscroll-contain"
          style={{
            top: pos?.top ?? -9999,
            left: pos?.left ?? -9999,
            width: SWATCH_PANEL_W,
            maxHeight: pos?.maxHeight,
            visibility: pos ? 'visible' : 'hidden',
          }}
        >
          {panel}
        </div>,
        document.body,
      )}
    </div>
  );
}
