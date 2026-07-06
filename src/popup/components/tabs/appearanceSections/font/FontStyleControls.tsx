import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('appearance');
  const weights = [300, 400, 500, 600, 700] as const;
  const cases = ['none', 'uppercase', 'lowercase', 'capitalize'] as const;

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-[var(--text-secondary)] mb-2 block">
          {t('font.style.weight_label')}
        </label>
        <div className="flex gap-1">
          {weights.map((w) => {
            const label = t(`font.style.weights.${w}`);
            return (
              <button
                key={w}
                onClick={() => onWeightChange(w)}
                className={`
                  flex-1 py-1.5 text-xs rounded-lg transition-all
                  ${fontWeight === w
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}
                `}
                style={{ fontWeight: w }}
                title={label}
              >
                {label}
              </button>
            );
          })}
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
          title={t('font.style.italic')}
        >
          <ItalicIcon className="w-4 h-4" />
          <span className="text-xs font-medium">{t('font.style.italic')}</span>
        </button>

        <button
          onClick={onUnderlineToggle}
          className={`
            flex-1 flex items-center justify-center gap-2 py-2 rounded-xl transition-all
            ${isUnderline
              ? 'bg-primary text-white shadow-sm'
              : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}
          `}
          title={t('font.style.underline_title')}
        >
          <UnderlineIcon className="w-4 h-4" />
          <span className="text-xs font-medium">{t('font.style.underline')}</span>
        </button>
      </div>

      <div>
        <label className="text-xs font-medium text-[var(--text-secondary)] mb-2 block">
          {t('font.style.case_label')}
        </label>
        <div className="flex gap-1">
          {cases.map((c) => (
            <button
              key={c}
              onClick={() => onTransformChange(c)}
              className={`
                flex-1 py-1.5 text-xs font-medium rounded-lg transition-all
                ${textTransform === c
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}
              `}
              title={t(`font.style.case.${c}.title`)}
            >
              {t(`font.style.case.${c}.display`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

export default FontStyleControls;
