import React, { memo } from 'react';
import { CheckIcon } from '../../../icons/Icons.js';
import type { Font } from '../../../../constants/appearance.js';
import { getFontFamilyForPreview } from './helpers.js';

interface FontCardProps {
  font: Font;
  isSelected: boolean;
  onSelect: () => void;
}

/** Карточка шрифта с живым превью, бейджами (★/M/S) и галочкой выбора. */
const FontCard = memo(function FontCard({ font, isSelected, onSelect }: FontCardProps): React.ReactElement {
  const previewText = font.decorative ? 'Aa' : 'Привет';
  const fontFamily = getFontFamilyForPreview(font);

  return (
    <button
      onClick={onSelect}
      aria-pressed={isSelected}
      className="relative flex flex-col rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
      style={{
        border: isSelected ? '1.5px solid #0077FF' : '1.5px solid rgba(255,255,255,0.12)',
        boxShadow: isSelected
          ? '0 0 0 3px rgba(0,119,255,0.15)'
          : '0 1px 2px rgba(0,0,0,0.25)',
      }}
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
          {font.name}
        </span>
      </div>

      {isSelected && (
        <div
          className="absolute top-1.5 right-1.5 flex items-center justify-center rounded-full"
          style={{ width: '18px', height: '18px', backgroundColor: '#0077FF' }}
        >
          <CheckIcon className="w-3 h-3 text-white" />
        </div>
      )}

      <div className="absolute top-1 left-1 flex gap-0.5">
        {font.popular && (
          <span className="px-1 py-0.5 bg-yellow-500/15 text-yellow-600 border border-yellow-500/20 rounded text-[8px] font-semibold leading-none">★</span>
        )}
        {font.mono && (
          <span className="px-1 py-0.5 bg-purple-500/15 text-purple-600 border border-purple-500/20 rounded text-[8px] font-semibold leading-none">M</span>
        )}
        {font.serif && !font.mono && (
          <span className="px-1 py-0.5 bg-amber-500/15 text-amber-600 border border-amber-500/20 rounded text-[8px] font-semibold leading-none">S</span>
        )}
      </div>
    </button>
  );
});

export default FontCard;
