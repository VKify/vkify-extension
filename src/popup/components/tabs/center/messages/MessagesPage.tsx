import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection from '@/popup/components/ui/SettingsSection.js';
import SubpageHost, { type Subpage } from '@/popup/components/ui/SubpageHost.js';
import NavRow from '@/popup/components/ui/NavRow.js';
import TemplatesBlock from './TemplatesBlock.js';
import MessagesStatsPage from './MessagesStatsPage.js';
import DialogFilesPage from './DialogFilesPage.js';
import { requestNavigate } from '@/popup/utils/pendingAnchor.js';
import { isValidTelegramBotToken, isValidTelegramChatId } from '@/shared/telegram-notifications/types.js';
import { useSetting } from '@/popup/store/selectors.js';
import {
  MessengerIcon, StatisticsIcon, CopyIcon, DownloadIcon, BookmarkIcon, SidebarIcon, MoveHorizontalIcon, FileTextIcon, GlobeIcon, TelegramIcon, SettingsIcon, ChevronRightIcon,
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
  const telegramEnabled = useSetting<boolean>('telegram_notifications_enabled');
  const botToken = useSetting<string>('telegram_bot_token');
  const chatId = useSetting<string>('telegram_chat_id');
  const botActive = telegramEnabled === true && isValidTelegramBotToken(botToken ?? '') && isValidTelegramChatId(chatId ?? '');

  const subpages: Subpage[] = [
    {
      id: 'dialog-files', title: t('files.title'), subtitle: t('files.description'),
      icon: <FileTextIcon className="w-5 h-5" />,
      anchors: ['dialog-files'], render: () => <DialogFilesPage />,
    },
    {
      id: 'messages-stats',
      title: t('stats.title'),
      subtitle: t('stats.description'),
      icon: <StatisticsIcon className="w-5 h-5" />,
      anchors: ['messages-stats'],
      render: () => <MessagesStatsPage />,
    },
    {
      id: 'templates',
      title: t('messages.templates_title'),
      subtitle: t('messages.templates_subtitle'),
      icon: <FileTextIcon className="w-5 h-5" />,
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
        <SettingsSection title={t('tools.api_title')} description={t('tools.messages_api_desc')}
          icon={<GlobeIcon className="w-5 h-5" />} className="ct-api-section">
          <NavRow subpage="dialog-files" title={t('files.title')} description={t('files.description')}
            icon={<FileTextIcon className="w-5 h-5" />} />
          <NavRow subpage="messages-stats" title={t('stats.title')} description={t('stats.description')}
            icon={<StatisticsIcon className="w-5 h-5" />} />
          <SettingRow id="telegram_messages_enabled" title={t('messages.telegram_title')} description={<>
            {t('messages.telegram_description')}
            {!botActive && <span className="block mt-1.5"><a href="#telegram_notifications_enabled" className="inline-flex items-center gap-1 text-xs text-primary hover:underline" onClick={event => {
              event.preventDefault(); event.stopPropagation(); requestNavigate('more', 'telegram_notifications_enabled');
            }}><SettingsIcon className="h-3.5 w-3.5" />{t('messages.telegram_settings')}<ChevronRightIcon className="h-3.5 w-3.5" /></a></span>}
          </>} icon={<TelegramIcon className="w-5 h-5" />} />
          <SettingRow id="dialog_export_enabled" title={t('messages.export_title')} description={t('messages.export_desc')}
            icon={<DownloadIcon className="w-5 h-5" />} />
          <SettingRow id="voice_download" title={t('messages.voice_download_title')} description={t('messages.voice_download_desc')}
            icon={<DownloadIcon className="w-5 h-5" />} />
          <NavRow subpage="templates" docsId="message_templates_enabled" title={t('messages.templates_title')}
            description={t('messages.templates_nav_desc')} icon={<FileTextIcon className="w-5 h-5" />}
            meta={templatesCount > 0 ? t('messages.templates_count', { count: templatesCount }) : undefined} />
        </SettingsSection>
        <SettingsSection
          title={t('messages.tools_section')}
          description={t('messages.tools_desc')}
          icon={<MessengerIcon className="w-5 h-5" />}
        >
          <SettingRow
            id="message_quick_copy"
            title={t('messages.quick_copy_title')}
            description={t('messages.quick_copy_desc')}
            icon={<CopyIcon className="w-5 h-5" />}
          />
          <SettingRow
            id="message_pin_notes"
            title={t('messages.notes_title')}
            description={t('messages.notes_desc')}
            icon={<BookmarkIcon className="w-5 h-5" />}
          />
        </SettingsSection>

        <SettingsSection
          title={t('messages.layout_section')}
          description={t('messages.layout_desc')}
          icon={<SidebarIcon className="w-5 h-5" />}
        >
          <SettingRow
            id="messenger_swap_panels"
            title={t('messages.swap_title')}
            description={t('messages.swap_desc')}
            icon={<MoveHorizontalIcon className="w-5 h-5" />}
          />
        </SettingsSection>

      </div>
    </SubpageHost>
  );
}
