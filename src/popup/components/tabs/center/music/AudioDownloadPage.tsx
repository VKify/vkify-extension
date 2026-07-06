import React from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection, { SectionDivider } from '@/popup/components/ui/SettingsSection.js';
import { NestedField } from '@/popup/components/ui/NestedSettings.js';
import InfoBlock from '@/popup/components/ui/InfoBlock.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { MusicSectionIcon, InfoIcon } from '@/popup/components/icons/Icons.js';

/**
 * Подстраница «Музыка → Сохранение в MP3». Тело отдельной страницы функции
 * (см. MusicPage + SubpageHost): мастер-тумблер + зависимые группы настроек по
 * тем же правилам, что и «Шаблоны» (см. memory subpage-navigation).
 */
export default function AudioDownloadPage(): React.ReactElement {
  const { t } = useTranslation('music');
  const settings = useVKifyStore((s) => s.settings);
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  const enabled = settings['audio_download'] === true;

  const format = settings['audio_download_format'] === 'original' ? 'original' : 'mp3';
  const isOriginal = format === 'original';

  const filename = String(settings['audio_download_filename'] ?? 'artist_title');
  const exampleName =
    filename === 'title_artist' ? t('download.example.title_artist')
    : filename === 'title'      ? t('download.example.title')
    : t('download.example.artist_title');
  const exampleExt = isOriginal ? 'm4a' : 'mp3';

  // «Оригинальный» — AAC без перекодирования: битрейт и ID3-теги не применяются.
  const inactiveCls = 'opacity-40 pointer-events-none select-none';

  return (
    <div className="space-y-5">
      {/* Master-тумблер */}
      <section className="rounded-2xl shadow-card overflow-hidden ring-1 ring-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <SettingRow
          id="audio_download"
          title={t('download.title')}
          description={t('download.subtitle')}
          icon={<MusicSectionIcon className="w-5 h-5" />}
          iconColor="pink"
        />
      </section>

      {/* Зависимые настройки — гаснут, пока функция выключена */}
      <div
        aria-disabled={!enabled}
        className={`space-y-5 transition-opacity duration-200 ${enabled ? '' : 'opacity-40 pointer-events-none select-none grayscale'}`}
      >
        <div className={isOriginal ? inactiveCls : ''} aria-disabled={isOriginal}>
          <SettingsSection title={t('download.metadata.section')}>
            <SettingRow
              id="audio_download_id3"
              title={t('download.metadata.id3_title')}
              description={isOriginal ? t('download.metadata.mp3_only') : t('download.metadata.id3_desc')}
              checked={settings['audio_download_id3'] !== false}
              onToggle={(v) => void saveSetting('audio_download_id3', v)}
            />
            <SectionDivider />
            <SettingRow
              id="audio_download_lyrics"
              title={t('download.metadata.lyrics_title')}
              description={isOriginal ? t('download.metadata.mp3_only') : t('download.metadata.lyrics_desc')}
              checked={settings['audio_download_lyrics'] === true}
              onToggle={(v) => void saveSetting('audio_download_lyrics', v)}
            />
          </SettingsSection>
        </div>

        <SettingsSection title={t('download.file.section')}>
          <NestedField
            title={t('download.file.format_label')}
            description={t('download.file.format_desc')}
            align="start"
          >
            <select
              value={format}
              onChange={(e) => void saveSetting('audio_download_format', e.target.value)}
              className="text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-[var(--text-primary)] cursor-pointer"
            >
              <option value="mp3">{t('download.file.format_mp3')}</option>
              <option value="original">{t('download.file.format_original')}</option>
            </select>
          </NestedField>
          <SectionDivider />
          <div className={isOriginal ? inactiveCls : ''} aria-disabled={isOriginal}>
            <NestedField title={t('download.file.quality_label')} description={t('download.file.quality_desc')}>
              <select
                value={String(settings['audio_download_bitrate'] ?? '192')}
                onChange={(e) => void saveSetting('audio_download_bitrate', e.target.value)}
                className="text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-[var(--text-primary)] cursor-pointer"
              >
                <option value="128">{t('download.file.bitrate', { value: 128 })}</option>
                <option value="192">{t('download.file.bitrate', { value: 192 })}</option>
                <option value="320">{t('download.file.bitrate', { value: 320 })}</option>
              </select>
            </NestedField>
          </div>
          <SectionDivider />
          <NestedField title={t('download.file.name_label')} description={t('download.file.name_desc')} align="start">
            <select
              value={filename}
              onChange={(e) => void saveSetting('audio_download_filename', e.target.value)}
              className="text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-[var(--text-primary)] cursor-pointer max-w-[170px]"
            >
              <option value="artist_title">{t('download.file.name_artist_title')}</option>
              <option value="title_artist">{t('download.file.name_title_artist')}</option>
              <option value="title">{t('download.file.name_title_only')}</option>
            </select>
          </NestedField>
          <div className="px-4 pb-3 pt-1">
            <div className="p-2.5 bg-[var(--bg-secondary)] rounded-lg">
              <div className="text-[10px] text-[var(--text-tertiary)] mb-1">{t('download.file.example_label')}</div>
              <code className="text-[11px] text-[var(--text-secondary)] break-all">{exampleName}.{exampleExt}</code>
            </div>
          </div>
        </SettingsSection>
      </div>

      <InfoBlock icon={<InfoIcon className="w-4 h-4" />} title={t('download.info.title')} variant="tip">
        {isOriginal ? t('download.info.original') : t('download.info.mp3')}
      </InfoBlock>
    </div>
  );
}
