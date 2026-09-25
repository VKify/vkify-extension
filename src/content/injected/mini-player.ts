import { readNextTrack } from './utils/player-queue.js';
import { getPlayerMedia } from './utils/player-media.js';
import { tupleArtwork } from '@/shared/music-artwork.js';

/** Request/response only: disabling the widget leaves no polling in page-world. */
export function installMiniPlayerBridge(): void {
  type Player = {
    getCurrentAudio?: () => unknown;
    getNextAudio?: () => unknown;
    setVolume?: (value: number) => void;
    _impl?: { setVolume?: (value: number) => void; setPlaybackRate?: (value: number) => void };
  };
  const w = window as Window & { ap?: Player; audio?: Player };
  window.addEventListener('vkify:mini-player:request', () => {
    try {
      const player = w.ap ?? w.audio;
      const media = getPlayerMedia(player);
      const raw = player?.getCurrentAudio?.();
      const tuple = Array.isArray(raw) ? raw : null;
      const track = tuple && Number.isFinite(Number(tuple[0])) && Number.isFinite(Number(tuple[1])) ? {
        id: `${tuple[1]}_${tuple[0]}`, title: String(tuple[3] ?? '').slice(0, 500),
        artist: String(tuple[4] ?? '').slice(0, 500), cover: tupleArtwork(tuple),
      } : null;
      const nextTrack = readNextTrack(player, track?.id);
      window.dispatchEvent(new CustomEvent('vkify:mini-player:state', { detail: {
        nextTrack,
        track, playing: !!media && !media.paused && !media.ended,
        currentTime: media?.currentTime ?? 0,
        duration: Number.isFinite(media?.duration) ? media!.duration : Number(tuple?.[5]) || 0,
        volume: media ? (media.muted ? 0 : media.volume) : 1,
        rate: media?.playbackRate ?? 1, controllable: !!media,
      } }));
    } catch { /* VK can replace its player during navigation. */ }
  });
  window.addEventListener('vkify:mini-player:action', (event: Event) => {
    const data = (event as CustomEvent).detail;
    if (!data || typeof data.value !== 'number' || !Number.isFinite(data.value)) return;
    const player = w.ap ?? w.audio;
    const media = getPlayerMedia(player);
    if (!media) return;
    try {
      if (data.action === 'seek' && Number.isFinite(media.duration)) media.currentTime = Math.max(0, Math.min(media.duration, data.value));
      if (data.action === 'volume') {
        const value = Math.max(0, Math.min(1, data.value));
        if (player?.setVolume) player.setVolume(value);
        else player?._impl?.setVolume?.(value);
        media.volume = value; media.muted = value === 0;
      }
      if (data.action === 'rate') {
        const rate = Math.max(0.25, Math.min(3, Math.round(data.value * 4) / 4));
        player?._impl?.setPlaybackRate?.(rate); media.playbackRate = rate;
      }
    } catch { /* Unsupported/transient player state. */ }
  });
}
