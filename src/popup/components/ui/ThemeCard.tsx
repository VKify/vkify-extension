import React, { memo } from 'react';
import { CheckIcon, XIcon } from '../icons/Icons.js';
import type { Theme } from '../../constants/appearance.js';

interface ThemeCardProps {
  theme: Theme;
  isSelected: boolean;
  onSelect: () => void;
}

const ThemeCard = memo(function ThemeCard({ theme, isSelected, onSelect }: ThemeCardProps) {
  const isDefault = theme.id === 'default';
  const bgColor = isDefault ? '#1a1a1a' : theme.color;
  const accentColor = theme.accent || '#888';

  return (
    <button
      onClick={onSelect}
      aria-pressed={isSelected}
      aria-label={`Тема ${theme.name}${isSelected ? ' (выбрана)' : ''}`}
      className={`
        group relative flex flex-col rounded-xl overflow-hidden transition-all duration-200
        hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary
      `}
      style={{
        border: isSelected ? '1.5px solid #0077FF' : '1.5px solid rgba(255,255,255,0.12)',
        boxShadow: isSelected
          ? '0 0 0 3px rgba(0,119,255,0.15)'
          : '0 1px 2px rgba(0,0,0,0.25)',
      }}
    >
      <div
        className="flex items-center justify-center px-2.5 relative"
        style={{ height: '52px', backgroundColor: bgColor }}
      >
        {isDefault ? (
          <XIcon className="w-4 h-4 text-white/25" />
        ) : (
          <div className="flex flex-col gap-1 w-full">
            {([0.7, 0.5, 0.35] as const).map((width, i) => (
              <div
                key={i}
                className="rounded-full"
                style={{
                  backgroundColor: accentColor,
                  height: i === 0 ? '6px' : '4px',
                  width: `${width * 100}%`,
                  opacity: i === 0 ? 1 : i === 1 ? 0.5 : 0.3,
                }}
              />
            ))}
          </div>
        )}

        {isSelected && (
          <div
            className="absolute top-1 right-1 flex items-center justify-center rounded-full"
            style={{ width: '18px', height: '18px', backgroundColor: '#0077FF' }}
          >
            <CheckIcon className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      <div className="px-2 py-1.5 bg-[var(--bg-primary)] border-t border-[var(--border-color)]">
        <span className="text-[11px] text-white/50 truncate block text-center">
          {theme.name}
        </span>
      </div>
    </button>
  );
});

export default ThemeCard;