import React, { memo, useState, useCallback } from 'react';
import SettingRow from '../../ui/SettingRow.js';
import { XIcon, FilterIcon, ChevronDownIcon } from '../../icons/Icons.js';
import { useVisualFilters } from '../../../hooks/features/useVisualFilters.js';
import { VISUAL_FILTERS } from '../../../constants/appearance.js';

interface ChevronIconProps {
  isOpen: boolean;
}

const ChevronIcon = memo(function ChevronIcon({ isOpen }: ChevronIconProps): React.ReactElement {
  return (
    <ChevronDownIcon
      className={`w-4 h-4 transition-colors duration-200 ${isOpen ? 'text-primary' : 'text-[var(--text-tertiary)]'}`}
    />
  );
});

interface VisualFiltersSectionProps {
  /** Рендер как тело отдельной страницы: без сворачиваемой карточки и шапки. */
  asPage?: boolean;
}

const VisualFiltersSection = memo(function VisualFiltersSection({ asPage = false }: VisualFiltersSectionProps): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);
  const expanded = asPage || isExpanded;
  const { activeCount, hasActiveFilters, hasMultipleFilters, resetFilters } = useVisualFilters();

  const handleToggle = useCallback((): void => {
    setIsExpanded(prev => !prev);
  }, []);

  const handleReset = useCallback((e: React.MouseEvent): void => {
    e.stopPropagation();
    void resetFilters();
  }, [resetFilters]);

  return (
    <section className={`bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden ${asPage ? 'pt-1' : ''}`}>
      {asPage && hasActiveFilters && (
        <div className="flex justify-end px-4 pt-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-error hover:bg-error/10 rounded-lg transition-colors active:scale-95"
            aria-label="Сбросить все фильтры"
          >
            <XIcon className="w-3.5 h-3.5" />
            Сбросить
          </button>
        </div>
      )}
      {!asPage && (
      <button
        onClick={handleToggle}
        aria-expanded={isExpanded}
        aria-controls="visual-filters-content"
        className="group w-full flex items-center justify-between p-4 hover:bg-[var(--bg-secondary)]/50 transition-all duration-200"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
            <FilterIcon className="w-5 h-5 text-purple-500" />
          </div>
          <div className="text-left">
            <span className="text-base font-semibold text-[var(--text-primary)] block">
              Визуальные фильтры
            </span>
            {hasActiveFilters ? (
              <span className="flex items-center gap-1 mt-0.5 text-xs font-medium text-pink-500">
                <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-pulse" />
                {activeCount} из {VISUAL_FILTERS.length} активно
              </span>
            ) : (
              <span className="text-xs text-[var(--text-secondary)]">{VISUAL_FILTERS.length} фильтров</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-error hover:bg-error/10 rounded-lg transition-colors active:scale-95"
              aria-label="Сбросить все фильтры"
            >
              <XIcon className="w-3.5 h-3.5" />
              Сбросить
            </button>
          )}
          <div className={`
            w-8 h-8 rounded-lg bg-[var(--bg-secondary)]
            flex items-center justify-center
            transition-all duration-300
            group-hover:bg-[var(--bg-tertiary)]
            ${isExpanded ? 'rotate-180 bg-primary/10' : ''}
          `}>
            <ChevronIcon isOpen={isExpanded} />
          </div>
        </div>
      </button>
      )}

      <div
        id="visual-filters-content"
        className={asPage ? '' : `
          grid transition-all duration-300 ease-out
          ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}
        `}
      >
        <div className={asPage ? '' : 'overflow-hidden'}>
          <div className="px-2 pb-2 space-y-0">
            {VISUAL_FILTERS.map((filter, index) => (
              <React.Fragment key={filter.id}>
                <SettingRow
                  id={filter.id}
                  title={filter.title}
                  icon={filter.emoji}
                  description={filter.description}
                />
                {index < VISUAL_FILTERS.length - 1 && (
                  <div className="mx-3 border-t border-[var(--border-color)]" />
                )}
              </React.Fragment>
            ))}
          </div>

          {hasMultipleFilters && (
            <div className="mx-4 mb-4" role="alert">
              <div className="flex gap-3 p-3 rounded-xl bg-warning/10 border border-warning/20">
                <span className="text-base flex-shrink-0" aria-hidden="true">⚠️</span>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Активно несколько фильтров. Это может замедлить работу страницы.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
});

export default VisualFiltersSection;