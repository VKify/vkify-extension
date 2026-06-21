import React, { useMemo } from 'react';
import SettingRow from '../../../ui/SettingRow.js';
import SettingsSection, { SectionDivider } from '../../../ui/SettingsSection.js';
import SubpageHost, { type Subpage } from '../../../ui/SubpageHost.js';
import NavRow from '../../../ui/NavRow.js';
import TemplatesBlock from './TemplatesBlock.js';
import { useSettings } from '../../../../context/SettingsContext.js';
import {
  MessengerIcon, CopyIcon, DownloadIcon, BookmarkIcon, SidebarIcon, MoveHorizontalIcon, FileTextIcon,
} from '../../../icons/Icons.js';
import type { MessageTemplate } from '../../../../../types/index.js';

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

const SUBPAGES: Subpage[] = [
  {
    id: 'templates',
    title: 'Шаблоны сообщений',
    subtitle: 'Быстрая вставка в ВК-чат по горячей клавише или слэшу',
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

export default function MessagesPage(): React.ReactElement {
  const { settings } = useSettings();
  const templatesCount = useMemo(
    () => ((settings['message_templates'] as MessageTemplate[] | undefined) ?? []).length,
    [settings],
  );

  return (
    <SubpageHost subpages={SUBPAGES}>
      <div className="space-y-4">
        <SettingsSection
          title="Инструменты"
          description="Копирование, экспорт, заметки"
          icon={<MessengerIcon className="w-5 h-5" />}
          iconColor="cyan"
        >
          <SettingRow
            id="message_quick_copy"
            title="Быстрое копирование"
            description="Кнопка «копировать» в каждом сообщении"
            icon={<CopyIcon className="w-5 h-5" />}
            iconColor="blue"
          />
          <SectionDivider />
          <SettingRow
            id="dialog_export_enabled"
            title="Экспорт диалога"
            description="Скачать переписку: JSON, TXT, HTML, ZIP"
            icon={<DownloadIcon className="w-5 h-5" />}
            iconColor="cyan"
          />
          <SectionDivider />
          <SettingRow
            id="message_pin_notes"
            title="Заметки из сообщений"
            description="Сохранять сообщения во вкладку «Заметки»"
            icon={<BookmarkIcon className="w-5 h-5" />}
            iconColor="orange"
          />
        </SettingsSection>

        <SettingsSection
          title="Раскладка"
          description="Внешний вид панелей мессенджера"
          icon={<SidebarIcon className="w-5 h-5" />}
          iconColor="cyan"
        >
          <SettingRow
            id="messenger_swap_panels"
            title="Поменять панели местами"
            description="Беседы справа, диалог слева"
            icon={<MoveHorizontalIcon className="w-5 h-5" />}
            iconColor="cyan"
          />
        </SettingsSection>

        {/* Шаблоны — функция с большим числом опций: открывается отдельной страницей */}
        <SettingsSection>
          <NavRow
            subpage="templates"
            title="Шаблоны сообщений"
            description="Триггеры, горячая клавиша, список"
            icon={<FileTextIcon className="w-5 h-5" />}
            iconColor="purple"
            meta={templatesCount > 0 ? `${templatesCount} шт.` : undefined}
          />
        </SettingsSection>
      </div>
    </SubpageHost>
  );
}
