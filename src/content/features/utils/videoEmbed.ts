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

    if (host === 'dailymotion.com' || host === 'dai.ly') {
      let videoId: string | undefined;
      if (host === 'dai.ly') {
        videoId = path.slice(1);
      } else {
        const dmMatch = path.match(/\/video\/([a-zA-Z0-9]+)/);
        videoId = dmMatch?.[1];
      }
      if (videoId) {
        return {
          embedUrl: `https://www.dailymotion.com/embed/video/${videoId}?autoplay=1&mute=1&controls=0&loop=1`,
          platform: 'dailymotion',
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

    if (host === 'twitch.tv' || host === 'clips.twitch.tv' || host === 'player.twitch.tv') {
      const parentHost = typeof window !== 'undefined' ? window.location.hostname : 'vk.ru';

      if (host === 'player.twitch.tv') {
        const videoId = params.get('video');
        const channel = params.get('channel');
        const clip = params.get('clip');
        if (videoId) return { embedUrl: `https://player.twitch.tv/?video=${videoId}&parent=${parentHost}&autoplay=true&muted=true&controls=false`, platform: 'twitch', type: 'embed' };
        if (channel) return { embedUrl: `https://player.twitch.tv/?channel=${channel}&parent=${parentHost}&autoplay=true&muted=true&controls=false`, platform: 'twitch', type: 'embed' };
        if (clip) return { embedUrl: `https://clips.twitch.tv/embed?clip=${clip}&parent=${parentHost}&autoplay=true&muted=true`, platform: 'twitch', type: 'embed' };
      }

      if (host === 'clips.twitch.tv') {
        const slug = path.slice(1);
        if (slug) return { embedUrl: `https://clips.twitch.tv/embed?clip=${slug}&parent=${parentHost}&autoplay=true&muted=true`, platform: 'twitch', type: 'embed' };
      }

      const channelClipMatch = path.match(/\/([a-zA-Z0-9_]+)\/clip\/([a-zA-Z0-9_-]+)/);
      if (channelClipMatch) return { embedUrl: `https://clips.twitch.tv/embed?clip=${channelClipMatch[2]}&parent=${parentHost}&autoplay=true&muted=true`, platform: 'twitch', type: 'embed' };

      const twitchVideoMatch = path.match(/\/videos\/(\d+)/);
      if (twitchVideoMatch) return { embedUrl: `https://player.twitch.tv/?video=${twitchVideoMatch[1]}&parent=${parentHost}&autoplay=true&muted=true&controls=false`, platform: 'twitch', type: 'embed' };

      const reserved = ['videos', 'directory', 'settings', 'downloads', 'search', 'subscriptions', 'inventory', 'wallet', 'drops', 'prime', 'notifications', 'friends', 'messages'];
      const channelMatch = path.match(/^\/([a-zA-Z0-9_]+)\/?$/);
      if (channelMatch && !reserved.includes(channelMatch[1])) {
        return { embedUrl: `https://player.twitch.tv/?channel=${channelMatch[1]}&parent=${parentHost}&autoplay=true&muted=true&controls=false`, platform: 'twitch', type: 'embed' };
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

/** YouTube IFrame API (требует enablejsapi=1 в embed-URL). */
export function setupYouTubePlayback(iframe: HTMLIFrameElement): void {
  nudgePlayback(iframe, 'https://www.youtube.com', [
    { event: 'listening' },                              // регистрируемся у плеера
    { event: 'command', func: 'mute', args: [] },
    { event: 'command', func: 'playVideo', args: [] },
  ]);
}

/** Vimeo Player API (требует api=1 в embed-URL); формат {method,value}. */
export function setupVimeoPlayback(iframe: HTMLIFrameElement): void {
  nudgePlayback(iframe, 'https://player.vimeo.com', [
    { method: 'setVolume', value: 0 },                   // muted для autoplay-политики
    { method: 'play' },
  ]);
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
