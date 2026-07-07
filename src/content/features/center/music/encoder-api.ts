/**
 * Контракт on-demand аудио-энкодера (HLS → MP3/AAC). Тип общий для трёх сторон,
 * и НИ ОДНА из них не тянет через него hls.js/lamejs:
 *   • content-прокси (`encoder.ts`) — вызывает API после инъекции;
 *   • injected-бандл (`encoder-entry.ts`) — публикует реализацию в window;
 *   • реализация (`encoder-impl.ts`) — реализует эти сигнатуры.
 * Реальный код (hls.js + lamejs) живёт ТОЛЬКО в injected-бандле, отдельно от
 * content.js — см. [[bundle-size-budgets]].
 */
export interface AudioEncoderApi {
  /** Полный конвейер HLS → MP3 (декодирование + lamejs). */
  fetchAndEncode(
    m3u8url: string,
    bitrate: number,
    onProgress: (s: string) => void,
    signal?: AbortSignal,
  ): Promise<BlobPart[]>;
  /** «Оригинальный» формат: сырые ремукс-чанки AAC (.m4a) без перекодирования. */
  fetchOriginal(
    m3u8url: string,
    onProgress: (s: string) => void,
    signal?: AbortSignal,
  ): Promise<BlobPart[]>;
}

declare global {
  interface Window {
    /**
     * API энкодера, опубликованное injected-бандлом (encoder-entry.ts) в
     * ISOLATED-мире вкладки. content-прокси ждёт его появления после инъекции.
     */
    __vkifyAudioEncoder?: AudioEncoderApi;
  }
}
