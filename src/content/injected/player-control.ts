(function () {
  'use strict';

  type VKPlayerImpl = {
    setPlaybackRate?: (rate: number) => void;
    _currentAudioEl?: { audioElement?: HTMLAudioElement };
  };

  type VKPlayer = {
    _isPlaying?: boolean;
    _impl?: VKPlayerImpl;
    pause: () => void;
    play: () => void;
    playNext: () => void;
    playPrev: () => void;
    getCurrentAudio: () => unknown;
    seekCurrentAudio: (forward: boolean) => void;
    playPlaylist?: (id: number, index: number) => void;
  };

  type WindowWithPlayer = Window & {
    __vkifyPlayerControl?: boolean;
    ap?: VKPlayer;
    vk?: { id?: number };
  };

  const w = window as WindowWithPlayer;

  if (w.__vkifyPlayerControl) return;
  w.__vkifyPlayerControl = true;

  // ── Playback control ──────────────────────────────────────────────────────

  function togglePlayPause(): void {
    if (!w.ap) return;
    if (w.ap._isPlaying) {
      w.ap.pause();
    } else if (w.ap.getCurrentAudio()) {
      w.ap.play();
    } else if (w.ap.playPlaylist && w.vk?.id != null) {
      w.ap.playPlaylist(w.vk.id, -1);
    }
  }

  function next(): void    { w.ap?.playNext(); }
  function prev(): void    { w.ap?.playPrev(); }
  function seekFwd(): void { w.ap?.seekCurrentAudio(true); }
  function seekBwd(): void { w.ap?.seekCurrentAudio(false); }

  // ── Playback rate ─────────────────────────────────────────────────────────

  function getAudioEl(): HTMLAudioElement | null {
    return w.ap?._impl?._currentAudioEl?.audioElement
        ?? document.querySelector<HTMLAudioElement>('audio');
  }

  function setRate(rate: number): void {
    const clamped = Math.round(Math.min(3, Math.max(0.25, rate)) * 100) / 100;

    if (w.ap?._impl?.setPlaybackRate) {
      w.ap._impl.setPlaybackRate(clamped);
      return;
    }

    // fallback: direct element access
    const audio = getAudioEl();
    if (audio) audio.playbackRate = clamped;
  }

  function currentRate(): number {
    return getAudioEl()?.playbackRate ?? 1;
  }

  // ── Event bus ─────────────────────────────────────────────────────────────

  window.addEventListener('vkify:player:action', (e: Event) => {
    const { action } = (e as CustomEvent<{ action: string }>).detail;
    switch (action) {
      case 'play_pause':    togglePlayPause();             break;
      case 'next':          next();                        break;
      case 'prev':          prev();                        break;
      case 'seek_forward':  seekFwd();                     break;
      case 'seek_backward': seekBwd();                     break;
      case 'rate_up':       setRate(currentRate() + 0.25); break;
      case 'rate_down':     setRate(currentRate() - 0.25); break;
      case 'rate_reset':    setRate(1);                    break;
    }
  });
})();