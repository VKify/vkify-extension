import React from 'react';
import { useTranslation } from 'react-i18next';
import HidingSection from '../HidingSection.js';
import SubpageHost, { type Subpage } from '@/popup/components/ui/SubpageHost.js';
import NavRow from '@/popup/components/ui/NavRow.js';
import ResetButton from '@/popup/components/ui/ResetButton.js';
import MenuItemsSection from './MenuItemsSection.js';
import VideoMenuItemsSection from './VideoMenuItemsSection.js';
import { VKIcon, VideoIcon, SettingsIcon, CounterIcon } from '@/popup/components/icons/Icons.js';
import { useMenuItems } from '@/popup/hooks/features/useMenuItems.js';
import { useVideoMenuItems } from '@/popup/hooks/features/useVideoMenuItems.js';

function MenuItemsResetButton({ video = false }: { video?: boolean }): React.ReactElement | null {
  const { t } = useTranslation('hiding');
  const vk = useMenuItems();
  const vkVideo = useVideoMenuItems();
  const { hiddenCount, showAll } = video ? vkVideo : vk;
  return hiddenCount ? <ResetButton onClick={showAll} aria-label={t('menu.show_all_aria')} /> : null;
}

export default function MenuPage(): React.ReactElement {
  const { t } = useTranslation('hiding');
  const vk = useMenuItems();
  const video = useVideoMenuItems();
  const serviceItems = <HidingSection title={t('rail.menu')} elements={[
    { id: 'hide_menu_settings', title: t('items.hide_menu_settings.title'), description: t('items.hide_menu_settings.desc'), icon: <SettingsIcon className="w-5 h-5" /> },
    { id: 'hide_menu_counters', title: t('items.hide_menu_counters.title'), description: t('items.hide_menu_counters.desc'), icon: <CounterIcon className="w-5 h-5" /> },
  ]} />;
  const subpages: Subpage[] = [
    { id: 'menu_items', title: 'VK.RU', subtitle: t('menu.items_desc'), icon: <VKIcon className="w-5 h-5" />,
      anchors: ['hidden_menu_items', 'hide_menu_settings', 'hide_menu_counters'],
      render: () => <div className="space-y-4"><div data-vkify-anchor="hidden_menu_items"><MenuItemsSection /></div>{serviceItems}</div>,
      headerAction: () => <MenuItemsResetButton /> },
    { id: 'video_menu_items', title: 'VKVIDEO', subtitle: t('video.menu_desc'), icon: <VideoIcon className="w-5 h-5" />,
      anchors: ['hidden_video_menu_items', 'video_menu_items_order'], render: () => <VideoMenuItemsSection />,
      headerAction: () => <MenuItemsResetButton video /> },
  ];
  return <SubpageHost subpages={subpages}><section className="dashboard-panel overflow-hidden">
    <NavRow subpage="menu_items" docsId="hidden_menu_items" title="VK.RU"
      icon={<VKIcon className="w-5 h-5" />} meta={vk.hiddenCount > 0 ? t('hidden_count', { count: vk.hiddenCount }) : undefined} />
    <NavRow subpage="video_menu_items" docsId="hidden_video_menu_items" title="VKVIDEO"
      icon={<VideoIcon className="w-5 h-5" />} meta={video.hiddenCount > 0 ? t('hidden_count', { count: video.hiddenCount }) : undefined} />
  </section></SubpageHost>;
}
