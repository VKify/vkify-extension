/**
 * Кастомный hls.js-загрузчик, который тянет m3u8/сегменты/ключи через
 * background, а не напрямую из content-скрипта.
 *
 * Зачем: на Firefox cross-origin fetch/XHR из content-скрипта (в т.ч. изнутри
 * штатного XHR-загрузчика hls.js) к хостам аудио-CDN VK подпадает под CSP/CORS
 * страницы vk.com и блокируется → «Аудиоданные не получены». В service worker /
 * event-page с host_permissions этих ограничений нет. На Chromium content-скрипт
 * от page CSP освобождён, поэтому там используется штатный загрузчик hls.js
 * (быстрее, без base64-перекладки) — этот класс подключается только в Firefox.
 */

import { LoadStats } from 'hls.js';
import type {
  HlsConfig,
  Loader,
  LoaderCallbacks,
  LoaderConfiguration,
  LoaderContext,
  LoaderResponse,
  LoaderStats,
} from 'hls.js';

interface SegmentResponse {
  success: boolean;
  dataB64?: string;
  status?: number;
  error?: string;
}

/**
 * Карта шифрованных сегментов: absUrl(без query) → {keyUrl, ivHex}. Заполняется
 * при разборе m3u8, читается при запросе сегмента — расшифровку делает background
 * (WebCrypto в content-скрипте Firefox падает «Permission denied» на буфере из
 * другого realm). Ключ — без query, чтобы совпасть с тем, как URL резолвит hls.js.
 */
const segDecrypt = new Map<string, { keyUrl: string; ivHex: string }>();
const stripQuery = (u: string): string => u.split('?')[0];

/**
 * Разбирает m3u8: для AES-128-сегментов запоминает ключ+IV в `segDecrypt` и
 * ВЫРЕЗАЕТ `#EXT-X-KEY:METHOD=AES-128` (заменяет на METHOD=NONE), чтобы hls.js
 * считал поток открытым и не дешифровал его сам (см. выше про realm). IV по
 * умолчанию = номер сегмента (RFC 8216), если не задан явно. Возвращает
 * переписанный плейлист.
 */
function parseAndRewriteManifest(text: string, baseUrl: string): string {
  let seq = 0;
  for (const l of text.split('\n')) {
    const m = /#EXT-X-MEDIA-SEQUENCE:(\d+)/.exec(l);
    if (m) seq = parseInt(m[1], 10);
  }

  const abs = (u: string): string => { try { return new URL(u, baseUrl).toString(); } catch { return u; } };
  let keyUrl = '';
  let ivHex = '';
  const out: string[] = [];

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('#EXT-X-KEY')) {
      if (/METHOD=AES-128/.test(line)) {
        keyUrl = abs(/URI="([^"]*)"/.exec(line)?.[1] ?? '');
        ivHex = /IV=0x([0-9a-fA-F]+)/.exec(line)?.[1] ?? '';
        out.push('#EXT-X-KEY:METHOD=NONE');
        continue;
      }
      keyUrl = '';
      ivHex = '';
      out.push(raw);
      continue;
    }
    if (line && !line.startsWith('#')) {
      if (keyUrl) {
        segDecrypt.set(stripQuery(abs(line)), { keyUrl, ivHex: ivHex || seq.toString(16).padStart(32, '0') });
        if (segDecrypt.size > 300) {
          const oldest = segDecrypt.keys().next().value;
          if (oldest !== undefined) segDecrypt.delete(oldest);
        }
      }
      seq++;
    }
    out.push(raw);
  }
  return out.join('\n');
}

export class BackgroundLoader<T extends LoaderContext> implements Loader<T> {
  context: T | null = null;
  stats: LoaderStats = new LoadStats();
  private aborted = false;

  // hls.js конструирует загрузчик как `new Loader(config)`.
  constructor(_config?: HlsConfig) {}

  destroy(): void {
    this.abort();
    this.context = null;
  }

  abort(): void {
    this.aborted = true;
    this.stats.aborted = true;
  }

  load(context: T, _config: LoaderConfiguration, callbacks: LoaderCallbacks<T>): void {
    this.context = context;
    this.aborted = false;

    const stats = this.stats;
    stats.loading.start = performance.now();

    this.fetchViaBackground(context).then((res) => {
      if (this.aborted) return;

      const now = performance.now();
      stats.loading.first = Math.max(now, stats.loading.start);
      stats.loading.end = now;

      if (!res.ok || res.data === undefined) {
        console.warn('[VKify audio] bg-loader load failed', { url: context.url, status: res.status, error: res.error });
        callbacks.onError({ code: res.status, text: res.error ?? 'background fetch failed' }, context, null, stats);
        return;
      }

      const len = typeof res.data === 'string' ? res.data.length : res.data.byteLength;
      stats.loaded = len;
      stats.total = len;

      const response: LoaderResponse = { url: context.url, data: res.data, code: res.status };
      callbacks.onSuccess(response, stats, context, null);
    }).catch((err: unknown) => {
      if (this.aborted) return;
      callbacks.onError({ code: 0, text: err instanceof Error ? err.message : String(err) }, context, null, stats);
    });
  }

  private async fetchViaBackground(
    context: T,
  ): Promise<{ ok: boolean; status: number; data?: string | ArrayBuffer; error?: string }> {
    const enc = segDecrypt.get(stripQuery(context.url));
    const resp = await chrome.runtime.sendMessage({
      type: 'AUDIO_FETCH_SEGMENT',
      url: context.url,
      rangeStart: context.rangeStart,
      rangeEnd: context.rangeEnd,
      decryptKeyUrl: enc?.keyUrl,
      decryptIvHex: enc?.ivHex,
    }) as SegmentResponse | undefined;

    const status = resp?.status ?? 0;
    if (!resp?.success || resp.dataB64 == null) {
      return { ok: false, status, error: resp?.error };
    }

    const bytes = base64ToBytes(resp.dataB64);
    let data: string | ArrayBuffer = context.responseType === 'arraybuffer'
      ? (bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
      : new TextDecoder().decode(bytes);

    // m3u8 — переписываем (вырезаем AES-ключ, заполняем карту дешифровки),
    // чтобы hls.js считал поток открытым, а seg-00 пришёл уже расшифрованным.
    if (typeof data === 'string' && data.includes('#EXTM3U')) {
      data = parseAndRewriteManifest(data, context.url);
    }

    return { ok: true, status: status || 200, data };
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
