/**
 * Общие утилиты и константы для всех download-фич:
 *   • video-download   — обычные видео (vkvideo.ru)
 *   • story-download   — сторис (vk.com)
 *   • clip-download    — клипы (vk.com / vkvideo.ru)
 *   • photo-download   — фото и альбомы (vk.com)
 *   • audio-download   — музыка (vk.com)
 *
 * Реализация разбита по зонам ответственности в ./_shared/*; этот файл —
 * единая точка входа (barrel), чтобы импорты фич оставались стабильными.
 */

export {
  QUALITY_COLORS, VIDEO_QUALITIES,
  type VideoQualityKey, type VideoQualityFiles,
} from './_shared/quality.js';

export { sanitizeFilename } from './_shared/filename.js';

export { buildDownloadIconSvg } from './_shared/download-icon.js';

export { requestDownload } from './_shared/download-request.js';

export {
  showBrandTooltip, hideBrandTooltip,
  attachBrandTooltip, removeBrandTooltip,
} from './_shared/brand-tooltip.js';

export {
  buildVkifyLogo,
  createBrandButton, setBrandButtonLabel, removeBrandButtonStyles,
} from './_shared/brand-button.js';

export {
  downloadCenterJobStart, downloadCenterJobUpdate,
  downloadCenterJobDone, downloadCenterJobError, downloadCenterJobRemove,
  ensureDownloadCenter, destroyDownloadCenter,
} from './_shared/download-center.js';

export { fillQualityRows } from './_shared/quality-rows.js';
