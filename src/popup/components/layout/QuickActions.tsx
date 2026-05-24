import React, { useState, useCallback, useMemo } from 'react';
import QuickCard from '../ui/QuickCard.js';
import { PaletteIcon, BanIcon, RefreshIcon } from '../icons/Icons.js';
import { useSettings } from '../../context/SettingsContext.js';
import { useToast } from '../../context/ToastContext.js';

const AYU_DARK_THEME = Object.freeze({
  id: 'ayu-dark',
  name: 'Ayu Dark',
  color: '#0a0e14',
  accent: '#ffb454',
});

const AD_BLOCK_SETTINGS = ['block_left_ads', 'block_feed_ads_api', 'block_feed_ads_dom', 'block_trackers'];
const REFRESH_ANIMATION_DURATION = 500;

export default function QuickActions() {
  const { settings, saveMultiple } = useSettings();
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
        showToast('Тема отключена', 'success');
      } else {
        await saveMultiple({
          custom_theme_id: AYU_DARK_THEME.id,
          custom_theme: AYU_DARK_THEME.color,
          custom_accent: AYU_DARK_THEME.accent,
        });
        showToast(`Тема ${AYU_DARK_THEME.name} включена`, 'success');
      }
    } catch (error) {
      showToast('Ошибка при смене темы', 'error');
      console.error('Theme toggle error:', error);
    }
  }, [themeEnabled, saveMultiple, showToast]);

  const handleAdsToggle = useCallback(async (): Promise<void> => {
    try {
      const newValue = !adsBlocked;
      const newSettings = Object.fromEntries(AD_BLOCK_SETTINGS.map(key => [key, newValue]));
      await saveMultiple(newSettings);
      showToast(newValue ? 'Реклама заблокирована' : 'Блокировка отключена', 'success');
    } catch (error) {
      showToast('Ошибка настройки блокировки', 'error');
      console.error('Ad block toggle error:', error);
    }
  }, [adsBlocked, saveMultiple, showToast]);

  const handleRefresh = useCallback(async (): Promise<void> => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url?.includes('vk.com')) {
        if (tab.id) await chrome.tabs.reload(tab.id);
        showToast('Страница обновлена', 'success');
      } else {
        showToast('Откройте VK для обновления', 'warning');
      }
    } catch (error) {
      showToast('Не удалось обновить страницу', 'error');
      console.error('Refresh error:', error);
    } finally {
      setTimeout(() => setIsRefreshing(false), REFRESH_ANIMATION_DURATION);
    }
  }, [isRefreshing, showToast]);

  const quickCards = useMemo(() => [
    { id: 'theme',   icon: PaletteIcon, label: AYU_DARK_THEME.name, active: themeEnabled, onClick: handleThemeToggle },
    { id: 'ads',     icon: BanIcon,     label: 'Без рекламы',        active: adsBlocked,   onClick: handleAdsToggle },
    { id: 'refresh', icon: RefreshIcon, label: 'Обновить', isAction: true, isAnimating: isRefreshing, onClick: handleRefresh },
  ], [themeEnabled, adsBlocked, isRefreshing, handleThemeToggle, handleAdsToggle, handleRefresh]);

  return (
    <section className="px-5 py-4" aria-label="Быстрые действия">
      <div className="flex gap-3">
        {quickCards.map(({ id, icon: Icon, label, active, isAction, isAnimating, onClick }) => (
          <QuickCard
            key={id}
            icon={<Icon className={`w-6 h-6 ${isAnimating ? 'animate-spin' : ''}`} />}
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