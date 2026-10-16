/**
 * Загрузка HLS через hls.js (без воркера) → сырые ремукс-чанки аудио.
 * Два выхода: `fetchAndEncode` декодирует через AudioContext и кодирует в MP3
 * (lamejs); `fetchOriginal` отдаёт чанки как есть (AAC/.m4a без перекодирования).
 */

// Лёгкая сборка hls.js (без alt-audio/субтитров/EME — аудио-скачиванию они не
// нужны). AES-128-расшифровка (шифрованные сегменты VK) в ней сохранена. Заметно
// меньше полной сборки. См. [[bundle-size-budgets]].
import Hls from 'hls.js/light';
import type { Fragment } from 'hls.js';
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
    // Keep MSE bounded: the downloaded data lives in our own collection.
    maxBufferLength: 30,
    maxMaxBufferLength: 60,
    backBufferLength: 0,
    progressive: false,
    lowLatencyMode: false,
    // На Firefox штатный XHR-загрузчик режется page CSP/CORS — тянем m3u8,
    // сегменты и ключи через background. На Chromium оставляем дефолт.
    ...(IS_FIREFOX ? { loader: BackgroundLoader } : {}),
  });

  let totalFrags = 0;
  let lastError = '';
  const fragmentKey = (frag: Fragment): string => `${frag.cc}:${frag.sn}`;
  type Chunks = { audio: Uint8Array[]; main: Uint8Array[] };
  const pending = new Map<string, Chunks>();
  const initChunks = new Map<string, Chunks>();
  const completed = new Map<string, Chunks>();
  let fragments: Fragment[] = [];

  hls.on(Hls.Events.LEVEL_LOADED, (_, data) => {
    totalFrags = data.details.fragments.length;
    fragments = data.details.fragments;
    onProgress(t('music.segments', { loaded: 0, total: totalFrags }));
  });

  hls.on(Hls.Events.BUFFER_APPENDING, (_, data) => {
    const key = fragmentKey(data.frag);
    if (completed.has(key)) return;
    const isInit = data.data.length >= 8
      && ['ftyp', 'moov'].includes(String.fromCharCode(...data.data.subarray(4, 8)));
    // hls.js may not emit the init segment again when retrying a fragment.
    const collection = isInit ? initChunks : pending;
    let chunks = collection.get(key);
    if (!chunks) {
      chunks = { audio: [], main: [] };
      collection.set(key, chunks);
    }
    const copy = data.data.slice();
    if (data.type === 'audio') {
      if (isInit) chunks.audio = [copy];
      else chunks.audio.push(copy);
    } else if (data.type === 'audiovideo' || (data.type as string) === 'main') {
      if (isInit) chunks.main = [copy];
      else chunks.main.push(copy);
    }
  });

  // A retry can emit BUFFER_APPENDING again. Commit one complete remux per
  // playlist fragment, rather than concatenating playback buffer attempts.
  hls.on(Hls.Events.FRAG_LOADING, (_, { frag }) => pending.delete(fragmentKey(frag)));
  hls.on(Hls.Events.FRAG_PARSED, (_, { frag }) => {
    const key = fragmentKey(frag);
    const chunks = pending.get(key);
    if (!completed.has(key) && chunks && (chunks.audio.length || chunks.main.length)) {
      const init = initChunks.get(key);
      completed.set(key, {
        audio: [...(init?.audio ?? []), ...chunks.audio],
        main: [...(init?.main ?? []), ...chunks.main],
      });
      initChunks.delete(key);
      onProgress(t('music.segments', { loaded: completed.size, total: totalFrags }));
    }
    pending.delete(key);
  });

  let timeout: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      // Отмена прерывает загрузку сегментов мгновенно — не ждём весь поток.
      if (signal) {
        if (signal.aborted) { resolve(); return; }
        onAbort = () => resolve();
        signal.addEventListener('abort', onAbort, { once: true });
      }
      hls.on(Hls.Events.BUFFER_EOS, () => {
        if (!fragments.length || fragments.some(frag => !completed.has(fragmentKey(frag)))) {
          reject(new Error(t('music.download_incomplete')));
        } else {
          resolve();
        }
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        // Запоминаем последнюю ошибку (даже нефатальную) — её текст уходит в
        // сообщение об ошибке, если в итоге не соберётся ни одного аудиочанка.
        const resp = data.response as { code?: number; text?: string } | undefined;
        const reason = (data as { reason?: string }).reason || resp?.text;
        lastError = `${data.type}/${data.details}`
          + (resp?.code ? ` HTTP ${resp.code}` : '')
          + (reason ? ` (${reason})` : '');
        if (data.fatal) reject(new Error(t('music.no_audio_data_err', { err: lastError })));
      });

      audio.addEventListener('canplay', () => {
        audio.playbackRate = 16;
        void audio.play().catch(() => {});
      });
      timeout = setTimeout(() => reject(new Error(t('music.download_timeout'))), 5 * 60 * 1000);
      hls.loadSource(m3u8url);
      hls.attachMedia(audio);
    });
  } finally {
    clearTimeout(timeout);
    if (onAbort) signal?.removeEventListener('abort', onAbort);
    hls.destroy();
    audio.remove();
  }

  throwIfAborted(signal); // отменили во время загрузки сегментов — не декодируем

  const ordered = fragments.map(frag => completed.get(fragmentKey(frag))!);
  const audioChunks = ordered.flatMap(chunks => chunks.audio);
  const chunks = audioChunks.length > 0 ? audioChunks : ordered.flatMap(chunks => chunks.main);
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
