import { useCallback, useMemo } from 'react';
import { useVKifyStore } from '../../store/index.js';
import { useToast } from '../../context/ToastContext.js';
import { useTranslation } from 'react-i18next';

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
  const settings = useVKifyStore((s) => s.settings);
  const saveMultiple = useVKifyStore((s) => s.saveMultiple);
  const { showToast } = useToast();
  const { t } = useTranslation('ads');

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
      t(newValue ? 'block.toast_blocked' : 'block.toast_disabled'),
      'success'
    );
  }, [allBlocked, saveMultiple, showToast, t]);

  const getStatus = useCallback((): AdsStatus => {
    if (allBlocked) {
      return {
        type: 'full',
        title: t('banner.full'),
        description: t('block.all_on'),
      };
    }
    if (activeCount > 0) {
      return {
        type: 'partial',
        title: t('banner.partial'),
        description: t('block.active_of_total', { active: activeCount, total: totalCount }),
      };
    }
    return {
      type: 'disabled',
      title: t('banner.off'),
      description: t('block.active_of_total', { active: activeCount, total: totalCount }),
    };
  }, [allBlocked, activeCount, totalCount, t]);

  return {
    activeCount,
    totalCount,
    allBlocked,
    handleBlockAll,
    getStatus,
  };
}
