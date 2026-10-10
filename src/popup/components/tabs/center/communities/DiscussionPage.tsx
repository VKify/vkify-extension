import React from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection from '@/popup/components/ui/SettingsSection.js';
import { CommunitiesIcon, GlobalScrollIcon, MessengerIcon } from '@/popup/components/icons/Icons.js';

/** Community discussion reading settings, opened through the existing SubpageHost. */
export default function DiscussionPage(): React.ReactElement {
  const { t } = useTranslation('center');
  return (
    <SettingsSection title={t('discussions.title')} description={t('discussions.description')}
      icon={<CommunitiesIcon className="w-5 h-5" />}>
      <SettingRow id="messages_global_scroll" title={t('discussions.global_scroll_title')}
        description={t('discussions.global_scroll_desc')} icon={<GlobalScrollIcon className="w-5 h-5" />} />
      <SettingRow id="messages_disable_hover" title={t('discussions.disable_hover_title')}
        description={t('discussions.disable_hover_desc')} icon={<MessengerIcon className="w-5 h-5" />} />
    </SettingsSection>
  );
}
