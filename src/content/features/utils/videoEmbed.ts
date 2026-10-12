import type { EmbedData, RutubeController } from '@/types/index.js';

export type { EmbedData, RutubeController };

export function parseVideoUrl(url: string): EmbedData | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace('www.', '');
    const path = parsed.pathname;
    const params = parsed.searchParams;
    // Origin встраивающей страницы (vk.ru) — YouTube JS-API сверяет его при
    // приёме postMessage-команд.
    const pageOrigin = typeof window !== 'undefined' ? window.location.origin : '';

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      let videoId = params.get('v');
      if (!videoId) {
        const embedMatch = path.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
        const shortsMatch = path.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
        videoId = embedMatch?.[1] ?? shortsMatch?.[1] ?? null;
      }
      if (videoId) {
        return {
          // enablejsapi=1 — чтобы можно было слать плееру playVideo через
          // postMessage. URL-параметр autoplay=1 ненадёжен: его срезают блокировщики
          // рекламы и расширения-улучшайзеры YouTube, поэтому реальный старт делает
          // setupYouTubeControl, а не сам YouTube. origin нужен YouTube для проверки
          // источника postMessage-команд.
          embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&showinfo=0&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&fs=0&playsinline=1&enablejsapi=1${pageOrigin ? `&origin=${encodeURIComponent(pageOrigin)}` : ''}`,
          platform: 'youtube',
          type: 'embed',
        };
      }
    }

    if (host === 'youtu.be') {
      const videoId = path.slice(1).split('/')[0];
      if (videoId && videoId.length === 11) {
        return {
          // enablejsapi=1 — чтобы можно было слать плееру playVideo через
          // postMessage. URL-параметр autoplay=1 ненадёжен: его срезают блокировщики
          // рекламы и расширения-улучшайзеры YouTube, поэтому реальный старт делает
          // setupYouTubeControl, а не сам YouTube. origin нужен YouTube для проверки
          // источника postMessage-команд.
          embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&showinfo=0&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&fs=0&playsinline=1&enablejsapi=1${pageOrigin ? `&origin=${encodeURIComponent(pageOrigin)}` : ''}`,
          platform: 'youtube',
          type: 'embed',
        };
      }
    }

    if (host === 'vk.ru' || host === 'm.vk.ru' || host === 'vkvideo.ru') {
      const videoMatch = path.match(/\/(?:video|clip)(-?\d+_\d+)/);
      if (videoMatch) {
        const [oid, id] = videoMatch[1].split('_');
        return {
          // vk.ru вместо отдельного домена vkvideo.ru.
          embedUrl: `https://vk.ru/video_ext.php?oid=${oid}&id=${id}&autoplay=1&mute=1&loop=1&controls=0`,
          platform: 'vk',
          type: 'embed',
        };
      }
      if (path.includes('video_ext.php')) {
        const oid = params.get('oid');
        const id = params.get('id');
        const hash = params.get('hash');
        if (oid && id) {
          let embedUrl = `https://vk.ru/video_ext.php?oid=${oid}&id=${id}&autoplay=1&mute=1&loop=1&controls=0`;
          if (hash) embedUrl += `&hash=${hash}`;
          return { embedUrl, platform: 'vk', type: 'embed' };
        }
      }
    }

    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const vimeoMatch = path.match(/\/(?:video\/)?(\d+)/);
      if (vimeoMatch) {
        return {
          // api=1 — чтобы слать плееру {method:'play'} через postMessage, если
          // autoplay/background срежут (см. setupVimeoPlayback).
          embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1&muted=1&loop=1&background=1&controls=0&api=1`,
          platform: 'vimeo',
          type: 'embed',
        };
      }
    }

    if (host === 'coub.com') {
      const coubMatch = path.match(/\/(?:view|embed)\/([a-zA-Z0-9]+)/);
      if (coubMatch) {
        return {
          embedUrl: `https://coub.com/embed/${coubMatch[1]}?muted=true&autostart=true&originalSize=false&startWithHD=true`,
          platform: 'coub',
          type: 'embed',
        };
      }
    }

    if (host === 'rutube.ru') {
      let videoId: string | null = null;
      const embedMatch = path.match(/\/play\/embed\/([a-f0-9]+)/);
      if (embedMatch) {
        videoId = embedMatch[1];
      } else {
        const rutubeMatch = path.match(/\/video\/([a-f0-9]+)/);
        if (rutubeMatch) videoId = rutubeMatch[1];
      }
      if (videoId) {
        return {
          embedUrl: `https://rutube.ru/play/embed/${videoId}`,
          platform: 'rutube',
          type: 'embed',
          attributes: {
            allow: 'clipboard-write; autoplay',
            frameBorder: '0',
            webkitAllowFullScreen: 'true',
            mozallowfullscreen: 'true',
            allowFullScreen: 'true',
          },
        };
      }
    }

  } catch {
    // Invalid URL
  }

  return null;
}

export function setupRutubeControl(iframe: HTMLIFrameElement): RutubeController | null {
  if (!iframe || iframe.dataset.platform !== 'rutube') return null;

  const sendCommand = (type: string, data: Record<string, unknown> = {}): void => {
    try {
      iframe.contentWindow?.postMessage(JSON.stringify({ type, data }), '*');
    } catch { /* ignore */ }
  };

  const handler = (event: MessageEvent): void => {
    try {
      const data = typeof event.data === 'string'
        ? JSON.parse(event.data) as Record<string, unknown>
        : event.data as Record<string, unknown>;

      if (data.type === 'player:ended' ||
          (data.type === 'player:state' && (data.data as Record<string, string>)?.state === 'ended')) {
        sendCommand('player:setCurrentTime', { time: 0 });
        sendCommand('player:play');
      }

      if (data.type === 'player:ready' ||
          (data.type === 'player:state' && (data.data as Record<string, string>)?.state === 'paused')) {
        sendCommand('player:play');
      }
    } catch { /* ignore */ }
  };

  window.addEventListener('message', handler);
  sendCommand('player:play');
  setTimeout(() => sendCommand('player:play'), 1000);
  setTimeout(() => sendCommand('player:play'), 3000);

  return {
    play: () => sendCommand('player:play'),
    pause: () => sendCommand('player:pause'),
    mute: () => sendCommand('player:mute'),
    unmute: () => sendCommand('player:unmute'),
    setVolume: (vol: number) => sendCommand('player:setVolume', { volume: vol }),
    seekTo: (time: number) => sendCommand('player:setCurrentTime', { time }),
    destroy: () => window.removeEventListener('message', handler),
  };
}

/**
 * Повторно шлёт встроенному плееру команды старта по postMessage.
 *
 * Полагаться на URL-параметр autoplay нельзя: блокировщики рекламы (uBlock) и
 * расширения-улучшайзеры срезают его — плеер грузит обложку, но не стартует.
 * Поэтому VKify сам командует плееру play через его JS-API. Команды повторяем
 * несколько раз (плеер готов не сразу), приглушённо (иначе autoplay-политика не
 * пустит). Неизвестные плееру сообщения он молча игнорирует — лишние варианты
 * безопасны. Тот же приём уже применён для Rutube (setupRutubeControl).
 */
function nudgePlayback(iframe: HTMLIFrameElement, origin: string, messages: readonly object[]): void {
  const post = (): void => {
    for (const msg of messages) {
      try {
        iframe.contentWindow?.postMessage(JSON.stringify(msg), origin);
      } catch { /* ignore */ }
    }
  };
  post();
  [400, 1000, 2000, 3500].forEach(t => setTimeout(post, t));
}

export interface YouTubePlaybackController {
  setVolume(volume: number): void;
  destroy(): void;
}

/** YouTube IFrame API (enablejsapi=1); volume is expressed as 0–100. */
export function setupYouTubePlayback(iframe: HTMLIFrameElement, initialVolume = 0): YouTubePlaybackController {
  let volume = initialVolume;
  let destroyed = false;
  let lastState: unknown;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const origin = 'https://www.youtube.com';
  const send = (message: object): void => {
    if (destroyed || !iframe.isConnected) return;
    iframe.contentWindow?.postMessage(JSON.stringify(message), origin);
  };
  const command = (func: string, args: unknown[] = []): void => send({ event: 'command', func, args });
  const applyVolume = (): void => {
    command('setVolume', [volume]);
    command(volume === 0 ? 'mute' : 'unMute');
  };
  const start = (): void => {
    send({ event: 'listening', id: iframe.id });
    command('playVideo');
    applyVolume();
  };
  const load = (): void => {
    timers.forEach(clearTimeout); timers.length = 0;
    lastState = undefined;
    start();
    // The iframe can load before its JS API. Each retry uses the latest volume.
    for (const delay of [400, 1000, 2000, 3500]) timers.push(setTimeout(start, delay));
  };
  const receive = (event: MessageEvent): void => {
    if (event.source !== iframe.contentWindow || event.origin !== origin || destroyed) return;
    let data: { event?: string; info?: unknown };
    try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch { return; }
    if (!data) return;
    const state = data.event === 'onStateChange' ? data.info
      : data.event === 'infoDelivery' ? (data.info as { playerState?: number } | undefined)?.playerState : undefined;
    if (data.event === 'onReady' || (state === 1 && lastState !== 1)) applyVolume();
    if (state !== undefined) lastState = state;
  };
  iframe.addEventListener('load', load);
  window.addEventListener('message', receive);
  return {
    setVolume(value) {
      volume = Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
      applyVolume();
    },
    destroy() {
      destroyed = true;
      timers.forEach(clearTimeout);
      iframe.removeEventListener('load', load);
      window.removeEventListener('message', receive);
    },
  };
}

export interface VimeoPlaybackController {
  setVolume(volume: number): void;
  destroy(): void;
}

/** Vimeo Player API: volume is 0–1 and muted is a separate boolean property. */
export function setupVimeoPlayback(iframe: HTMLIFrameElement, initialVolume = 0): VimeoPlaybackController {
  const origin = 'https://player.vimeo.com';
  let volume = Number.isFinite(initialVolume) ? Math.max(0, Math.min(100, initialVolume)) : 0;
  let destroyed = false;
  let ready = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const command = (method: string, value?: unknown): void => {
    if (destroyed || !iframe.isConnected) return;
    const message = value === undefined ? { method } : { method, value };
    iframe.contentWindow?.postMessage(message, origin);
  };
  const applyVolume = (): void => {
    command('setVolume', volume / 100);
    command('setMuted', volume === 0);
  };
  const start = (): void => {
    command('play');
    applyVolume();
  };
  const load = (): void => {
    timers.forEach(clearTimeout); timers.length = 0;
    ready = false;
    command('ping');
    start();
    for (const delay of [400, 1000, 2000, 3500]) timers.push(setTimeout(start, delay));
  };
  const receive = (event: MessageEvent): void => {
    if (destroyed || event.source !== iframe.contentWindow || event.origin !== origin) return;
    let data: { event?: string; method?: string } | null;
    try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch { return; }
    if (!data || typeof data !== 'object') return;
    if ((data.event === 'ready' || data.method === 'ping') && !ready) {
      ready = true;
      command('addEventListener', 'playing');
      start();
    }
    if (data.event === 'playing') {
      timers.forEach(clearTimeout); timers.length = 0;
      applyVolume();
    }
  };
  iframe.addEventListener('load', load);
  window.addEventListener('message', receive);
  return {
    setVolume(value) {
      volume = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
      applyVolume();
    },
    destroy() {
      destroyed = true;
      timers.forEach(clearTimeout);
      iframe.removeEventListener('load', load);
      window.removeEventListener('message', receive);
    },
  };
}

/**
 * VK video_ext: postMessage-протокол плеера публично НЕ задокументирован
 * (ни dev.vk.ru, ни открытые репозитории его не раскрывают). Шлём наиболее
 * вероятный VK-Open-API-формат {method:'play'}; если плеер ждёт иной — он молча
 * проигнорирует (без вреда). Точный формат можно снять логом message-событий от
 * плеера — тогда заменить здесь. origin '*' — плеер может жить на поддомене.
 */
export function setupVkPlayback(iframe: HTMLIFrameElement): void {
  nudgePlayback(iframe, '*', [
    { method: 'play' },
  ]);
}

export function detectBackgroundType(url: string): string {
  if (!url) return 'image';

  if (parseVideoUrl(url)) return 'embed';

  const lower = url.toLowerCase();
  if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov') || lower.endsWith('.ogg')) return 'video';
  if (lower.endsWith('.html') || lower.endsWith('.htm') || lower.includes('codepen.io/') || lower.includes('shadertoy.com/') || lower.includes('/index.html')) return 'web';
  if (lower.startsWith('data:')) return 'image';

  return 'image';
}
