import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection, { SectionDivider } from '@/popup/components/ui/SettingsSection.js';
import SubpageHost, { type Subpage } from '@/popup/components/ui/SubpageHost.js';
import NavRow from '@/popup/components/ui/NavRow.js';
import TemplatesBlock from './TemplatesBlock.js';
import { useSetting } from '@/popup/store/selectors.js';
import {
  MessengerIcon, CopyIcon, DownloadIcon, BookmarkIcon, SidebarIcon, MoveHorizontalIcon, FileTextIcon,
} from '@/popup/components/icons/Icons.js';
import type { MessageTemplate } from '@/types/index.js';

/**
 * Страница «Мессенджер» хаба «Центр». Объединяет всё, что связано с перепиской:
 *  • блок «Инструменты» — копирование, экспорт, заметки;
 *  • блок «Раскладка»   — внешний вид панелей мессенджера;
 *  • переход «Шаблоны»  — у функции много опций, поэтому она открывается на
 *    собственной странице (SubpageHost → DetailPage), а не списком прямо здесь.
 *
 * Архив сохранённых сообщений — отдельная вкладка «Заметки» попапа.
 *
 * Будущие «тяжёлые» функции (автоответы, расписание отправки) добавляются как
 * новые записи в `SUBPAGES` + ряд `NavRow` — без разрастания этой страницы.
 */

export default function MessagesPage(): React.ReactElement {
  const { t } = useTranslation('center');
  const templates = useSetting<MessageTemplate[] | undefined>('message_templates');
  const templatesCount = useMemo(() => (templates ?? []).length, [templates]);

  const subpages: Subpage[] = [
    {
      id: 'templates',
      title: t('messages.templates_title'),
      subtitle: t('messages.templates_subtitle'),
      icon: <FileTextIcon className="w-5 h-5" />,
      iconColor: 'purple',
      anchors: [
        'message_templates_enabled',
        'message_templates_trigger_slash',
        'message_templates_trigger_hotkey',
        'message_templates_trigger_autocomplete',
        'message_templates_auto_send',
      ],
      render: () => <TemplatesBlock />,
    },
  ];

  return (
    <SubpageHost subpages={subpages}>
      <div className="space-y-4">
        <SettingsSection
          title={t('messages.tools_section')}
          description={t('messages.tools_desc')}
          icon={<MessengerIcon className="w-5 h-5" />}
          iconColor="cyan"
        >
          <SettingRow
            id="message_quick_copy"
            title={t('messages.quick_copy_title')}
            description={t('messages.quick_copy_desc')}
            icon={<CopyIcon className="w-5 h-5" />}
            iconColor="blue"
          />
          <SectionDivider />
          <SettingRow
            id="dialog_export_enabled"
            title={t('messages.export_title')}
            description={t('messages.export_desc')}
            icon={<DownloadIcon className="w-5 h-5" />}
            iconColor="cyan"
          />
          <SectionDivider />
          <SettingRow
            id="message_pin_notes"
            title={t('messages.notes_title')}
            description={t('messages.notes_desc')}
            icon={<BookmarkIcon className="w-5 h-5" />}
            iconColor="orange"
          />
        </SettingsSection>

        <SettingsSection
          title={t('messages.layout_section')}
          description={t('messages.layout_desc')}
          icon={<SidebarIcon className="w-5 h-5" />}
          iconColor="cyan"
        >
          <SettingRow
            id="messenger_swap_panels"
            title={t('messages.swap_title')}
            description={t('messages.swap_desc')}
            icon={<MoveHorizontalIcon className="w-5 h-5" />}
            iconColor="cyan"
          />
        </SettingsSection>

        {/* Шаблоны — функция с большим числом опций: открывается отдельной страницей */}
        <SettingsSection>
          <NavRow
            subpage="templates"
            title={t('messages.templates_title')}
            description={t('messages.templates_nav_desc')}
            icon={<FileTextIcon className="w-5 h-5" />}
            iconColor="purple"
            meta={templatesCount > 0 ? t('messages.templates_count', { count: templatesCount }) : undefined}
          />
        </SettingsSection>
      </div>
    </SubpageHost>
  );
}
