import React, { memo } from 'react';
import { ItalicIcon, UnderlineIcon } from '@/popup/components/icons/Icons.js';

interface FontStyleControlsProps {
  fontWeight: number;
  isItalic: boolean;
  isUnderline: boolean;
  textTransform: string;
  onWeightChange: (weight: number) => void;
  onItalicToggle: () => void;
  onUnderlineToggle: () => void;
  onTransformChange: (value: string) => void;
}

/** Насыщенность / курсив / подчёркивание / регистр — сегментированные контролы. */
const FontStyleControls = memo(function FontStyleControls({
  fontWeight,
  isItalic,
  isUnderline,
  textTransform,
  onWeightChange,
  onItalicToggle,
  onUnderlineToggle,
  onTransformChange,
}: FontStyleControlsProps): React.ReactElement {
  const weights = [
    { value: 300, label: 'Свет' },
    { value: 400, label: 'Обыч' },
    { value: 500, label: 'Средн' },
    { value: 600, label: 'Полу' },
    { value: 700, label: 'Жирн' },
  ];

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-[var(--text-secondary)] mb-2 block">
          Насыщенность
        </label>
        <div className="flex gap-1">
          {weights.map((w) => (
            <button
              key={w.value}
              onClick={() => onWeightChange(w.value)}
              className={`
                flex-1 py-1.5 text-xs rounded-lg transition-all
                ${fontWeight === w.value
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}
              `}
              style={{ fontWeight: w.value }}
              title={w.label}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onItalicToggle}
          className={`
            flex-1 flex items-center justify-center gap-2 py-2 rounded-xl transition-all
            ${isItalic
              ? 'bg-primary text-white shadow-sm'
              : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}
          `}
          title="Курсив"
        >
          <ItalicIcon className="w-4 h-4" />
          <span className="text-xs font-medium">Курсив</span>
        </button>

        <button
          onClick={onUnderlineToggle}
          className={`
            flex-1 flex items-center justify-center gap-2 py-2 rounded-xl transition-all
            ${isUnderline
              ? 'bg-primary text-white shadow-sm'
              : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}
          `}
          title="Подчёркивание"
        >
          <UnderlineIcon className="w-4 h-4" />
          <span className="text-xs font-medium">Подчёрк.</span>
        </button>
      </div>

      <div>
        <label className="text-xs font-medium text-[var(--text-secondary)] mb-2 block">
          Регистр
        </label>
        <div className="flex gap-1">
          {[
            { value: 'none', label: 'Обыч.', display: 'Обыч.', title: 'Обычный' },
            { value: 'uppercase', label: 'ВЕРХ', display: 'ВЕРХ', title: 'ВЕРХНИЙ' },
            { value: 'lowercase', label: 'нижн', display: 'нижн', title: 'нижний' },
            { value: 'capitalize', label: 'Каж.', display: 'Каж.', title: 'Каждое Слово' },
          ].map((t) => (
            <button
              key={t.value}
              onClick={() => onTransformChange(t.value)}
              className={`
                flex-1 py-1.5 text-xs font-medium rounded-lg transition-all
                ${textTransform === t.value
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}
              `}
              title={t.title}
            >
              {t.display}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

export default FontStyleControls;
