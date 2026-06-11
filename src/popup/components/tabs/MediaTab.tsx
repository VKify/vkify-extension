import React from 'react';
import SettingRow from '../ui/SettingRow.js';
import { useSettings } from '../../context/SettingsContext.js';
import {
  MusicSectionIcon, DownloadIcon, ImageIcon, FileTextIcon,
  VideoIcon, StoryIcon, ClipIcon, PhotoAlbumIcon,
} from '../icons/Icons.js';

export default function MediaTab(): React.ReactElement {
  const { settings, saveSetting } = useSettings();

  return (
    <div className="space-y-4">

      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <DownloadIcon className="w-5 h-5 text-blue-500" />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Скачивание медиа</h3>
        </div>

        <SettingRow
          id="video_download"
          title="Кнопка скачивания на vkvideo.ru"
          description="Добавляет кнопку «Скачать» на страницу видео с выбором качества"
          icon={<VideoIcon className="w-5 h-5" />}
          iconColor="blue"
        />

        <SettingRow
          id="story_download"
          title="Кнопка скачивания сторис"
          description="Добавляет кнопку «Скачать» при просмотре сторис на vk.com"
          icon={<StoryIcon className="w-5 h-5" />}
          iconColor="blue"
        />

        <SettingRow
          id="clip_download"
          title="Кнопка скачивания клипов"
          description="Кнопка в правой панели управления клипа — рядом с лайком (vk.com и vkvideo.ru)"
          icon={<ClipIcon className="w-5 h-5" />}
          iconColor="blue"
        />

        <SettingRow
          id="photo_download"
          title="Скачивание фото и альбомов"
          description="«Скачать» при просмотре фото и «Скачать альбом» (ZIP-архив) в заголовке альбома"
          icon={<PhotoAlbumIcon className="w-5 h-5" />}
          iconColor="blue"
        />

        <SettingRow
          id="audio_download"
          title="Сохранение треков в MP3"
          description="Кнопка сохранения у каждого трека и целого альбома — запись собирается в MP3 локально"
          icon={<MusicSectionIcon className="w-5 h-5" />}
          iconColor="blue"
        />

        {settings['audio_download'] === true && (
          <div className="border-t border-[var(--border-color)]">

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
            <div className="px-4 py-3 space-y-3 border-t border-[var(--border-color)]">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[var(--text-primary)]">Качество звука</div>
                  <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">Битрейт итогового MP3-файла</div>
                </div>
                <select
                  value={String(settings['audio_download_bitrate'] ?? '192')}
                  onChange={(e) => void saveSetting('audio_download_bitrate', e.target.value)}
                  className="text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-[var(--text-primary)] cursor-pointer flex-shrink-0"
                >
                  <option value="128">128 кбит/с</option>
                  <option value="192">192 кбит/с</option>
                  <option value="320">320 кбит/с</option>
                </select>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[var(--text-primary)]">Шаблон имени файла</div>
                  <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">Из чего складывать название файла</div>
                </div>
                <select
                  value={String(settings['audio_download_filename'] ?? 'artist_title')}
                  onChange={(e) => void saveSetting('audio_download_filename', e.target.value)}
                  className="text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-[var(--text-primary)] cursor-pointer flex-shrink-0 max-w-[52%]"
                >
                  <option value="artist_title">Исполнитель — Название</option>
                  <option value="title_artist">Название — Исполнитель</option>
                  <option value="title">Только название</option>
                </select>
              </div>

              <div className="p-2.5 bg-[var(--bg-secondary)] rounded-lg">
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
        )}

        <div className="mx-4 mb-4 mt-1 p-3 bg-[var(--bg-secondary)] rounded-xl">
          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            Видео — только загруженные напрямую на ВКонтакте (не YouTube-вставки и не трансляции).
            Сторис — фото сохраняются как JPEG, видео-сторис — с выбором качества.
            Клипы — кнопка в панели управления, выбор качества 1080p–240p.
            Фото — оригинал максимального разрешения; альбом — ZIP-архив со всеми фото
            (большие альбомы разбиваются на части по&nbsp;500).
            Музыка — отдельный трек или весь альбом (ZIP) собираются в MP3 прямо в
            браузере, по желанию с тегами, обложкой и текстом песни.
          </p>
        </div>
      </section>

    </div>
  );
}
