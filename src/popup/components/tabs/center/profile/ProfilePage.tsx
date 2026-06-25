import React from 'react';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection from '@/popup/components/ui/SettingsSection.js';
import InfoBlock from '@/popup/components/ui/InfoBlock.js';
import { ProfileIcon, MoveHorizontalIcon } from '@/popup/components/icons/Icons.js';

/**
 * Страница «Профиль» хаба «Центр» — настройки внешнего вида страницы профиля VK.
 */
export default function ProfilePage(): React.ReactElement {
  return (
    <div className="space-y-4">
      <SettingsSection
        title="Профиль"
        description="Внешний вид страницы профиля"
        icon={<ProfileIcon className="w-5 h-5" />}
        iconColor="cyan"
      >
        <SettingRow
          id="profile_swap_columns"
          title="Поменять колонки местами"
          description="Узкая колонка слева, контент справа"
          icon={<MoveHorizontalIcon className="w-5 h-5" />}
          iconColor="cyan"
        />
      </SettingsSection>
    </div>
  );
}
