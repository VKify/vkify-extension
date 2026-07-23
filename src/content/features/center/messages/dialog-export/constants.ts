/** Идентификаторы DOM-узлов и параметры выгрузки. */

export const BTN_ATTR = 'data-vkify-export-injected';
export const STYLE_ID = 'vkify-export-styles';

export const CHAT_PEER_OFFSET = 2_000_000_000;

// messages.getHistory отдаёт максимум 200 за вызов; пауза ~340 мс держит нас
// под rate-limit VK API (≈3 rps).
export const PAGE_SIZE        = 200;
export const REQUEST_DELAY_MS = 340;

/** Параллельность скачивания картинок — выше упрёмся в rate-limit CDN. */
export const EMBED_CONCURRENCY = 6;
/** Картинки больше 8 МБ не встраиваем — остаются прямой ссылкой. */
export const EMBED_MAX_BYTES = 8 * 1024 * 1024;
/** Ограничиваем суммарный объём оригиналов в PDF, чтобы длинный диалог не исчерпал память вкладки. */
export const PDF_EMBED_MAX_TOTAL_BYTES = 16 * 1024 * 1024;
