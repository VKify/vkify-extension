/**
 * Content-прокси аудио-энкодера. Реальный код (hls.js + lamejs, ~110 KB gz) НЕ
 * бандлится в content.js: он лежит в отдельном bundlе `audio-encoder.js` и
 * инжектится по требованию в ЭТОТ ЖЕ ISOLATED-мир вкладки (background →
 * chrome.scripting) при первом скачивании. После инъекции реализация доступна
 * как `window.__vkifyAudioEncoder` — тот же realm, поэтому колбэки прогресса и
 * AbortSignal передаются по ссылке, без сериализации. Так тяжёлые библиотеки не
 * висят на document_start. См. [[bundle-size-budgets]].
 *
 * Публичные `fetchAndEncode`/`fetchOriginal` сохраняют прежние сигнатуры — для
 * pipeline.ts подмена прозрачна.
 */
import { t } from '@/content/i18n/index.js';
import type { AudioEncoderApi } from './encoder-api.js';

// Инъекцию делаем один раз на вкладку; параллельные вызовы ждут один промис.
// При ошибке сбрасываем — повторная попытка (напр. после выдачи прав) возможна.
let pending: Promise<AudioEncoderApi> | null = null;

async function injectEncoder(): Promise<AudioEncoderApi> {
  const resp = (await chrome.runtime.sendMessage({ type: 'INJECT_AUDIO_ENCODER' })) as
    | { ok: boolean; error?: string }
    | undefined;
  if (!resp?.ok) {
    throw new Error(t('music.encoder_load_failed') + (resp?.error ? `: ${resp.error}` : ''));
  }
  // executeScript в background резолвится ПОСЛЕ выполнения injected-IIFE, значит
  // глобал уже выставлен. Небольшой опрос — страховка от гонок в редких движках.
  const started = Date.now();
  for (;;) {
    const api = window.__vkifyAudioEncoder;
    if (api) return api;
    if (Date.now() - started > 5000) throw new Error(t('music.encoder_load_failed'));
    await new Promise((r) => setTimeout(r, 30));
  }
}

async function ensureEncoder(): Promise<AudioEncoderApi> {
  if (window.__vkifyAudioEncoder) return window.__vkifyAudioEncoder;
  if (!pending) pending = injectEncoder();
  try {
    return await pending;
  } catch (e) {
    pending = null; // разрешаем повторную попытку
    throw e;
  }
}

export async function fetchAndEncode(
  m3u8url: string,
  bitrate: number,
  onProgress: (s: string) => void,
  signal?: AbortSignal,
): Promise<BlobPart[]> {
  return (await ensureEncoder()).fetchAndEncode(m3u8url, bitrate, onProgress, signal);
}

export async function fetchOriginal(
  m3u8url: string,
  onProgress: (s: string) => void,
  signal?: AbortSignal,
): Promise<BlobPart[]> {
  return (await ensureEncoder()).fetchOriginal(m3u8url, onProgress, signal);
}
