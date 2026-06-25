import React from 'react';
import ProfilePage from './profile/ProfilePage.js';
import MessagesPage from './messages/MessagesPage.js';
import PlayerPage from './player/PlayerPage.js';
import FeedPage from './feed/FeedPage.js';
import VideoPage from './video/VideoPage.js';
import ClipPage from './clip/ClipPage.js';
import PhotoPage from './photo/PhotoPage.js';
import MusicPage from './music/MusicPage.js';
import {
  MessengerIcon, MusicIcon, FeedIcon,
  VideoIcon, ClipIcon, PhotoAlbumIcon, MusicSectionIcon, ProfileIcon,
} from '../../icons/Icons.js';

/**
 * Реестр страниц хаба «Центр». Шелл (CenterTab) рендерит навигацию и активную
 * страницу отсюда — добавление будущего раздела это одна новая запись + одна
 * подпапка с компонентами страницы, без изменений самого хаба.
 *
 * `anchors` — id якорей поиска (data-vkify-anchor), живущих на странице:
 * по ним Ctrl+K открывает нужный раздел хаба (см. utils/pendingAnchor.ts).
 */
export interface CenterPage {
  /** id страницы (для состояния навигации). */
  id: string;
  /** Короткая подпись в рейле. */
  label: string;
  /** Иконка раздела. */
  icon: React.ComponentType<{ className?: string }>;
  /** Контент страницы. */
  component: React.ComponentType;
  /** Якоря поиска, расположенные на этой странице. */
  anchors: readonly string[];
}

// Порядок страниц повторяет реальное левое меню ВК (Профиль → Лента →
// Мессенджер → Фото → Музыка → Видео → Клипы). «Плеер» — не пункт меню, а
// управление аудиоплеером, поэтому стоит сразу после «Музыки».
export const CENTER_PAGES: CenterPage[] = [
  {
    id: 'profile',
    label: 'Профиль',
    icon: ProfileIcon,
    component: ProfilePage,
    anchors: ['profile_swap_columns'],
  },
  {
    id: 'feed',
    label: 'Лента',
    icon: FeedIcon,
    component: FeedPage,
    anchors: ['expand_post_text', 'story_download'],
  },
  {
    id: 'messages',
    label: 'Мессенджер',
    icon: MessengerIcon,
    component: MessagesPage,
    anchors: [
      'message_quick_copy',
      'dialog_export_enabled',
      'message_pin_notes',
      'messenger_swap_panels',
      'message_templates_enabled',
      'message_templates_trigger_slash',
      'message_templates_trigger_hotkey',
      'message_templates_trigger_autocomplete',
      'message_templates_auto_send',
    ],
  },
  {
    id: 'photo',
    label: 'Фото',
    icon: PhotoAlbumIcon,
    component: PhotoPage,
    anchors: ['photo_download'],
  },
  {
    id: 'music',
    label: 'Музыка',
    icon: MusicSectionIcon,
    component: MusicPage,
    anchors: [
      'audio_download', 'audio_download_id3', 'audio_download_lyrics',
      'audio_download_bitrate', 'audio_download_filename',
      'audio_multi_upload', 'audio_upload_delay_between', 'audio_upload_delay_save',
    ],
  },
  {
    id: 'player',
    label: 'Плеер',
    icon: MusicIcon,
    component: PlayerPage,
    anchors: ['media_player_hotkeys', 'audio_autoplay'],
  },
  {
    id: 'video',
    label: 'Видео',
    icon: VideoIcon,
    component: VideoPage,
    anchors: ['video_download'],
  },
  {
    id: 'clip',
    label: 'Клипы',
    icon: ClipIcon,
    component: ClipPage,
    anchors: ['clip_download'],
  },
];

/** Страница хаба, на которой расположен якорь (или undefined для чужих). */
export function pageForAnchor(anchor: string): CenterPage | undefined {
  return CENTER_PAGES.find(p => p.anchors.includes(anchor));
}
