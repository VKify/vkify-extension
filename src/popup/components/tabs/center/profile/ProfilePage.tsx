import React from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection from '@/popup/components/ui/SettingsSection.js';
import InfoBlock from '@/popup/components/ui/InfoBlock.js';
import { ProfileIcon, MoveHorizontalIcon } from '@/popup/components/icons/Icons.js';

/**
 * Страница «Профиль» хаба «Центр» — настройки внешнего вида страницы профиля VK.
 */
export default function ProfilePage(): React.ReactElement {
  const { t } = useTranslation('center');
  return (
    <div className="space-y-4">
      <SettingsSection
        title={t('profile.section')}
        description={t('profile.section_desc')}
        icon={<ProfileIcon className="w-5 h-5" />}
        iconColor="cyan"
      >
        <SettingRow
          id="profile_swap_columns"
          title={t('profile.swap_title')}
          description={t('profile.swap_desc')}
          icon={<MoveHorizontalIcon className="w-5 h-5" />}
          iconColor="cyan"
        />
      </SettingsSection>
    </div>
  );
}
