/**
 * Загрузка HLS через hls.js (без воркера) → сырые ремукс-чанки аудио.
 * Два выхода: `fetchAndEncode` декодирует через AudioContext и кодирует в MP3
 * (lamejs); `fetchOriginal` отдаёт чанки как есть (AAC/.m4a без перекодирования).
 */

import Hls from 'hls.js';
import { Mp3Encoder } from '@breezystack/lamejs';
import { IS_FIREFOX } from '@/shared/constants/browser.js';
import { BackgroundLoader } from './bg-loader.js';
import { t } from '@/content/i18n/index.js';

/** Бросает AbortError, если загрузку попросили остановить. */
function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException(t('music.cancelled'), 'AbortError');
}

/**
 * Загружает HLS-поток через hls.js и возвращает сырые ремукс-чанки аудио
 * (fMP4/AAC от mp4-remuxer). Общая «половина» для MP3-конвейера и оригинала:
 * MP3 декодирует+кодирует эти чанки, «Оригинальный» отдаёт их как есть (.m4a).
 */
async function loadHlsAudioChunks(
  m3u8url: string,
  onProgress: (s: string) => void,
  signal?: AbortSignal,
): Promise<Uint8Array[]> {
  if (!Hls.isSupported()) throw new Error(t('music.hls_unsupported'));
  throwIfAborted(signal);

  onProgress(t('music.connecting'));

  const audio = document.createElement('audio');
  audio.muted = true;
  audio.style.cssText = 'position:fixed;left:-9999px;opacity:0;pointer-events:none';
  document.body.appendChild(audio);

  const hls = new Hls({
    enableWorker: false,
    debug: false,
    maxBufferLength: 9999,
    maxMaxBufferLength: 9999,
    maxBufferSize: 0,
    backBufferLength: 0,
    // На Firefox штатный XHR-загрузчик режется page CSP/CORS — тянем m3u8,
    // сегменты и ключи через background. На Chromium оставляем дефолт.
    ...(IS_FIREFOX ? { loader: BackgroundLoader } : {}),
  });

  let totalFrags = 0;
  let loadedFrags = 0;
  let lastError = '';
  const audioChunks: Uint8Array[] = [];
  const mainChunks:  Uint8Array[] = [];

  hls.on(Hls.Events.LEVEL_LOADED, (_, data) => {
    totalFrags = data.details.fragments.length;
    onProgress(t('music.segments', { loaded: 0, total: totalFrags }));
  });

  hls.on(Hls.Events.BUFFER_APPENDING, (_, data) => {
    const copy = data.data.slice();
    if (data.type === 'audio') {
      audioChunks.push(copy);
    } else if (data.type === 'audiovideo' || (data.type as string) === 'main') {
      mainChunks.push(copy);
    }
  });

  await new Promise<void>((resolve) => {
    // Отмена прерывает загрузку сегментов мгновенно — не ждём весь поток.
    if (signal) {
      if (signal.aborted) { resolve(); return; }
      signal.addEventListener('abort', () => resolve(), { once: true });
    }
    hls.on(Hls.Events.FRAG_LOADED, () => {
      loadedFrags++;
      onProgress(t('music.segments', { loaded: loadedFrags, total: totalFrags }));
    });
    hls.on(Hls.Events.BUFFER_EOS, () => setTimeout(resolve, 150));
    hls.on(Hls.Events.ERROR, (_, data) => {
      // Запоминаем последнюю ошибку (даже нефатальную) — её текст уходит в
      // сообщение об ошибке, если в итоге не соберётся ни одного аудиочанка.
      const resp = data.response as { code?: number } | undefined;
      const reason = (data as { reason?: string }).reason;
      lastError = `${data.type}/${data.details}`
        + (resp?.code ? ` HTTP ${resp.code}` : '')
        + (reason ? ` (${reason})` : '');
      if (data.fatal) resolve();
    });
    audio.addEventListener('ended', () => resolve());

    hls.loadSource(m3u8url);
    hls.attachMedia(audio);
    audio.addEventListener('canplay', () => {
      audio.playbackRate = 16;
      void audio.play().catch(() => {});
    });
    setTimeout(resolve, 5 * 60 * 1000);
  });

  hls.destroy();
  audio.remove();
  throwIfAborted(signal); // отменили во время загрузки сегментов — не декодируем

  const chunks = audioChunks.length > 0 ? audioChunks : mainChunks;
  if (chunks.length === 0) {
    throw new Error(lastError ? t('music.no_audio_data_err', { err: lastError }) : t('music.no_audio_data'));
  }

  return chunks;
}

/**
 * «Оригинальный» формат: собираем сырые ремукс-чанки (fMP4/AAC) без декодирования
 * и перекодирования — быстро и без потерь. Результат — валидный .m4a.
 */
export async function fetchOriginal(
  m3u8url: string,
  onProgress: (s: string) => void,
  signal?: AbortSignal,
): Promise<BlobPart[]> {
  const chunks = await loadHlsAudioChunks(m3u8url, onProgress, signal);
  return chunks as BlobPart[];
}

/** Полный конвейер HLS → MP3 (декодирование + lamejs). */
export async function fetchAndEncode(
  m3u8url: string,
  bitrate: number,
  onProgress: (s: string) => void,
  signal?: AbortSignal,
): Promise<BlobPart[]> {
  const chunks = await loadHlsAudioChunks(m3u8url, onProgress, signal);

  onProgress(t('music.decoding'));
  const totalLen = chunks.reduce((s, c) => s + c.byteLength, 0);
  const combined = new Uint8Array(totalLen);
  let off = 0;
  for (const c of chunks) { combined.set(c, off); off += c.byteLength; }

  const ctx = new AudioContext();
  let buf: AudioBuffer;
  try {
    buf = await ctx.decodeAudioData(combined.buffer.slice(0));
  } finally {
    void ctx.close();
  }

  const channels   = Math.min(buf.numberOfChannels, 2) as 1 | 2;
  const sampleRate = buf.sampleRate;
  const encoder    = new Mp3Encoder(channels, sampleRate, bitrate);

  const leftF  = buf.getChannelData(0);
  const rightF = channels > 1 ? buf.getChannelData(1) : leftF;
  const left   = floatToInt16(leftF);
  const right  = floatToInt16(rightF);

  const FRAME = 1152;
  const mp3Parts: BlobPart[] = [];

  const pushPart = (part: Uint8Array): void => {
    if (!part.length) return;
    const ab = part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength) as ArrayBuffer;
    mp3Parts.push(new Uint8Array(ab));
  };

  // Уступаем main-thread каждые ~0.3 с аудио, чтобы не морозить VK при
  // кодировании (особенно когда в очереди несколько треков).
  const yieldEvery = Math.max(8, Math.round(sampleRate * 0.3 / FRAME));
  let frameCount = 0;

  for (let i = 0; i < left.length; i += FRAME) {
    pushPart(encoder.encodeBuffer(left.subarray(i, i + FRAME), right.subarray(i, i + FRAME)));
    if (++frameCount % yieldEvery === 0) {
      throwIfAborted(signal); // прерываем кодирование на точке выхода в main-thread
      const pct = Math.round(i / left.length * 100);
      onProgress(t('music.converting', { pct }));
      await new Promise(r => setTimeout(r, 0));
    }
  }
  pushPart(encoder.flush());

  return mp3Parts;
}

function floatToInt16(f32: Float32Array): Int16Array {
  const i16 = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    i16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return i16;
}
