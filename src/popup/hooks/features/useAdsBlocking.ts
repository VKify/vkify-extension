import { useCallback, useMemo } from 'react';
import { useSettings } from '../../context/SettingsContext.js';
import { useToast } from '../../context/ToastContext.js';

const ADS_SETTINGS_IDS = ['block_left_ads', 'block_feed_ads_api', 'block_feed_ads_dom', 'block_trackers'];

interface AdsStatus {
  type: 'full' | 'partial' | 'disabled';
  title: string;
  description: string;
}

export interface AdsBlockingHook {
  activeCount: number;
  totalCount: number;
  allBlocked: boolean;
  handleBlockAll: () => Promise<void>;
  getStatus: () => AdsStatus;
}

export function useAdsBlocking(): AdsBlockingHook {
  const { settings, saveMultiple } = useSettings();
  const { showToast } = useToast();

  const totalCount = ADS_SETTINGS_IDS.length;

  const activeCount = useMemo(() =>
    ADS_SETTINGS_IDS.filter(id => settings[id] === true).length,
    [settings]
  );

  const allBlocked = activeCount === totalCount;

  const handleBlockAll = useCallback(async (): Promise<void> => {
    const newValue = !allBlocked;
    const updates: Record<string, boolean> = {};
    ADS_SETTINGS_IDS.forEach(id => { updates[id] = newValue; });

    await saveMultiple(updates);
    showToast(
      newValue ? 'Вся реклама заблокирована' : 'Блокировка отключена',
      'success'
    );
  }, [allBlocked, saveMultiple, showToast]);

  const getStatus = useCallback((): AdsStatus => {
    if (allBlocked) {
      return {
        type: 'full',
        title: 'Полная защита',
        description: 'Все фильтры активны',
      };
    }
    if (activeCount > 0) {
      return {
        type: 'partial',
        title: 'Частичная защита',
        description: `Активно ${activeCount} из ${totalCount} фильтров`,
      };
    }
    return {
      type: 'disabled',
      title: 'Защита отключена',
      description: `Активно ${activeCount} из ${totalCount} фильтров`,
    };
  }, [allBlocked, activeCount, totalCount]);

  return {
    activeCount,
    totalCount,
    allBlocked,
    handleBlockAll,
    getStatus,
  };
}