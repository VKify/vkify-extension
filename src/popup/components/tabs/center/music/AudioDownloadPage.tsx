import React from 'react';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection, { SectionDivider } from '@/popup/components/ui/SettingsSection.js';
import { NestedField } from '@/popup/components/ui/NestedSettings.js';
import InfoBlock from '@/popup/components/ui/InfoBlock.js';
import { useSettings } from '@/popup/context/SettingsContext.js';
import { MusicSectionIcon, InfoIcon } from '@/popup/components/icons/Icons.js';

/**
 * Подстраница «Музыка → Сохранение в MP3». Тело отдельной страницы функции
 * (см. MusicPage + SubpageHost): мастер-тумблер + зависимые группы настроек по
 * тем же правилам, что и «Шаблоны» (см. memory subpage-navigation).
 */
export default function AudioDownloadPage(): React.ReactElement {
  const { settings, saveSetting } = useSettings();
  const enabled = settings['audio_download'] === true;

  const filename = String(settings['audio_download_filename'] ?? 'artist_title');
  const exampleName =
    filename === 'title_artist' ? 'Название — Исполнитель'
    : filename === 'title'      ? 'Название трека'
    : 'Исполнитель — Название трека';

  return (
    <div className="space-y-5">
      {/* Master-тумблер */}
      <section className="rounded-2xl shadow-card overflow-hidden ring-1 ring-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <SettingRow
          id="audio_download"
          title="Сохранение в MP3"
          description="Трек или альбом — локально"
          icon={<MusicSectionIcon className="w-5 h-5" />}
          iconColor="pink"
        />
      </section>

      {/* Зависимые настройки — гаснут, пока функция выключена */}
      <div
        aria-disabled={!enabled}
        className={`space-y-5 transition-opacity duration-200 ${enabled ? '' : 'opacity-40 pointer-events-none select-none grayscale'}`}
      >
        <SettingsSection title="Метаданные">
          <SettingRow
            id="audio_download_id3"
            title="Теги и обложка"
            description="Исполнитель, название, картинка"
            checked={settings['audio_download_id3'] !== false}
            onToggle={(v) => void saveSetting('audio_download_id3', v)}
          />
          <SectionDivider />
          <SettingRow
            id="audio_download_lyrics"
            title="Текст песни"
            description="Подбирает слова по названию"
            checked={settings['audio_download_lyrics'] === true}
            onToggle={(v) => void saveSetting('audio_download_lyrics', v)}
          />
        </SettingsSection>

        <SettingsSection title="Файл">
          <NestedField title="Качество" description="Битрейт MP3">
            <select
              value={String(settings['audio_download_bitrate'] ?? '192')}
              onChange={(e) => void saveSetting('audio_download_bitrate', e.target.value)}
              className="text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-[var(--text-primary)] cursor-pointer"
            >
              <option value="128">128 кбит/с</option>
              <option value="192">192 кбит/с</option>
              <option value="320">320 кбит/с</option>
            </select>
          </NestedField>
          <SectionDivider />
          <NestedField title="Имя файла" description="Из чего складывать название" align="start">
            <select
              value={filename}
              onChange={(e) => void saveSetting('audio_download_filename', e.target.value)}
              className="text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-[var(--text-primary)] cursor-pointer max-w-[170px]"
            >
              <option value="artist_title">Исполнитель — Название</option>
              <option value="title_artist">Название — Исполнитель</option>
              <option value="title">Только название</option>
            </select>
          </NestedField>
          <div className="px-4 pb-3 pt-1">
            <div className="p-2.5 bg-[var(--bg-secondary)] rounded-lg">
              <div className="text-[10px] text-[var(--text-tertiary)] mb-1">Пример имени:</div>
              <code className="text-[11px] text-[var(--text-secondary)] break-all">{exampleName}.mp3</code>
            </div>
          </div>
        </SettingsSection>
      </div>

      <InfoBlock icon={<InfoIcon className="w-4 h-4" />} title="Как это работает" variant="tip">
        Запись собирается в MP3 прямо в браузере. Текст песни подбирается из
        открытых источников — точность не гарантируется.
      </InfoBlock>
    </div>
  );
}
