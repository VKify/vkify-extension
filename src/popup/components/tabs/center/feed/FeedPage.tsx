import React from 'react';
import SettingRow from '../../../ui/SettingRow.js';
import InfoBlock from '../../../ui/InfoBlock.js';
import { FeedIcon, FileTextIcon } from '../../../icons/Icons.js';

/**
 * Страница «Лента» хаба «Центр» — поведение постов в новостной ленте.
 */
export default function FeedPage(): React.ReactElement {
  return (
    <div className="space-y-4">

      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center flex-shrink-0">
            <FeedIcon className="w-5 h-5 text-orange-500" />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Лента</h3>
        </div>

        <SettingRow
          id="expand_post_text"
          title="Разворачивать текст постов"
          description="Показывает текст целиком, убирая «показать ещё» и обрезание"
          icon={<FileTextIcon className="w-5 h-5" />}
          iconColor="orange"
        />
      </section>

      <InfoBlock variant="tip" icon="📖" title="Подсказка">
        Длинные посты будут отображаться полностью, без кнопки «Показать ещё».
      </InfoBlock>

    </div>
  );
}
