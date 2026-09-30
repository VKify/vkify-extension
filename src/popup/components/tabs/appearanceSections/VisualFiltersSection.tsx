import React, { memo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '../../ui/SettingRow.js';
import ResetButton from '../../ui/ResetButton.js';
import { FilterIcon, ChevronDownIcon, WarningIcon, ContrastIcon, DropletIcon, RefreshIcon, MoonIcon, SunIcon, EyeIcon } from '../../icons/Icons.js';
import { useVisualFilters } from '@/popup/hooks/features/useVisualFilters.js';
import { VISUAL_FILTERS } from '@/popup/constants/appearance.js';

const FILTER_ICONS: Record<string, React.ReactNode> = {
  contrast: <ContrastIcon className="w-5 h-5" />,
  droplet: <DropletIcon className="w-5 h-5" />,
  refresh: <RefreshIcon className="w-5 h-5" />,
  moon: <MoonIcon className="w-5 h-5" />,
  sun: <SunIcon className="w-5 h-5" />,
  eye: <EyeIcon className="w-5 h-5" />,
};

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
  const { t } = useTranslation('appearance');
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
    <section className={`dashboard-panel ${asPage ? 'pt-2' : ''}`}>
      {!asPage && (
      <button
        onClick={handleToggle}
        aria-expanded={isExpanded}
        aria-controls="visual-filters-content"
        className="group w-full flex items-center justify-between p-4 hover:bg-[var(--bg-secondary)]/50 transition-all duration-200"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
            <FilterIcon className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <span className="text-base font-semibold text-[var(--text-primary)] block">
              {t('items.filters.title')}
            </span>
            {hasActiveFilters ? (
              <span className="flex items-center gap-1 mt-0.5 text-xs font-medium text-pink-500">
                <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-pulse" />
                {t('visual_filters.active_count', { active: activeCount, total: VISUAL_FILTERS.length })}
              </span>
            ) : (
              <span className="text-xs text-[var(--text-secondary)]">{t('visual_filters.count', { count: VISUAL_FILTERS.length })}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <ResetButton onClick={handleReset} aria-label={t('reset.filters')} />
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
          <div className="pb-2">
            {VISUAL_FILTERS.map((filter) => (
              <React.Fragment key={filter.id}>
                <SettingRow
                  id={filter.id}
                  title={t(`visual_filters.items.${filter.id}.title`, { defaultValue: filter.title })}
                  icon={FILTER_ICONS[filter.iconId]}
                  description={t(`visual_filters.items.${filter.id}.desc`, { defaultValue: filter.description })}
                />
              </React.Fragment>
            ))}
          </div>

          {hasMultipleFilters && (
            <div className="mx-4 mb-4" role="alert">
              <div className="flex gap-3 p-3 rounded-xl bg-warning/10 border border-warning/20">
                <WarningIcon className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {t('visual_filters.warning')}
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
