import React from 'react';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection from '@/popup/components/ui/SettingsSection.js';
import { CommunitiesIcon, MoveHorizontalIcon, ChevronRightIcon } from '@/popup/components/icons/Icons.js';

/**
 * Страница «Сообщества» хаба «Центр» — настройки внешнего вида страницы
 * сообщества VK.
 */
export default function CommunitiesPage(): React.ReactElement {
  return (
    <div className="space-y-4">
      <SettingsSection
        title="Сообщества"
        description="Внешний вид страницы сообщества"
        icon={<CommunitiesIcon className="w-5 h-5" />}
        iconColor="cyan"
      >
        <SettingRow
          id="communities_swap_columns"
          title="Поменять колонки местами"
          description="Узкая колонка слева, контент справа"
          icon={<MoveHorizontalIcon className="w-5 h-5" />}
          iconColor="cyan"
        />
        <SettingRow
          id="communities_my_groups_redirect"
          title="Сразу в «Мои сообщества»"
          description="Пункт «Сообщества» в меню ведёт в «Мои группы», минуя рекомендации"
          icon={<ChevronRightIcon className="w-5 h-5" />}
          iconColor="cyan"
        />
      </SettingsSection>
    </div>
  );
}
