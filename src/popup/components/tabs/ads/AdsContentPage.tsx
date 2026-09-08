import React from 'react';
import { useTranslation } from 'react-i18next';
import { ADS_CONTENT_SETTINGS } from '@/shared/constants/ads-content.js';
import { useVKifyStore } from '@/popup/store/index.js';
import SettingRow from '../../ui/SettingRow.js';
import SettingsSection from '../../ui/SettingsSection.js';
import {
  FeedIcon, MenuGamesIcon, MenuMarketIcon, PhoneIcon,
  ProfileIcon, MessengerIcon, MusicSectionIcon, CommunitiesIcon, GlobeIcon,
} from '../../icons/Icons.js';

const SECTION_ICONS = [FeedIcon, MenuGamesIcon, MenuMarketIcon, PhoneIcon, ProfileIcon, MessengerIcon, MusicSectionIcon, CommunitiesIcon, GlobeIcon];

export default function AdsContentPage(): React.ReactElement {
  const { t } = useTranslation('ads');
  const settings = useVKifyStore((s) => s.settings);
  const active = ADS_CONTENT_SETTINGS.filter(id => settings[id] === true).length;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4">
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          {t('content.meta', { active, total: ADS_CONTENT_SETTINGS.length })}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
          {t('content.description')}
        </p>
      </div>
      <SettingsSection title={t('content.subtitle')} className="border border-[var(--border-color)]">
        {ADS_CONTENT_SETTINGS.map((id, index) => {
          const Icon = SECTION_ICONS[index];
          return (
            <React.Fragment key={id}>
              {index > 0 && <div className="mx-3 border-t border-[var(--border-color)]" />}
              <SettingRow
                id={id}
                title={t(`content.items.${id}.title`)}
                description={t(`content.items.${id}.desc`)}
                icon={<Icon className="w-5 h-5" />}
                iconColor="blue"
              />
            </React.Fragment>
          );
        })}
      </SettingsSection>
    </div>
  );
}
