import { useCallback, useMemo } from 'react';
import { useVKifyStore } from '../../store/index.js';
import { useToast } from '../../context/ToastContext.js';

const FILTER_IDS = [
  'filter_grayscale',
  'filter_sepia',
  'filter_invert',
  'filter_dim_images',
  'filter_low_brightness',
  'filter_high_contrast',
];

export interface VisualFiltersHook {
  activeCount: number;
  hasActiveFilters: boolean;
  hasMultipleFilters: boolean;
  resetFilters: () => Promise<void>;
}

export function useVisualFilters(): VisualFiltersHook {
  const settings = useVKifyStore((s) => s.settings);
  const saveMultiple = useVKifyStore((s) => s.saveMultiple);
  const { showToast } = useToast();

  const activeCount = useMemo(() =>
    FILTER_IDS.filter(id => settings[id] === true).length,
    [settings]
  );

  const resetFilters = useCallback(async (): Promise<void> => {
    const updates: Record<string, boolean> = {};
    FILTER_IDS.forEach(id => { updates[id] = false; });
    await saveMultiple(updates);
    showToast('Все фильтры отключены', 'success');
  }, [saveMultiple, showToast]);

  return {
    activeCount,
    hasActiveFilters: activeCount > 0,
    hasMultipleFilters: activeCount > 1,
    resetFilters,
  };
}