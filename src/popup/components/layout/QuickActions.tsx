import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import QuickCard from '../ui/QuickCard.js';
import { PaletteIcon, BanIcon, RefreshIcon, SearchIcon } from '../icons/Icons.js';
import { useVKifyStore } from '../../store/index.js';
import { useToast } from '../../context/ToastContext.js';
import { reloadActiveVKTab } from '../../utils/tabs.js';

interface QuickActionsProps {
  onOpenSearch: () => void;
  /** 'default' — отдельная секция; 'header' — рендер внутри гранитной шапки. */
  variant?: 'default' | 'header';
}

const AYU_DARK_THEME = Object.freeze({
  id: 'ayu-dark',
  name: 'Ayu Dark',
  color: '#0a0e14',
  accent: '#ffb454',
});

const AD_BLOCK_SETTINGS = ['block_left_ads', 'block_feed_ads_api', 'block_feed_ads_dom', 'block_trackers'];
const REFRESH_ANIMATION_DURATION = 500;

export default function QuickActions({ onOpenSearch, variant = 'default' }: QuickActionsProps) {
  const { t } = useTranslation('common');
  const settings = useVKifyStore((s) => s.settings);
  const saveMultiple = useVKifyStore((s) => s.saveMultiple);
  const { showToast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const themeEnabled = useMemo(
    () => settings['custom_theme_id'] === AYU_DARK_THEME.id,
    [settings['custom_theme_id']]
  );

  const adsBlocked = useMemo(
    () => AD_BLOCK_SETTINGS.every(key => settings[key] === true),
    [settings['block_left_ads'], settings['block_feed_ads_api'], settings['block_feed_ads_dom'], settings['block_trackers']]
  );

  const handleThemeToggle = useCallback(async (): Promise<void> => {
    try {
      if (themeEnabled) {
        await saveMultiple({ custom_theme_id: '', custom_theme: '', custom_accent: '' });
        showToast(t('quick.toast.theme_off'), 'success');
      } else {
        await saveMultiple({
          custom_theme_id: AYU_DARK_THEME.id,
          custom_theme: AYU_DARK_THEME.color,
          custom_accent: AYU_DARK_THEME.accent,
        });
        showToast(t('quick.toast.theme_on', { name: AYU_DARK_THEME.name }), 'success');
      }
    } catch (error) {
      showToast(t('quick.toast.theme_error'), 'error');
      console.error('Theme toggle error:', error);
    }
  }, [themeEnabled, saveMultiple, showToast, t]);

  const handleAdsToggle = useCallback(async (): Promise<void> => {
    try {
      const newValue = !adsBlocked;
      const newSettings = Object.fromEntries(AD_BLOCK_SETTINGS.map(key => [key, newValue]));
      await saveMultiple(newSettings);
      showToast(newValue ? t('quick.toast.ads_blocked') : t('quick.toast.ads_unblocked'), 'success');
    } catch (error) {
      showToast(t('quick.toast.ads_error'), 'error');
      console.error('Ad block toggle error:', error);
    }
  }, [adsBlocked, saveMultiple, showToast, t]);

  const handleRefresh = useCallback(async (): Promise<void> => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const reloaded = await reloadActiveVKTab();
      if (reloaded) {
        showToast(t('quick.toast.page_refreshed'), 'success');
      } else {
        showToast(t('quick.toast.open_vk_to_refresh'), 'warning');
      }
    } catch (error) {
      showToast(t('quick.toast.refresh_failed'), 'error');
      console.error('Refresh error:', error);
    } finally {
      setTimeout(() => setIsRefreshing(false), REFRESH_ANIMATION_DURATION);
    }
  }, [isRefreshing, showToast, t]);

  const quickCards = useMemo(() => [
    { id: 'search',  icon: SearchIcon,  label: t('quick.search'),    isAction: true, onClick: onOpenSearch },
    { id: 'theme',   icon: PaletteIcon, label: AYU_DARK_THEME.name,  active: themeEnabled, onClick: handleThemeToggle },
    { id: 'ads',     icon: BanIcon,     label: t('quick.ads_off'),    active: adsBlocked,   onClick: handleAdsToggle },
    { id: 'refresh', icon: RefreshIcon, label: t('action.refresh'), isAction: true, isAnimating: isRefreshing, onClick: handleRefresh },
  ], [themeEnabled, adsBlocked, isRefreshing, handleThemeToggle, handleAdsToggle, handleRefresh, onOpenSearch, t]);

  if (variant === 'header') {
    return (
      <div className="flex items-center gap-1.5" aria-label={t('quick.aria')}>
        {quickCards.map(({ id, icon: Icon, label, active, isAnimating, onClick }) => (
          <QuickCard
            key={id}
            icon={<Icon className={`w-5 h-5 ${isAnimating ? 'animate-spin' : ''}`} />}
            label={label}
            active={active}
            variant="header"
            onClick={onClick}
          />
        ))}
      </div>
    );
  }

  return (
    <section className="px-5 pt-3 pb-2" aria-label={t('quick.aria')}>
      <div className="flex gap-2">
        {quickCards.map(({ id, icon: Icon, label, active, isAction, isAnimating, onClick }) => (
          <QuickCard
            key={id}
            icon={<Icon className={`w-4 h-4 ${isAnimating ? 'animate-spin' : ''}`} />}
            label={label}
            active={active}
            isAction={isAction}
            onClick={onClick}
          />
        ))}
      </div>
    </section>
  );
}