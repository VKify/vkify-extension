/**
 * Конвейер HLS → MP3: грузим m3u8 через hls.js (без воркера), собираем
 * аудио-сегменты, декодируем через AudioContext и кодируем в MP3 (lamejs).
 * Возвращает массив MP3-фреймов.
 */

import Hls from 'hls.js';
import { Mp3Encoder } from '@breezystack/lamejs';
import { IS_FIREFOX } from '../../../../shared/constants/browser.js';
import { BackgroundLoader } from './bg-loader.js';

export async function fetchAndEncode(
  m3u8url: string,
  bitrate: number,
  onProgress: (s: string) => void,
): Promise<BlobPart[]> {
  if (!Hls.isSupported()) throw new Error('HLS не поддерживается');

  onProgress('Подключение');

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
    onProgress(`Сегменты 0 / ${totalFrags}`);
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
    hls.on(Hls.Events.FRAG_LOADED, () => {
      loadedFrags++;
      onProgress(`Сегменты ${loadedFrags} / ${totalFrags}`);
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

  const chunks = audioChunks.length > 0 ? audioChunks : mainChunks;
  if (chunks.length === 0) {
    throw new Error(lastError ? `Аудиоданные не получены (${lastError})` : 'Аудиоданные не получены');
  }

  onProgress('Декодирование');
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
      const pct = Math.round(i / left.length * 100);
      onProgress(`Конвертация ${pct}%`);
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
