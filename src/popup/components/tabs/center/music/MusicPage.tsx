import React from 'react';
import SettingRow from '../../../ui/SettingRow.js';
import NestedSettings, { NestedField } from '../../../ui/NestedSettings.js';
import { useSettings } from '../../../../context/SettingsContext.js';
import {
  MusicSectionIcon, ImageIcon, FileTextIcon, UploadIcon,
} from '../../../icons/Icons.js';

/**
 * Страница «Музыка» хаба «Центр» — сохранение треков в MP3 и загрузка
 * нескольких треков сразу (перенесены из вкладки «Медиа»).
 */
export default function MusicPage(): React.ReactElement {
  const { settings, saveSetting } = useSettings();

  return (
    <div className="space-y-4">

      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center flex-shrink-0">
            <MusicSectionIcon className="w-5 h-5 text-pink-500" />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Музыка</h3>
        </div>

        <SettingRow
          id="audio_download"
          title="Сохранение треков в MP3"
          description="Кнопка сохранения у каждого трека и целого альбома — запись собирается в MP3 локально"
          icon={<MusicSectionIcon className="w-5 h-5" />}
          iconColor="pink"
        />

        {settings['audio_download'] === true && (
          <NestedSettings accent="pink" label="Настройки сохранения">

            <SettingRow
              id="audio_download_id3"
              title="Теги и обложка"
              description="Записывать в файл исполнителя, название и картинку альбома"
              icon={<ImageIcon className="w-5 h-5" />}
              iconColor="cyan"
              checked={settings['audio_download_id3'] !== false}
              onToggle={(v) => void saveSetting('audio_download_id3', v)}
            />

            <SettingRow
              id="audio_download_lyrics"
              title="Текст песни"
              description="Подбирать слова трека по названию и сохранять их в файл (из открытых источников, точность не гарантируется)"
              icon={<FileTextIcon className="w-5 h-5" />}
              iconColor="purple"
              checked={settings['audio_download_lyrics'] === true}
              onToggle={(v) => void saveSetting('audio_download_lyrics', v)}
            />

            {/* Параметры файла */}
            <div className="border-t border-[var(--border-color)] py-1.5">
              <NestedField title="Качество звука" description="Битрейт итогового MP3-файла">
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

              <NestedField title="Шаблон имени файла" description="Из чего складывать название файла" align="start">
                <select
                  value={String(settings['audio_download_filename'] ?? 'artist_title')}
                  onChange={(e) => void saveSetting('audio_download_filename', e.target.value)}
                  className="text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-[var(--text-primary)] cursor-pointer max-w-[170px]"
                >
                  <option value="artist_title">Исполнитель — Название</option>
                  <option value="title_artist">Название — Исполнитель</option>
                  <option value="title">Только название</option>
                </select>
              </NestedField>

              <div className="px-4 pt-1.5 pb-1">
                <div className="p-2.5 bg-[var(--bg-primary)] rounded-lg">
                  <div className="text-[10px] text-[var(--text-tertiary)] mb-1">Пример имени:</div>
                  <code className="text-[11px] text-[var(--text-secondary)] break-all">
                    {settings['audio_download_filename'] === 'title_artist'
                      ? 'Название — Исполнитель'
                      : settings['audio_download_filename'] === 'title'
                        ? 'Название трека'
                        : 'Исполнитель — Название трека'
                    }.mp3
                  </code>
                </div>
              </div>
            </div>
          </NestedSettings>
        )}

        <div className="mx-3 border-t border-[var(--border-color)] opacity-50" />

        <SettingRow
          id="audio_multi_upload"
          title="Загрузка нескольких треков"
          description="Кнопка рядом со стандартной загрузкой на vk.com/audios — выбор сразу нескольких файлов"
          icon={<UploadIcon className="w-5 h-5" />}
          iconColor="orange"
        />

        {settings['audio_multi_upload'] === true && (
          <NestedSettings accent="orange" label="Защита от блокировок">
            <div className="py-1.5">

              <NestedField title="Задержка между файлами" description="Минимум 2 сек — защита от Flood control">
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="2"
                    max="30"
                    step="0.5"
                    value={(Number(settings['audio_upload_delay_between'] ?? 2000) / 1000).toFixed(1)}
                    onChange={(e) => {
                      const ms = Math.max(2000, Math.round(parseFloat(e.target.value) * 1000));
                      void saveSetting('audio_upload_delay_between', ms);
                    }}
                    className="w-16 text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-2 py-1.5 text-[var(--text-primary)] text-center"
                  />
                  <span className="text-xs text-[var(--text-tertiary)]">сек</span>
                </div>
              </NestedField>

              <NestedField title="Задержка перед сохранением" description="Минимум 0.5 сек — защита от Too many requests">
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0.5"
                    max="10"
                    step="0.5"
                    value={(Number(settings['audio_upload_delay_save'] ?? 500) / 1000).toFixed(1)}
                    onChange={(e) => {
                      const ms = Math.max(500, Math.round(parseFloat(e.target.value) * 1000));
                      void saveSetting('audio_upload_delay_save', ms);
                    }}
                    className="w-16 text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-2 py-1.5 text-[var(--text-primary)] text-center"
                  />
                  <span className="text-xs text-[var(--text-tertiary)]">сек</span>
                </div>
              </NestedField>

            </div>
            <div className="mx-4 mb-3 p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl">
              <p className="text-[11px] text-orange-400 leading-relaxed">
                <span className="font-semibold">Экспериментально.</span>{' '}
                Не рекомендуется загружать более 10 треков за один раз — VK может вернуть ошибку Flood control и временно заблокировать загрузку.
              </p>
            </div>
          </NestedSettings>
        )}
      </section>

    </div>
  );
}
