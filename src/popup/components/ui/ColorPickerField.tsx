import React, { useEffect, useId, useRef, useState } from 'react';
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

/**
 * Триггер (пилюля/свотч) + разворачивающаяся ИНЛАЙН панель выбора цвета.
 *
 * Замена нативного `<input type="color">`: в Firefox он отображается/
 * позиционируется некорректно и не совпадает с дизайном. Инлайн-раскрытие
 * (без портала и расчёта координат) — самый надёжный путь в компактном popup
 * и одинаково работает во всех браузерах. Закрытие по клику вне и по Escape.
 */
const noop = (): void => { /* preview не задан */ };

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
  const panelId = useId();

  const norm = normalizeHex(value);
  const active = !!norm;
  // Панель всегда работает с валидным цветом; пустое значение → дефолт.
  const panelValue = norm ?? '#0077ff';

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
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

  return (
    <div ref={rootRef} className="relative">
      {trigger}
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={ariaLabel}
          className={`p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] shadow-lg animate-fade-in box-border ${
            // Пилюля во всю ширину раскрывается инлайн под собой; узкий свотч —
            // абсолютной панелью фикс-ширины. Ширина клампится по вьюпорту, чтобы
            // не вылезать за край в узком окне/встроенном режиме.
            variant === 'swatch'
              ? 'absolute left-0 top-full mt-2 z-50 w-[230px] max-w-[calc(100vw-1.5rem)]'
              : 'mt-2 w-full'
          }`}
        >
          <ColorPickerPanel value={panelValue} onInput={onInput ?? noop} onChange={onChange} presets={presets} />
        </div>
      )}
    </div>
  );
}
