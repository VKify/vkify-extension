/** Типы VK API и внутренние структуры экспорта диалога. */

export type ExportFormat = 'json' | 'txt' | 'html' | 'html-embed' | 'html-zip';

export interface VKMessage {
  id: number;
  date: number;
  from_id: number;
  peer_id: number;
  text: string;
  fwd_messages?: VKMessage[];
  reply_message?: VKMessage;
  attachments?: VKAttachment[];
  action?: { type: string; [k: string]: unknown };
}

export interface VKPhotoSize { type: string; url: string; width: number; height: number }
export interface VKPhoto     { id: number; owner_id: number; sizes: VKPhotoSize[]; text?: string }
export interface VKDoc       { id: number; title?: string; url?: string; ext?: string; size?: number }
export interface VKSticker   { sticker_id: number; images?: VKPhotoSize[]; images_with_background?: VKPhotoSize[] }
export interface VKAudio     { artist?: string; title?: string; url?: string; duration?: number }
export interface VKVideo     { id: number; owner_id: number; title?: string; image?: VKPhotoSize[]; duration?: number }
export interface VKLink      { url: string; title?: string; description?: string }

export interface VKAttachment {
  type: string;
  photo?:   VKPhoto;
  doc?:     VKDoc;
  sticker?: VKSticker;
  audio?:   VKAudio;
  video?:   VKVideo;
  link?:    VKLink;
  audio_message?: { link_ogg?: string; link_mp3?: string; duration?: number };
  [k: string]: unknown;
}

export interface VKProfile {
  id: number;
  first_name: string;
  last_name: string;
  screen_name?: string;
}

export interface VKGroup {
  id: number;
  name: string;
  screen_name?: string;
}

export interface HistoryResponse {
  count: number;
  items: VKMessage[];
  profiles?: VKProfile[];
  groups?: VKGroup[];
}

export interface PeerNames {
  users: Map<number, VKProfile>;
  groups: Map<number, VKGroup>;
}

export interface AttDescriptor {
  /** Короткая текстовая подпись для TXT-экспорта (с URL, если есть). */
  textLine: string;
  /** Прямой URL картинки для HTML-эмбеддинга (фото / стикер); null для остального. */
  imageUrl: string | null;
  /** Произвольная ссылка (для doc/audio/video/link), которую стоит вынести отдельной строкой. */
  link: string | null;
  /** Подпись для не-фото-вложений в HTML (например, «🎵 Артист — Трек»). */
  htmlLabel: string;
}
