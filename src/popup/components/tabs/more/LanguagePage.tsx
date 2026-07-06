import React from 'react';
import { useTranslation } from 'react-i18next';
import SettingsSection, { SectionDivider } from '@/popup/components/ui/SettingsSection.js';
import InfoBlock from '@/popup/components/ui/InfoBlock.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { CheckIcon, InfoIcon } from '@/popup/components/icons/Icons.js';
import {
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
  detectBrowserLanguage,
} from '@/locales/index.js';

/**
 * Подстраница «Язык» (вкладка «Ещё»). Выбор языка интерфейса: нативное название
 * + локализованное на текущем языке UI. Запись идёт в настройку `language`
 * (переживает reload, синхронится между контекстами), i18next переключается
 * реактивно через мост в App.tsx.
 *
 * Если язык ещё не выбран (свежая установка) — подсвечиваем язык, определённый
 * по браузеру, чтобы отметка соответствовала реально показанному UI.
 */
export default function LanguagePage(): React.ReactElement {
  const { t } = useTranslation('settings');
  const saved = useVKifyStore((s) => s.settings.language);
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  const current = isSupportedLanguage(saved) ? saved : detectBrowserLanguage();

  return (
    <div className="space-y-5">
      <SettingsSection title={t('language.section')}>
        {SUPPORTED_LANGUAGES.map((lang, i) => {
          const active = current === lang.code;
          return (
            <React.Fragment key={lang.code}>
              {i > 0 && <SectionDivider />}
              <button
                type="button"
                aria-pressed={active}
                onClick={() => void saveSetting('language', lang.code)}
                className="group w-full flex items-center justify-between px-4 py-3 text-left transition-colors duration-150 hover:bg-[var(--bg-secondary)]/50"
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {lang.nativeName}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {t(`language.options.${lang.code}`)}
                  </span>
                </div>
                {active && <CheckIcon className="w-5 h-5 text-primary flex-shrink-0 ml-3" />}
              </button>
            </React.Fragment>
          );
        })}
      </SettingsSection>

      <InfoBlock icon={<InfoIcon className="w-4 h-4" />} title={t('language.page_title')} variant="tip">
        {t('language.hint')}
      </InfoBlock>
    </div>
  );
}
