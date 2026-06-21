import React, { useMemo } from 'react';
import SettingRow from '../../../ui/SettingRow.js';
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
        <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
          <div className="flex items-center gap-3 px-4 pt-4 pb-2">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
              <MessengerIcon className="w-5 h-5 text-cyan-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Инструменты</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Копирование, экспорт и сохранение сообщений
              </p>
            </div>
          </div>

          <SettingRow
            id="message_quick_copy"
            title="Быстрое копирование"
            description="Кнопка «копировать» в каждом сообщении ВК — всегда видна, не нужно наводить мышь"
            icon={<CopyIcon className="w-5 h-5" />}
            iconColor="blue"
          />

          <div className="mx-3 border-t border-[var(--border-color)]" />

          <SettingRow
            id="dialog_export_enabled"
            title="Экспорт диалога"
            description="Кнопка в шапке чата: скачать всю переписку в JSON, TXT, HTML или ZIP-архив с фото"
            icon={<DownloadIcon className="w-5 h-5" />}
            iconColor="cyan"
          />

          <div className="mx-3 border-t border-[var(--border-color)]" />

          <SettingRow
            id="message_pin_notes"
            title="Заметки из сообщений"
            description="Кнопка-закладка у каждого сообщения сохраняет его в архив — во вкладку «Заметки»"
            icon={<BookmarkIcon className="w-5 h-5" />}
            iconColor="orange"
          />
        </section>

        <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
          <div className="flex items-center gap-3 px-4 pt-4 pb-2">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
              <SidebarIcon className="w-5 h-5 text-cyan-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Раскладка</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Внешний вид панелей мессенджера
              </p>
            </div>
          </div>

          <SettingRow
            id="messenger_swap_panels"
            title="Поменять панели местами"
            description="Список бесед — справа, активный диалог — слева (зеркальная раскладка)"
            icon={<MoveHorizontalIcon className="w-5 h-5" />}
            iconColor="cyan"
          />
        </section>

        {/* Шаблоны — функция с большим числом опций: открывается отдельной страницей */}
        <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
          <NavRow
            subpage="templates"
            title="Шаблоны сообщений"
            description="Способы открытия, горячая клавиша, поведение и список шаблонов"
            icon={<FileTextIcon className="w-5 h-5" />}
            iconColor="purple"
            meta={templatesCount > 0 ? `${templatesCount} шт.` : undefined}
          />
        </section>
      </div>
    </SubpageHost>
  );
}
