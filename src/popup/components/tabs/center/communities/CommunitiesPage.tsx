import React from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection, {SectionDivider} from '@/popup/components/ui/SettingsSection.js';
import { CommunitiesIcon, MoveHorizontalIcon, ChevronRightIcon } from '@/popup/components/icons/Icons.js';

/**
 * Страница «Сообщества» хаба «Центр» — настройки внешнего вида страницы
 * сообщества VK.
 */
export default function CommunitiesPage(): React.ReactElement {
  const { t } = useTranslation('center');
  return (
    <div className="space-y-4">
      <SettingsSection
        title={t('communities.section')}
        description={t('communities.section_desc')}
        icon={<CommunitiesIcon className="w-5 h-5" />}
        iconColor="cyan"
      >
        <SettingRow
          id="communities_swap_columns"
          title={t('communities.swap_title')}
          description={t('communities.swap_desc')}
          icon={<MoveHorizontalIcon className="w-5 h-5" />}
          iconColor="cyan"
        />
        <SectionDivider />
        <SettingRow
          id="communities_my_groups_redirect"
          title={t('communities.redirect_title')}
          description={t('communities.redirect_desc')}
          icon={<ChevronRightIcon className="w-5 h-5" />}
          iconColor="cyan"
        />
      </SettingsSection>
    </div>
  );
}