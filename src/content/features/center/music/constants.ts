/** Атрибуты-маркеры инжектированных элементов, id стилей и лимиты. */

export const BUTTON_ATTR = 'data-vkify-adl';
export const STATUS_ATTR = 'data-vkify-adl-status';
export const ALBUM_ATTR  = 'data-vkify-adl-album';
export const ALL_ATTR    = 'data-vkify-adl-all';
export const PLAYER_ATTR = 'data-vkify-adl-player';
export const STYLES_ID   = 'vkify-adl-css';

// Параллельные загрузки тяжело грузят main-thread (HLS-демукс без воркера,
// decodeAudioData, MP3-кодирование) — больше двух одновременно подвешивают VK.
// Поэтому ограничиваем конкурентность, остальные ждут в очереди.
export const MAX_CONCURRENT = 2;
