import type { EmbedData, RutubeController } from '../types/index.js';

export type { EmbedData, RutubeController };

function youtubeEmbed(videoId: string): EmbedData {
  return {
    embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&showinfo=0&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&fs=0&playsinline=1`,
    platform: 'youtube',
    type: 'embed',
  };
}

function vkEmbed(oid: string, id: string, hash?: string | null): EmbedData {
  let embedUrl = `https://vkvideo.ru/video_ext.php?oid=${oid}&id=${id}&autoplay=1&mute=1&loop=1&controls=0`;
  if (hash) embedUrl += `&hash=${hash}`;
  return { embedUrl, platform: 'vk', type: 'embed' };
}

export function parseVideoUrl(url: string): EmbedData | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace('www.', '');
    const path = parsed.pathname;
    const params = parsed.searchParams;

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      let videoId = params.get('v');
      if (!videoId) {
        const embedMatch = path.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
        const shortsMatch = path.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
        videoId = embedMatch?.[1] ?? shortsMatch?.[1] ?? null;
      }
      if (videoId) return youtubeEmbed(videoId);
    }

    if (host === 'youtu.be') {
      const videoId = path.slice(1).split('/')[0];
      if (videoId && videoId.length === 11) return youtubeEmbed(videoId);
    }

    if (host === 'vk.com' || host === 'vk.ru' || host === 'm.vk.com' || host === 'vkvideo.ru') {
      const videoMatch = path.match(/\/(?:video|clip)(-?\d+_\d+)/);
      if (videoMatch) {
        const [oid, id] = videoMatch[1].split('_');
        return vkEmbed(oid, id);
      }
      if (path.includes('video_ext.php')) {
        const oid = params.get('oid');
        const id = params.get('id');
        if (oid && id) return vkEmbed(oid, id, params.get('hash'));
      }
    }

    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const vimeoMatch = path.match(/\/(?:video\/)?(\d+)/);
      if (vimeoMatch) {
        return {
          embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1&muted=1&loop=1&background=1&controls=0`,
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
      const parentHost = typeof window !== 'undefined' ? window.location.hostname : 'vk.com';

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

const RUTUBE_ORIGIN = 'https://rutube.ru';

export function setupRutubeControl(iframe: HTMLIFrameElement): RutubeController | null {
  if (!iframe || iframe.dataset.platform !== 'rutube') return null;

  let destroyed = false;
  const pendingTimers: ReturnType<typeof setTimeout>[] = [];

  const sendCommand = (type: string, data: Record<string, unknown> = {}): void => {
    if (destroyed) return;
    try {
      iframe.contentWindow?.postMessage(JSON.stringify({ type, data }), RUTUBE_ORIGIN);
    } catch { /* ignore */ }
  };

  const handler = (event: MessageEvent): void => {
    if (event.origin !== RUTUBE_ORIGIN) return;
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
  pendingTimers.push(setTimeout(() => sendCommand('player:play'), 1000));
  pendingTimers.push(setTimeout(() => sendCommand('player:play'), 3000));

  return {
    play: () => sendCommand('player:play'),
    pause: () => sendCommand('player:pause'),
    mute: () => sendCommand('player:mute'),
    unmute: () => sendCommand('player:unmute'),
    setVolume: (vol: number) => sendCommand('player:setVolume', { volume: vol }),
    seekTo: (time: number) => sendCommand('player:setCurrentTime', { time }),
    destroy: () => {
      destroyed = true;
      window.removeEventListener('message', handler);
      pendingTimers.forEach(clearTimeout);
    },
  };
}

export function detectBackgroundType(url: string): 'image' | 'video' | 'embed' | 'web' {
  if (!url) return 'image';

  if (parseVideoUrl(url)) return 'embed';

  const lower = url.toLowerCase();
  if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov') || lower.endsWith('.ogg')) return 'video';
  if (lower.endsWith('.html') || lower.endsWith('.htm') || lower.includes('codepen.io/') || lower.includes('shadertoy.com/') || lower.includes('/index.html')) return 'web';
  if (lower.startsWith('data:')) return 'image';

  return 'image';
}