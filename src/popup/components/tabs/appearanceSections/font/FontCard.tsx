import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckIcon } from '@/popup/components/icons/Icons.js';
import type { Font } from '@/popup/constants/appearance.js';
import { getFontFamilyForPreview } from './helpers.js';

interface FontCardProps {
  font: Font;
  isSelected: boolean;
  onSelect: () => void;
}

/** Карточка шрифта с живым превью, бейджами и галочкой выбора. */
const FontCard = memo(function FontCard({ font, isSelected, onSelect }: FontCardProps): React.ReactElement {
  const { t } = useTranslation('appearance');
  const previewText = font.decorative ? 'Aa' : t('font.preview_text');
  const fontFamily = getFontFamilyForPreview(font);

  return (
    <button
      onClick={onSelect}
      aria-pressed={isSelected}
      className={`relative flex flex-col rounded-xl overflow-hidden border transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]
        ${isSelected ? 'border-primary ring-2 ring-primary/15' : 'border-[var(--border-color)]'}`}
    >
      <div className="h-14 flex items-center justify-center px-2 bg-[var(--bg-secondary)]">
        <span
          className={`text-[var(--text-primary)] ${font.mono ? 'text-sm' : font.decorative ? 'text-xl' : 'text-lg'}`}
          style={{ fontFamily }}
        >
          {previewText}
        </span>
      </div>

      <div className="px-2 py-1.5 bg-[var(--bg-primary)] border-t border-[var(--border-color)]">
        <span className="text-[10px] font-medium text-[var(--text-primary)] truncate block leading-tight">
          {t(`font.names.${font.id}`, { defaultValue: font.name })}
        </span>
      </div>

      {isSelected && (
        <div
          className="absolute top-1.5 right-1.5 flex items-center justify-center rounded-full"
          style={{ width: '18px', height: '18px', backgroundColor: 'var(--primary)' }}
        >
          <CheckIcon className="w-3 h-3 text-white" />
        </div>
      )}

      <div className="absolute top-1 left-1 flex gap-0.5">
        {font.popular && (
          <span className="px-1 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded text-[8px] font-semibold leading-none">P</span>
        )}
        {font.mono && (
          <span className="px-1 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded text-[8px] font-semibold leading-none">M</span>
        )}
        {font.serif && !font.mono && (
          <span className="px-1 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded text-[8px] font-semibold leading-none">S</span>
        )}
      </div>
    </button>
  );
});

export default FontCard;
