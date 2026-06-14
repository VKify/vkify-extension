/**
 * Фоновый доступ к аудио-CDN VK для HLS-загрузки музыки.
 *
 * В MV3 service worker с host_permissions свободен от page CSP/CORS — это важно
 * для Firefox, где штатный XHR-загрузчик hls.js работает в content-скрипте и
 * режется. Анти-SSRF: ходим только на белый список хостов VK.
 *
 * Byte-range: VK раздаёт трек как ОДИН файл seg-00-a2.ts, а фрагменты плейлиста
 * — это диапазоны байт в нём; AES-128-CBC сегменты расшифровываем здесь же
 * (WebCrypto в service worker работает в чистом realm — в content-скрипте
 * Firefox subtle.decrypt падает «Permission denied» на кросс-realm буфере).
 */

/** Хосты аудио-CDN VK, куда разрешён фоновый fetch HLS (анти-SSRF). */
export function isVkAudioUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return false;
    const h = u.hostname;
    return h === 'vkuseraudio.net' || h.endsWith('.vkuseraudio.net')
      || h === 'userapi.com' || h.endsWith('.userapi.com')
      || h === 'mycdn.me' || h.endsWith('.mycdn.me')
      // URI AES-ключа HLS у VK может отдаваться с самого vk.com/vk.ru.
      || h === 'vk.com' || h.endsWith('.vk.com')
      || h === 'vk.ru' || h.endsWith('.vk.ru');
  } catch {
    return false;
  }
}

/**
 * Кэш целых файлов аудио-CDN. VK запрашивает один и тот же seg-файл на каждый
 * фрагмент плейлиста (десятки раз) — фетчим его однажды и отдаём из кэша (целиком
 * либо срезом для byte-range). Кэшируем Promise (дедуп параллельных запросов),
 * храним до нескольких файлов (параллельные загрузки альбома), вытесняем старый.
 */
const fullSegmentCache = new Map<string, Promise<Uint8Array>>();
const FULL_SEGMENT_CACHE_MAX = 4;

export function fetchFullSegment(url: string): Promise<Uint8Array> {
  let p = fullSegmentCache.get(url);
  if (!p) {
    p = fetch(url, { credentials: 'include' }).then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    });
    p.catch(() => fullSegmentCache.delete(url)); // ошибку не кэшируем
    fullSegmentCache.set(url, p);
    while (fullSegmentCache.size > FULL_SEGMENT_CACHE_MAX) {
      const oldest = fullSegmentCache.keys().next().value;
      if (oldest === undefined) break;
      fullSegmentCache.delete(oldest);
    }
  }
  return p;
}

/** hex-строка → байты (для IV/ключа AES). Нечётную/пустую трактуем как нули. */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    const byte = clean.substr(i * 2, 2);
    out[i] = byte ? parseInt(byte, 16) : 0;
  }
  return out;
}

/** Копия в свежий ArrayBuffer (WebCrypto-типы требуют именно ArrayBuffer). */
function toArrayBuffer(u: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u.byteLength);
  new Uint8Array(ab).set(u);
  return ab;
}

/** AES-128-CBC расшифровка через WebCrypto (PKCS7-паддинг снимается автоматически). */
export async function aesCbcDecrypt(cipher: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey('raw', toArrayBuffer(key), { name: 'AES-CBC' }, false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: toArrayBuffer(iv) }, cryptoKey, toArrayBuffer(cipher));
  return new Uint8Array(plain);
}
