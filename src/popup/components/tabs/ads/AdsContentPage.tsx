import React from 'react';
import { useTranslation } from 'react-i18next';
import { ADS_CONTENT_SETTINGS } from '@/shared/constants/ads-content.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { DashboardPanel, DashboardSettingCard } from '../../ui/DashboardPrimitives.js';
import Toggle from '../../ui/Toggle.js';
import {
  FeedIcon, MenuGamesIcon, MenuMarketIcon, PhoneIcon,
  ProfileIcon, MessengerIcon, MusicSectionIcon, VideoIcon, CommunitiesIcon, GlobeIcon,
} from '../../icons/Icons.js';

const SECTION_ICONS = {
  block_recommendations_feed: FeedIcon,
  block_recommendations_games: MenuGamesIcon,
  block_recommendations_market: MenuMarketIcon,
  block_recommendations_calls: PhoneIcon,
  block_recommendations_profile: ProfileIcon,
  block_recommendations_messenger: MessengerIcon,
  block_music_ads: MusicSectionIcon,
  block_recommendations_video: VideoIcon,
  block_recommendations_communities: CommunitiesIcon,
  block_yandex_browser_promo: GlobeIcon,
} satisfies Record<(typeof ADS_CONTENT_SETTINGS)[number], typeof FeedIcon>;

export default function AdsContentPage(): React.ReactElement {
  const { t } = useTranslation('ads');
  const settings = useVKifyStore((s) => s.settings);
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  const active = ADS_CONTENT_SETTINGS.filter(id => settings[id] === true).length;

  return (
    <div className="ads-content-page">
      <DashboardPanel title={t('content.subtitle')}
        description={t('content.meta', { active, total: ADS_CONTENT_SETTINGS.length })}
        icon={<span className="h-2.5 w-2.5 rounded-full bg-primary" />} className="pb-4">
        <div className="grid grid-cols-2 gap-2 px-4 pt-1 max-[590px]:grid-cols-1">
        {ADS_CONTENT_SETTINGS.map((id) => {
          const Icon = SECTION_ICONS[id];
          return <DashboardSettingCard key={id} anchor={id} settingId={id} docsId={id}
            title={t(`content.items.${id}.title`)} description={t(`content.items.${id}.desc`)}
            icon={<Icon className="w-5 h-5" data-content-icon={id} />}
            control={<Toggle checked={settings[id] === true}
              onChange={value => { void saveSetting(id, value); }} />} />;
        })}
        </div>
      </DashboardPanel>
    </div>
  );
}
