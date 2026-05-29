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
  const bgColor = isDefault ? 'var(--bg-secondary)' : theme.color;
  const accentColor = theme.accent || '#888';

  return (
    <button
      onClick={onSelect}
      aria-pressed={isSelected}
      aria-label={`Тема ${theme.name}${isSelected ? ' (выбрана)' : ''}`}
      className={`
        group relative flex flex-col rounded-xl overflow-hidden transition-all duration-200
        hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary
        ${isSelected
          ? 'ring-2 ring-primary ring-offset-2 ring-offset-[var(--bg-primary)]'
          : 'ring-1 ring-[var(--border-color)] hover:ring-2 hover:ring-[var(--text-tertiary)]'}
      `}
    >
      <div
        className="h-14 flex items-center justify-center px-2 relative"
        style={{ backgroundColor: bgColor }}
      >
        {isDefault ? (
          <XIcon className="w-4 h-4 text-[var(--text-tertiary)]" />
        ) : (
          <div className="flex flex-col gap-1 w-full">
            {([0.75, 0.5, 0.67] as const).map((width, i) => (
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
          <div className="absolute top-1 right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
            <CheckIcon className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      <div className="px-2 py-1.5 bg-[var(--bg-primary)] border-t border-[var(--border-color)]">
        <span className="text-[10px] font-medium text-[var(--text-primary)] truncate block">
          {theme.name}
        </span>
      </div>
    </button>
  );
});

export default ThemeCard;