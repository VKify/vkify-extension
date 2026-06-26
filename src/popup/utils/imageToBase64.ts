/**
 * Конвертация внешних изображений в data:-URL (base64) для фона.
 *
 * Зачем: CSP ВКонтакте (`img-src`) режет загрузку фоновой картинки по прямой
 * сторонней ссылке — `background-image: url(https://…)` молча не применяется.
 * `data:`-URL в `img-src` разрешён, поэтому переводим картинку в base64 на
 * стороне попапа и сохраняем уже её.
 *
 * Ограничение окружения: в манифесте НЕТ `<all_urls>` в host_permissions, только
 * домены VK. Значит `fetch()` к произвольному хосту упрётся в CORS. Поэтому
 * основной путь — `<img crossOrigin="anonymous">` + canvas: он читает пиксели
 * без host-permission, но требует, чтобы сервер отдавал CORS-заголовки. Если
 * сервер их не шлёт, canvas «отравляется» и `toDataURL` бросает SecurityError —
 * это ловит вызывающая сторона и откатывается на прямой URL (как было раньше).
 */

/** Мягкая проверка расширения — у многих CDN его нет, поэтому не строгая. */
const SUPPORTED_EXT = /\.(jpe?g|png|webp|gif|avif)(\?.*)?$/i;

const CACHE_LIMIT = 10;
/** FIFO-кэш уже сконвертированных картинок: ключ — исходный URL. */
const imageCache = new Map<string, string>();

export interface ImageInfo {
  valid: boolean;
  width: number;
  height: number;
}

export interface ConvertOptions {
  maxWidth?: number;
  quality?: number;
}

export function isSupportedImageUrl(url: string): boolean {
  return SUPPORTED_EXT.test(url);
}

/**
 * Доступность и размеры картинки. Грузит обычным `<img>` (без crossOrigin), так
 * что работает для любого отображаемого изображения, даже без CORS.
 */
export function validateImage(url: string, timeoutMs = 15000): Promise<ImageInfo> {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const finish = (result: ImageInfo): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => finish({ valid: false, width: 0, height: 0 }), timeoutMs);
    img.onload = () => finish({ valid: true, width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => finish({ valid: false, width: 0, height: 0 });
    img.src = url;
  });
}

function loadCrossOriginImage(url: string, timeoutMs = 20000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => reject(new Error('image-load-timeout')), timeoutMs);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); reject(new Error('image-load-failed')); };
    img.src = url;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('blob-read-failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Рисует картинку на canvas с ресайзом до `maxWidth` и кодирует в JPEG.
 * Бросит SecurityError, если сервер не отдал CORS (отравленный canvas).
 */
async function rasterToBase64(url: string, maxWidth: number, quality: number): Promise<string> {
  const img = await loadCrossOriginImage(url);

  let width = img.naturalWidth;
  let height = img.naturalHeight;
  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no-2d-context');
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * GIF через fetch+FileReader: canvas сплющил бы анимацию в первый кадр, поэтому
 * сохраняем исходные байты. Требует CORS на сервере — иначе бросит и
 * вызывающая сторона откатится.
 */
async function gifToBase64(url: string): Promise<string> {
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) throw new Error(`gif-fetch-${response.status}`);
  return blobToDataUrl(await response.blob());
}

/**
 * URL → base64 с кэшированием. Бросает, если конвертация невозможна (нет CORS):
 * вызывающая сторона должна откатиться на прямой URL.
 */
export async function getBase64Image(url: string, options: ConvertOptions = {}): Promise<string> {
  if (url.startsWith('data:')) return url;

  const cached = imageCache.get(url);
  if (cached) return cached;

  const { maxWidth = 1920, quality = 0.85 } = options;
  const isGif = /\.gif(\?.*)?$/i.test(url);

  const base64 = isGif
    ? await gifToBase64(url).catch(() => rasterToBase64(url, maxWidth, quality))
    : await rasterToBase64(url, maxWidth, quality);

  imageCache.set(url, base64);
  if (imageCache.size > CACHE_LIMIT) {
    const oldest = imageCache.keys().next().value;
    if (oldest !== undefined) imageCache.delete(oldest);
  }

  return base64;
}

/** Размер data:-URL в байтах (по длине base64-хвоста, без накладных JSON). */
export function dataUrlByteSize(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  return `${Math.round(bytes / 1024)} КБ`;
}
