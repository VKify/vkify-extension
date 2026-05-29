import React from 'react';
import SettingRow from '../../ui/SettingRow.js';
import TemplatesBlock from './TemplatesBlock.js';
import NotesBlock from './NotesBlock.js';
import { MessageIcon, CopyIcon, DownloadIcon, BookmarkIcon } from '../../icons/Icons.js';

/**
 * Страница «Сообщения» хаба «Центр». Объединяет всё, что связано с перепиской:
 *  • блок «Инструменты» — настройки (перенесены из вкладки «Скрипты»);
 *  • блок «Шаблоны»     — шаблоны сообщений (бывшая вкладка «Шаблоны»);
 *  • блок «Заметки»     — архив сохранённых сообщений (бывшая вкладка «Заметки»).
 *
 * Будущие блоки (в разработке, здесь НЕ реализованы): автоответы, расписание
 * отправки — добавляются новыми секциями на этой же странице.
 */
export default function MessagesPage(): React.ReactElement {
  return (
    <div className="space-y-4">
      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
            <MessageIcon className="w-5 h-5 text-cyan-500" />
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

        <div className="mx-3 border-t border-[var(--border-color)] opacity-50" />

        <SettingRow
          id="dialog_export_enabled"
          title="Экспорт диалога"
          description="Кнопка в шапке чата: скачать всю переписку в JSON, TXT, HTML или ZIP-архив с фото"
          icon={<DownloadIcon className="w-5 h-5" />}
          iconColor="cyan"
        />

        <div className="mx-3 border-t border-[var(--border-color)] opacity-50" />

        <SettingRow
          id="message_pin_notes"
          title="Заметки из сообщений"
          description="Кнопка-закладка у каждого сообщения сохраняет его в архив — в блок «Заметки» ниже"
          icon={<BookmarkIcon className="w-5 h-5" />}
          iconColor="orange"
        />
      </section>

      <TemplatesBlock />

      <NotesBlock />
    </div>
  );
}
