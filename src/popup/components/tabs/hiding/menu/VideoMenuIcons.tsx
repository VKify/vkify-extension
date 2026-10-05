import React from 'react';
import { Icon28HomeOutline, Icon28FlashOutline, Icon28LogoClipsOutline, Icon28HistoryBackwardOutline, Icon28ClockOutline, Icon28LikeOutline, Icon28ListAddOutline, Icon28ListCheckOutline, Icon28UserCircleFillBlue, Icon28UsersOutline, Icon28MovieReelOutline, Icon28MusicOutline, Icon28TvOutline, Icon28BasketballBallOutline, Icon28PlayCards2Outline, Icon28LiveOutline, Icon28GameOutline, Icon28ChevronDownOutline, Icon24TvOutline, Icon20InfoCircleOutline, Icon16Dropdown } from '@vkontakte/icons';
import kidsIcon from '@/popup/assets/video-kids.png';

// Native drawings from the supplied VK Video menu; these three are newer than the installed icon package.
function Icon28LiveBadgeVkVideoOutline(): React.ReactElement { return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 28 28" fill="currentColor"><path d="M5.4 18.35h4.22v-1.406H6.86V9.65H5.4zm4.76 0h1.46v-8.7h-1.46zm3.771 0h2.094l1.94-8.7h-1.49L15 16.607h-.017L13.578 9.65h-1.501zm4.419 0h4.35v-1.406h-2.89V14.65h2.484v-1.382H19.81v-2.211h2.808V9.65H18.35zM9.927 5h8.146c1.824 0 3.293 0 4.45.155 1.2.162 2.21.507 3.012 1.31.803.802 1.148 1.813 1.31 3.013.155 1.156.155 2.625.155 4.449v.146c0 1.824 0 3.293-.155 4.45-.162 1.2-.507 2.21-1.31 3.012-.802.803-1.813 1.148-3.013 1.31-1.156.155-2.625.155-4.449.155H9.927c-1.824 0-3.293 0-4.45-.155-1.2-.162-2.21-.507-3.013-1.31-.802-.802-1.147-1.813-1.309-3.013C1 17.366 1 15.897 1 14.073v-.146c0-1.824 0-3.293.155-4.45.162-1.2.507-2.21 1.31-3.013.802-.802 1.813-1.147 3.013-1.309C6.634 5 8.103 5 9.927 5M5.744 7.138c-.978.131-1.496.372-1.865.74-.37.37-.61.888-.741 1.866C3.002 10.751 3 12.086 3 14s.002 3.249.138 4.256c.131.978.372 1.496.74 1.865.37.37.888.61 1.866.742C6.751 20.998 8.086 21 10 21h8c1.914 0 3.249-.002 4.256-.137.978-.132 1.496-.373 1.865-.742.37-.369.61-.887.742-1.865.135-1.007.137-2.342.137-4.256s-.002-3.249-.137-4.256c-.132-.978-.373-1.496-.742-1.865-.369-.37-.887-.61-1.865-.741C21.249 7.002 19.914 7 18 7h-8c-1.914 0-3.249.002-4.256.138" fillRule="evenodd" clipRule="evenodd" /></svg>; }
function Icon28StatsVideoOutline(): React.ReactElement { return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 28 28" fill="currentColor"><path d="M19 3a6 6 0 0 1 6 6v10a6 6 0 0 1-5.691 5.992L19 25H9l-.309-.008a6 6 0 0 1-5.683-5.683L3 19V9a6 6 0 0 1 6-6zM9 5a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h.53a5.98 5.98 0 0 1-1.522-3.691L8 19V9c0-1.537.579-2.938 1.53-4zm8.952 11.979a1 1 0 0 1-1.407-.094l-2.305-2.62-4.24 3.23V19a4 4 0 0 0 4 4h5a4 4 0 0 0 4-4v-6.415zM14 5a4 4 0 0 0-4 4v5.981l3.771-2.87.08-.055a1 1 0 0 1 1.277.19l2.262 2.57L23 9.936V9a4 4 0 0 0-4-4z" fillRule="evenodd" clipRule="evenodd" /></svg>; }
function Icon28HeartHandsOutline(): React.ReactElement { return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 28 28" fill="currentColor"><path d="M24.137 11a2.86 2.86 0 0 1 2.74 3.678l-.962 3.225a4.5 4.5 0 0 1-.948 1.702l-2.773 3.12-.015.212a3.294 3.294 0 0 1-6.579-.233v-1.808c0-.437.085-.872.248-1.278l1.072-2.66.057-.126a1.7 1.7 0 0 1 .645-.694c.752-.449 1.592-.25 2.11.271.22-.271.407-.569.548-.888l1.24-2.815A2.86 2.86 0 0 1 24.137 11m0 2a.86.86 0 0 0-.787.513l-1.24 2.814a6 6 0 0 1-.977 1.528l-1.354 1.54c-.503.57-1.289.41-1.652-.084l-.424 1.055a1.4 1.4 0 0 0-.103.53v1.808a1.295 1.295 0 0 0 2.584.092l.018-.262a1.86 1.86 0 0 1 .465-1.102l2.806-3.157c.242-.272.421-.594.525-.943l.963-3.227A.86.86 0 0 0 24.137 13M3.863 11a2.86 2.86 0 0 0-2.742 3.68l.963 3.223a4.5 4.5 0 0 0 .949 1.702l2.775 3.12.015.211a3.296 3.296 0 0 0 6.582-.234v-1.806c0-.437-.085-.872-.248-1.278l-1.073-2.661a1.7 1.7 0 0 0-.703-.82l-.128-.069c-.718-.355-1.493-.152-1.983.341a4 4 0 0 1-.548-.89l-1.241-2.813A2.86 2.86 0 0 0 3.863 11m0 2c.34 0 .65.202.788.514l1.24 2.813c.247.557.576 1.073.978 1.53l1.356 1.538c.503.571 1.289.41 1.651-.085l.425 1.056c.068.169.104.349.104.53v1.806a1.296 1.296 0 0 1-2.587.093l-.019-.26a1.86 1.86 0 0 0-.466-1.103l-2.806-3.157A2.5 2.5 0 0 1 4 17.331l-.962-3.224A.86.86 0 0 1 3.863 13M17.459 1.995c2.616.01 4.538 2.126 4.538 4.656 0 1.274-.253 2.214-1.007 3.23-.763 1.03-2.043 2.144-4.117 3.748l-1.93 1.491a1.56 1.56 0 0 1-1.905 0l-.004-.003-1.907-1.49c-2.074-1.603-3.353-2.716-4.117-3.745-.754-1.017-1.007-1.957-1.007-3.23 0-2.538 1.936-4.657 4.56-4.657l.226.007c1.13.067 2.184.618 2.935 1.118l.018.013.248.172.248-.172.018-.013c.71-.473 1.773-1.056 2.86-1.116l.03-.001.283-.008zm-.236 2.006c-.522.03-1.2.346-1.842.771l-.819.573c-.343.24-.8.24-1.144 0l-.82-.572c-.607-.401-1.244-.696-1.801-.763l-.235-.015c-1.445 0-2.56 1.149-2.56 2.656 0 .92.157 1.422.615 2.04.504.68 1.382 1.5 2.996 2.779l.737.577.004.003 1.637 1.276 1.658-1.28.737-.576c1.614-1.28 2.492-2.1 2.997-2.78.457-.617.614-1.12.614-2.039 0-1.408-.969-2.502-2.272-2.641l-.264-.015z" fillRule="evenodd" clipRule="evenodd" /></svg>; }
function KidsIcon(): React.ReactElement { return <span aria-hidden="true" data-native-icon="vk_video_kids_icon_white" className="block w-5 h-5" style={{ backgroundColor: 'currentColor', maskImage: `url(${kidsIcon})`, maskSize: 'contain', maskRepeat: 'no-repeat' }} />; }

export const VIDEO_MENU_ICONS: Record<string, React.ComponentType<{ width?: number; height?: number }>> = {
  'main_menu_vk_live': Icon28LiveBadgeVkVideoOutline,
  'main_menu_trends': Icon28HomeOutline,
  'main_menu_popular_trends': Icon28FlashOutline,
  'main_menu_clips': Icon28LogoClipsOutline,
  'main_menu_my_history': Icon28HistoryBackwardOutline,
  'main_menu_my_bookmarks': Icon28ClockOutline,
  'main_menu_my_liked': Icon28LikeOutline,
  'main_menu_my_playlists': Icon28ListAddOutline,
  'main_menu_authors_cabinet': Icon28StatsVideoOutline,
  'main_menu_subscribes': Icon28ListCheckOutline,
  'main_menu_video_subscriptions_select': Icon28UserCircleFillBlue,
  'main_menu_authors_list': Icon28UsersOutline,
  'main_menu_for_kids': KidsIcon,
  'main_menu_movie': Icon28MovieReelOutline,
  'main_menu_musical': Icon28MusicOutline,
  'main_menu_tvshow': Icon28TvOutline,
  'main_menu_sport': Icon28BasketballBallOutline,
  'main_menu_serial': Icon28PlayCards2Outline,
  'main_menu_lives': Icon28LiveOutline,
  'main_menu_cybersport': Icon28GameOutline,
  'main_menu_family_values': Icon28HeartHandsOutline,
  'main_menu_section_toggle': Icon28ChevronDownOutline,
  'main_menu_tv_install': Icon24TvOutline,
  'main-menu-content-info': Icon20InfoCircleOutline,
  'main_menu_legal_info': Icon16Dropdown,
};
