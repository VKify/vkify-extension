import React from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection, { SectionDivider } from '@/popup/components/ui/SettingsSection.js';
import { NestedField } from '@/popup/components/ui/NestedSettings.js';
import InfoBlock from '@/popup/components/ui/InfoBlock.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { UploadIcon, WarningIcon } from '@/popup/components/icons/Icons.js';

/**
 * Подстраница «Музыка → Загрузка нескольких треков». Мастер-тумблер +
 * настройки задержек (защита от Flood control) по общим правилам подстраниц.
 */
export default function AudioUploadPage(): React.ReactElement {
  const { t } = useTranslation('center');
  const settings = useVKifyStore((s) => s.settings);
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  const enabled = settings['audio_multi_upload'] === true;

  return (
    <div className="space-y-5">
      {/* Master-тумблер */}
      <section className="rounded-2xl shadow-card overflow-hidden ring-1 ring-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <SettingRow
          id="audio_multi_upload"
          title={t('music.upload_title')}
          description={t('music.upload_master_desc')}
          icon={<UploadIcon className="w-5 h-5" />}
          iconColor="orange"
        />
      </section>

      {/* Зависимые настройки — гаснут, пока функция выключена */}
      <div
        aria-disabled={!enabled}
        className={`space-y-5 transition-opacity duration-200 ${enabled ? '' : 'opacity-40 pointer-events-none select-none grayscale'}`}
      >
        <SettingsSection title={t('music.upload_protect')}>
          <NestedField title={t('music.upload_between')} description={t('music.upload_between_desc')}>
            <DelayInput
              valueMs={Number(settings['audio_upload_delay_between'] ?? 2000)}
              minMs={2000}
              onChange={(ms) => void saveSetting('audio_upload_delay_between', ms)}
            />
          </NestedField>
          <SectionDivider />
          <NestedField title={t('music.upload_before')} description={t('music.upload_before_desc')}>
            <DelayInput
              valueMs={Number(settings['audio_upload_delay_save'] ?? 500)}
              minMs={500}
              onChange={(ms) => void saveSetting('audio_upload_delay_save', ms)}
            />
          </NestedField>
        </SettingsSection>
      </div>

      <InfoBlock icon={<WarningIcon className="w-4 h-4" />} title={t('music.upload_warn_title')} variant="warning">
        {t('music.upload_warn_body')}
      </InfoBlock>
    </div>
  );
}

interface DelayInputProps {
  valueMs: number;
  minMs: number;
  onChange: (ms: number) => void;
}

/** Поле задержки в секундах (хранится в мс), с нижней границей. */
function DelayInput({ valueMs, minMs, onChange }: DelayInputProps): React.ReactElement {
  const { t } = useTranslation('center');
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={minMs / 1000}
        max="30"
        step="0.5"
        value={(valueMs / 1000).toFixed(1)}
        onChange={(e) => onChange(Math.max(minMs, Math.round(parseFloat(e.target.value) * 1000)))}
        className="w-16 text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-2 py-1.5 text-[var(--text-primary)] text-center"
      />
      <span className="text-xs text-[var(--text-tertiary)]">{t('sec')}</span>
    </div>
  );
}
