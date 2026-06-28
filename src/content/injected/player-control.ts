(function () {
  'use strict';

  type VKPlayerImpl = {
    pause?:           (...args: unknown[]) => unknown;
    setPlaybackRate?: (rate: number) => void;
    setVolume?:       (vol: number) => void;
    _currentAudioEl?: { audioElement?: HTMLAudioElement };
  };

  type VKPlayer = {
    _isPlaying?:      boolean;
    _impl?:           VKPlayerImpl;
    pause:            () => void;
    play:             () => void;
    playNext:         () => void;
    playPrev:         () => void;
    getCurrentAudio:  () => unknown;
    getVolume?:       () => number;
    seekCurrentAudio: (forward: boolean) => void;
    playPlaylist?:    (id: number, index: number) => void;
  };

  type WindowWithPlayer = Window & {
    __vkifyPlayerControl?: boolean;
    ap?:    VKPlayer;
    audio?: VKPlayer;
    vk?:    { id?: number };
  };

  const w = window as WindowWithPlayer;

  if (w.__vkifyPlayerControl) return;
  w.__vkifyPlayerControl = true;

  // localStorage flag shared with the content-side feature
  // (src/content/features/center/player/autoplay.ts) — keep both in sync.
  // Namespaced so it can never collide with VK's own localStorage keys.
  const WAS_PLAYING_KEY = 'vkify:audio_was_playing';

  // ── Autoplay state ────────────────────────────────────────────────────────

  let autoplayEnabled      = false;
  let wasPlayingOnLoad      = false;
  let resumed              = false;   // already resumed after this page load
  let resumeAttempts       = 0;
  let trackingArmed        = false;
  let gestureFallbackArmed = false;
  let unloading            = false;   // page is being torn down (reload/navigate)
  let trackedMediaEl: HTMLMediaElement | null = null;

  // Live "is the music player currently playing" flag. Driven by VK's own
  // start_playback network call + the player element's pause/play events (see
  // armTracking), and persisted so the next page load's content-script can read
  // it at document_start.
  let isPlaying = false;

  const RESUME_RETRY_MS  = 250;
  const RESUME_MAX_TRIES = 48;   // ~12s waiting for VK to restore the track

  // ── Helpers ───────────────────────────────────────────────────────────────

  function getPlayer(): VKPlayer | null {
    return w.ap ?? w.audio ?? null;
  }

  // The <audio> element VK uses for the music player, when we can reach it.
  function getPlayerAudioEl(): HTMLAudioElement | null {
    return getPlayer()?._impl?._currentAudioEl?.audioElement ?? null;
  }

  function getAudioEl(): HTMLAudioElement | null {
    return getPlayerAudioEl() ?? document.querySelector<HTMLAudioElement>('audio');
  }

  // Ground truth for whether audio is actually producing sound right now — more
  // reliable than ap._isPlaying, which VK may set optimistically even when the
  // browser's autoplay policy silently rejected playback.
  function reallyPlaying(): boolean {
    const el = getAudioEl();
    if (el) return !el.paused;
    return !!getPlayer()?._isPlaying;
  }

  // ── Playback controls ─────────────────────────────────────────────────────

  function togglePlayPause(): void {
    const ap = getPlayer();
    if (!ap) return;
    if (ap._isPlaying) {
      ap.pause();
    } else if (ap.getCurrentAudio()) {
      ap.play();
    } else if (ap.playPlaylist && w.vk?.id != null) {
      ap.playPlaylist(w.vk.id, -1);
    }
  }

  function next(): void    { getPlayer()?.playNext(); }
  function prev(): void    { getPlayer()?.playPrev(); }
  function seekFwd(): void { getPlayer()?.seekCurrentAudio(true); }
  function seekBwd(): void { getPlayer()?.seekCurrentAudio(false); }

  function setRate(rate: number): void {
    const clamped = Math.round(Math.min(3, Math.max(0.25, rate)) * 100) / 100;
    const ap = getPlayer();
    if (ap?._impl?.setPlaybackRate) {
      ap._impl.setPlaybackRate(clamped);
      return;
    }
    const audio = getAudioEl();
    if (audio) audio.playbackRate = clamped;
  }

  function currentRate(): number {
    return getAudioEl()?.playbackRate ?? 1;
  }

  // ── Playing-state tracking ─────────────────────────────────────────────────
  //
  // Knowing whether the *music player* (not a feed video, not a voice message)
  // is playing is the crux of the feature. VK POSTs al_audio.php?act=start_playback
  // whenever a track starts — a signal specific to the audio player that fires no
  // matter how VK renders the audio (MSE/HLS/<audio>/<video>). We treat that as
  // the authoritative "playing" signal, then track pause/stop on the player's own
  // media element. isPlaying is mirrored to localStorage for the next page load.

  function persistPlayingState(): void {
    if (!autoplayEnabled) return;
    try { localStorage.setItem(WAS_PLAYING_KEY, isPlaying ? 'true' : 'false'); } catch {}
  }

  function onMusicPlay(): void { isPlaying = true; persistPlayingState(); }
  function onMusicStop(): void {
    // Ignore the pause the browser fires while tearing the page down — the saved
    // state must reflect what was playing at the moment of reload.
    if (unloading) return;
    isPlaying = false;
    persistPlayingState();
  }

  // Track pause/play on the music player's own media element (the one VK exposes
  // via ap._impl._currentAudioEl). Idempotent across calls.
  function watchMusicEl(el: HTMLMediaElement | null | undefined): void {
    if (!el || el === trackedMediaEl) return;
    trackedMediaEl = el;
    if (!el.paused) isPlaying = true;
    el.addEventListener('play',  onMusicPlay);
    el.addEventListener('pause', onMusicStop);
    el.addEventListener('ended', onMusicStop);
  }

  function onPlaybackStarted(): void {
    isPlaying = true;
    persistPlayingState();
    console.log('[VKify] autoplay: start_playback detected → isPlaying = true');
    // VK has the current element by now; grab it for pause tracking (retry once
    // in case it gets attached a tick later).
    watchMusicEl(getPlayerAudioEl());
    if (!trackedMediaEl) setTimeout(() => watchMusicEl(getPlayerAudioEl()), 300);
  }

  // Intercept VK's audio AJAX to catch playback starts. al_*.php calls go through
  // XMLHttpRequest; fetch is patched too for safety. Both are transparent —
  // our logic is wrapped in try/catch and always delegates to the original.
  function hookAudioNetwork(): void {
    const isStart = (u: string): boolean =>
      u.indexOf('al_audio.php') !== -1 && u.indexOf('act=start_playback') !== -1;

    const xhrProto = XMLHttpRequest.prototype;
    const rawOpen  = xhrProto.open;
    if (typeof rawOpen === 'function' && !(rawOpen as { __vkify?: boolean }).__vkify) {
      const patched = function (this: XMLHttpRequest, ...args: Parameters<XMLHttpRequest['open']>): void {
        try {
          const url = args[1];
          if (isStart(typeof url === 'string' ? url : url.href)) onPlaybackStarted();
        } catch {}
        rawOpen.apply(this, args);
      };
      (patched as { __vkify?: boolean }).__vkify = true;
      xhrProto.open = patched as typeof xhrProto.open;
    }

    const rawFetch = window.fetch;
    if (typeof rawFetch === 'function' && !(rawFetch as { __vkify?: boolean }).__vkify) {
      const patched = function (this: typeof window, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        try {
          const url = typeof input === 'string' ? input
                    : input instanceof URL     ? input.href
                    : input.url;
          if (isStart(url)) onPlaybackStarted();
        } catch {}
        return rawFetch.call(this, input, init);
      };
      (patched as { __vkify?: boolean }).__vkify = true;
      window.fetch = patched;
    }
  }

  function armTracking(): void {
    if (trackingArmed) return;
    trackingArmed = true;

    hookAudioNetwork();

    // Already playing when we attach (feature toggled on mid-playback)?
    const el = getPlayerAudioEl();
    if (el && !el.paused) { isPlaying = true; watchMusicEl(el); }

    // Запоминаем «играло перед уходом» и фиксируем флаг unloading КАК МОЖНО РАНЬШЕ.
    // Критично: при перезагрузке браузер ставит медиа на паузу во время teardown и
    // шлёт 'pause' на элемент. Если это происходит ДО pagehide, onMusicStop успевал
    // записать wasPlaying=false → следующая загрузка не возобновляла воспроизведение
    // («не всегда срабатывает»). beforeunload приходит раньше teardown-паузы и на
    // reload/навигации закрывает гонку; pagehide — запасной вариант.
    const markUnloading = (): void => {
      unloading = true;
      persistPlayingState();
    };
    window.addEventListener('beforeunload', markUnloading);
    window.addEventListener('pagehide', markUnloading);
    // Возврат из bfcache (назад/вперёд): страница оживает без перезапуска скрипта —
    // снимаем флаг, иначе настоящие паузы перестали бы фиксироваться.
    window.addEventListener('pageshow', () => { unloading = false; });
  }

  // ── Resume after reload ────────────────────────────────────────────────────

  function tryResume(): void {
    if (!autoplayEnabled || !wasPlayingOnLoad || resumed) return;
    // Don't fight the browser in a background tab — retry when it's focused.
    if (document.visibilityState !== 'visible') return;

    const ap    = getPlayer();
    const ready = !!ap && !!ap.getCurrentAudio();

    // Poll until VK has finished restoring the previous track into the player.
    if (!ready && resumeAttempts < RESUME_MAX_TRIES) {
      resumeAttempts++;
      setTimeout(tryResume, RESUME_RETRY_MS);
      return;
    }

    if (!ap) {
      console.log('[VKify] autoplay: gave up — window.ap never appeared');
      return;
    }
    resumed = true;
    console.log('[VKify] autoplay: resuming — getCurrentAudio:', !!ap.getCurrentAudio(),
                'after', resumeAttempts, 'tries');
    if (reallyPlaying()) return;
    playViaAp(3);
  }

  // Resume by handing control to VK's own play(), which also updates its UI.
  // Retries a few times in case the track is still loading, then falls back to
  // a user-gesture handler if the autoplay policy is blocking us.
  function playViaAp(retriesLeft: number): void {
    const ap = getPlayer();
    if (!ap || reallyPlaying()) return;

    console.log('[VKify] autoplay: calling ap.play() — retriesLeft:', retriesLeft);
    try { ap.play(); } catch (err) { console.log('[VKify] autoplay: ap.play() threw', err); }

    setTimeout(() => {
      if (reallyPlaying()) {
        console.log('[VKify] autoplay: started ✓');
        return;                                 // success
      }
      if (retriesLeft > 0) {
        playViaAp(retriesLeft - 1);             // probably still loading
      } else {
        console.log('[VKify] autoplay: still silent — arming gesture fallback (autoplay policy?)');
        armGestureFallback();                   // probably autoplay-policy blocked
      }
    }, 600);
  }

  // After a reload there's no user gesture, so Chrome/Firefox may silently
  // reject programmatic play(). Resume on the first interaction instead.
  function armGestureFallback(): void {
    if (gestureFallbackArmed) return;
    gestureFallbackArmed = true;

    const resume = (): void => {
      cleanup();
      const ap = getPlayer();
      if (!autoplayEnabled || !ap || reallyPlaying()) return;
      try { ap.play(); } catch {}
    };
    const cleanup = (): void => {
      gestureFallbackArmed = false;
      document.removeEventListener('pointerdown', resume, true);
      document.removeEventListener('keydown',     resume, true);
    };

    document.addEventListener('pointerdown', resume, true);
    document.addEventListener('keydown',     resume, true);
  }

  // ── Autoplay enable / disable ─────────────────────────────────────────────

  function enableAutoplay(wasPlaying: boolean): void {
    autoplayEnabled  = true;
    wasPlayingOnLoad = wasPlaying;
    console.log('[VKify] autoplay: enabled, wasPlaying =', wasPlaying);
    armTracking();
    if (wasPlaying) {
      resumeAttempts = 0;
      tryResume();
    }
  }

  function disableAutoplay(): void {
    autoplayEnabled = false;
    // Clear the flag, otherwise a later reload would resume after the user
    // turned the feature off.
    try { localStorage.removeItem(WAS_PLAYING_KEY); } catch {}
  }

  // The tab may have been reloaded in the background; resume once it's focused.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (!autoplayEnabled || !wasPlayingOnLoad || resumed) return;
    resumeAttempts = 0;
    tryResume();
  });

  // ── Event bus ─────────────────────────────────────────────────────────────

  window.addEventListener('vkify:player:action', (e: Event) => {
    const { action } = (e as CustomEvent<{ action: string }>).detail;
    switch (action) {
      case 'play_pause':    togglePlayPause();              break;
      case 'next':          next();                         break;
      case 'prev':          prev();                         break;
      case 'seek_forward':  seekFwd();                      break;
      case 'seek_backward': seekBwd();                      break;
      case 'rate_up':       setRate(currentRate() + 0.25); break;
      case 'rate_down':     setRate(currentRate() - 0.25); break;
      case 'rate_reset':    setRate(1);                     break;
    }
  });

  window.addEventListener('vkify:player:autoplay', (e: Event) => {
    const { enabled, wasPlaying } = (e as CustomEvent<{ enabled: boolean; wasPlaying: boolean }>).detail;
    if (enabled) enableAutoplay(wasPlaying ?? false);
    else disableAutoplay();
  });

  window.dispatchEvent(new CustomEvent('vkify-script-ready', {
    detail: { name: 'player-control' },
  }));
})();
