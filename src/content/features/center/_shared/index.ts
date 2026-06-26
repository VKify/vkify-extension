/**
 * Общие утилиты и константы для всех download-фич:
 *   • video-download   — обычные видео (vkvideo.ru)
 *   • story-download   — сторис (vk.com)
 *   • clip-download    — клипы (vk.com / vkvideo.ru)
 *   • photo-download   — фото и альбомы (vk.com)
 *   • audio-download   — музыка (vk.com)
 *
 * Реализация разбита по зонам ответственности в соседних модулях этой папки;
 * этот index — единая точка входа (barrel), чтобы импорты фич оставались
 * стабильными (`../_shared/index.js`).
 */

export {
  QUALITY_COLORS, VIDEO_QUALITIES,
  type VideoQualityKey, type VideoQualityFiles,
} from './quality.js';

export { sanitizeFilename } from './filename.js';

export { buildDownloadIconSvg } from './download-icon.js';

export { requestDownload } from './download-request.js';

export {
  showBrandTooltip, hideBrandTooltip,
  attachBrandTooltip, removeBrandTooltip,
} from './brand-tooltip.js';

export {
  buildVkifyLogo,
  createBrandButton, setBrandButtonLabel, removeBrandButtonStyles,
} from './brand-button.js';

export {
  downloadCenterJobStart, downloadCenterJobUpdate,
  downloadCenterJobDone, downloadCenterJobError, downloadCenterJobRemove,
  ensureDownloadCenter, destroyDownloadCenter,
} from '../../../ui/download-center/index.js';

export { fillQualityRows } from './quality-rows.js';
