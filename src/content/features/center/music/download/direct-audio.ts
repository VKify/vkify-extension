import { api } from '@/shared/ext-api.js';
import { t } from '@/content/i18n/index.js';
import type { OriginalAudioFile } from './encoder-api.js';

/** Inspect bytes rather than the URL: signed VK URLs need not have an extension. */
export function detectAudioFile(bytes: Uint8Array): Omit<OriginalAudioFile, 'parts'> | null {
  const tag = (start: number, end: number): string => String.fromCharCode(...bytes.subarray(start, end));
  if (bytes.length < 12) return null;
  if (tag(0, 3) === 'ID3') return { ext: 'mp3', mime: 'audio/mpeg' };
  if (tag(4, 8) === 'ftyp') return { ext: 'm4a', mime: 'audio/mp4' };
  if (tag(0, 4) === 'RIFF' && tag(8, 12) === 'WAVE') return { ext: 'wav', mime: 'audio/wav' };
  if (tag(0, 4) === 'OggS') return { ext: 'ogg', mime: 'audio/ogg' };
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    // ADTS has zero layer bits; MPEG audio requires a nonzero layer.
    if ((bytes[1] & 0x16) === 0x10) return { ext: 'aac', mime: 'audio/aac' };
    if ((bytes[1] & 0x06) !== 0 && (bytes[1] & 0x18) !== 0x08
      && (bytes[2] & 0xf0) !== 0xf0 && (bytes[2] & 0x0c) !== 0x0c) {
      return { ext: 'mp3', mime: 'audio/mpeg' };
    }
  }
  return null;
}

export type AudioSource = { kind: 'file'; file: OriginalAudioFile } | { kind: 'hls'; manifest: string };

/** Fetch once and choose the pipeline from the response bytes, before starting HLS. */
export async function fetchAudioSource(url: string, signal?: AbortSignal): Promise<AudioSource> {
  const checkAbort = (): void => {
    if (signal?.aborted) throw new DOMException(t('music.cancelled'), 'AbortError');
  };
  checkAbort();
  type Response = {
    success?: boolean; dataB64?: string; error?: string;
  } | undefined;
  let onAbort: (() => void) | undefined;
  let response: Response;
  try {
    response = await new Promise<Response>((resolve, reject) => {
      onAbort = () => reject(new DOMException(t('music.cancelled'), 'AbortError'));
      signal?.addEventListener('abort', onAbort, { once: true });
      Promise.resolve(api.runtime.sendMessage({ type: 'AUDIO_FETCH_SEGMENT', url })).then(resolve, reject);
    });
  } finally {
    if (onAbort) signal?.removeEventListener('abort', onAbort);
  }
  checkAbort();
  if (!response?.success || !response.dataB64) {
    throw new Error(response?.error || t('music.no_audio_data'));
  }
  const binary = atob(response.dataB64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const format = detectAudioFile(bytes);
  if (format) return { kind: 'file', file: { ...format, parts: [bytes as BlobPart] } };
  const manifest = new TextDecoder().decode(bytes);
  if (manifest.trimStart().startsWith('#EXTM3U')) return { kind: 'hls', manifest };
  throw new Error(t('music.invalid_audio_response'));
}
