import { getPlayerMedia } from './utils/player-media.js';

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
    play:             () => void | Promise<unknown>;
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
  // Сохранённая позиция последнего трека — страховка на случай, если VK сам её не
  // восстановит после перезагрузки. Перематываем ТОЛЬКО когда VK не восстановил.
  const POS_KEY = 'vkify:audio_pos';

  // ── Autoplay state ────────────────────────────────────────────────────────

  let autoplayEnabled      = false;
  let wasPlayingOnLoad      = false;
  let resumed              = false;   // already resumed after this page load
  let resumeAttempts       = 0;
  let trackingArmed        = false;
  let gestureFallbackArmed = false;
  let unloading            = false;   // page is being torn down (reload/navigate)
  let trackedMediaEl: HTMLMediaElement | null = null;
  let cancelGestureFallback: (() => void) | null = null;
  let trackingTimer: number | undefined;
  let resumeTimer: number | undefined;
  let playTimer: number | undefined;
  let playbackConfirmed = false;
  let lastMediaTime = 0;
  let autoplayBlocked = false;
  const pendingMediaPlays = new WeakSet<HTMLMediaElement>();

  // Состояние реального media-элемента, сохраняемое для следующей загрузки.
  let isPlaying = false;
  let lastPosSave = 0;

  const RESUME_RETRY_MS  = 250;
  const RESUME_MAX_TRIES = 48;   // ~12s waiting for VK to restore the track

  // ── Helpers ───────────────────────────────────────────────────────────────

  function getPlayer(): VKPlayer | null {
    return w.ap ?? w.audio ?? null;
  }

  // The <audio> element VK uses for the music player, when we can reach it.
  function getPlayerAudioEl(): HTMLMediaElement | null {
    return getPlayerMedia(w.ap) ?? getPlayerMedia(w.audio);
  }

  function getAudioEl(): HTMLMediaElement | null {
    return getPlayerAudioEl() ?? document.querySelector<HTMLAudioElement>('audio');
  }

  // paused=false бывает и во время ожидания данных. Успех подтверждается
  // событием playing, выполненным play() или продвижением currentTime.
  function reallyPlaying(): boolean {
    const el = getPlayerAudioEl();
    return !!el && el === trackedMediaEl && playbackConfirmed
      && !el.paused && !el.ended && !el.seeking
      && el.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA;
  }

  // ── Сохранение/восстановление позиции (страховка поверх VK) ─────────────────
  // id текущего трека из ap.getCurrentAudio() (возвращает кортеж [id, owner, …]).
  function currentTrackId(): string | null {
    const cur = getPlayer()?.getCurrentAudio?.() as unknown;
    if (Array.isArray(cur) && cur.length >= 2) return `${cur[0]}_${cur[1]}`;
    return null;
  }

  function savePos(force = false): void {
    if (!autoplayEnabled) return;
    const el = getAudioEl();
    const id = currentTrackId();
    if (!el || !id) return;
    const now = Date.now();
    if (!force && now - lastPosSave < 5000) return;   // троттлинг timeupdate (~4 Гц)
    lastPosSave = now;
    const t = el.currentTime;
    if (t > 2 && (!el.duration || t < el.duration - 2)) {
      try { localStorage.setItem(POS_KEY, JSON.stringify({ id, t })); } catch {}
    }
  }

  // Перематываем ТОЛЬКО если VK не восстановил позицию сам (трек в начале) и у нас
  // есть свежая сохранённая для ЭТОГО же трека — иначе не трогаем удачный restore VK.
  function restorePos(): void {
    const el = getAudioEl();
    const id = currentTrackId();
    if (!el || !id || el.currentTime >= 2) return;
    try {
      const saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null') as { id: string; t: number } | null;
      if (saved && saved.id === id && saved.t > 2 && (!el.duration || saved.t < el.duration - 2)) {
        el.currentTime = saved.t;
        if (el === trackedMediaEl) lastMediaTime = el.currentTime;
      }
    } catch {}
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
  // Следим за текущим media-элементом VK, включая detached-элемент нового
  // плеера. Сетевой запрос лишь ускоряет обнаружение; состояние берём из media.

  function persistPlayingState(): void {
    if (!autoplayEnabled) return;
    try { localStorage.setItem(WAS_PLAYING_KEY, isPlaying ? 'true' : 'false'); } catch {}
  }

  function onMusicPlay(): void {
    const el = getPlayerAudioEl();
    if (!el || el !== trackedMediaEl || el.paused || el.ended || el.seeking
      || el.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) return;
    playbackConfirmed = true;
    autoplayBlocked = false;
    isPlaying = true;
    resumed = true;
    clearTimeout(playTimer);
    clearTimeout(resumeTimer);
    cancelGestureFallback?.();
    persistPlayingState();
  }
  function onMusicStop(): void {
    // Ignore the pause the browser fires while tearing the page down — the saved
    // state must reflect what was playing at the moment of reload.
    if (unloading) return;
    playbackConfirmed = false;
    isPlaying = false;
    persistPlayingState();
  }

  // Track pause/play on the music player's own media element (the one VK exposes
  // via the current node or legacy _currentAudioEl). Idempotent across calls.
  function watchMusicEl(el: HTMLMediaElement | null | undefined): void {
    if (el === trackedMediaEl) return;
    if (trackedMediaEl) {
      trackedMediaEl.removeEventListener('playing', onMusicPlay);
      trackedMediaEl.removeEventListener('pause', onMusicStop);
      trackedMediaEl.removeEventListener('ended', onMusicStop);
      trackedMediaEl.removeEventListener('timeupdate', onMusicTimeUpdate);
      trackedMediaEl.removeEventListener('loadedmetadata', onMediaReady);
      trackedMediaEl.removeEventListener('canplay', onMediaReady);
    }
    trackedMediaEl = el ?? null;
    playbackConfirmed = false;
    lastMediaTime = el?.currentTime ?? 0;
    if (!el) return;
    el.addEventListener('playing', onMusicPlay);
    el.addEventListener('pause', onMusicStop);
    el.addEventListener('ended', onMusicStop);
    el.addEventListener('timeupdate', onMusicTimeUpdate);
    el.addEventListener('loadedmetadata', onMediaReady);
    el.addEventListener('canplay', onMediaReady);
  }

  function observeProgress(): void {
    const el = trackedMediaEl;
    if (!el) return;
    if (!el.seeking && el.currentTime > lastMediaTime) onMusicPlay();
    lastMediaTime = el.currentTime;
  }

  function onMusicTimeUpdate(): void { observeProgress(); savePos(); }

  function onMediaReady(): void {
    if (!autoplayEnabled || !wasPlayingOnLoad || resumed || unloading || autoplayBlocked) return;
    restorePos();
    lastMediaTime = trackedMediaEl?.currentTime ?? 0;
    startMediaPlayback();
  }

  function syncMusicEl(): void {
    if (!autoplayEnabled || unloading) return;
    watchMusicEl(getPlayerAudioEl());
    observeProgress();
  }

  function onPlaybackStarted(): void {
    if (!autoplayEnabled) return;
    // Запрос VK означает попытку запуска, а не успешное воспроизведение.
    syncMusicEl();
    // VK has the current element by now; grab it for pause tracking (retry once
    // in case it gets attached a tick later).
    if (!trackedMediaEl) setTimeout(syncMusicEl, 300);
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
    syncMusicEl();

    // Запоминаем «играло перед уходом» и фиксируем флаг unloading КАК МОЖНО РАНЬШЕ.
    // Критично: при перезагрузке браузер ставит медиа на паузу во время teardown и
    // шлёт 'pause' на элемент. Если это происходит ДО pagehide, onMusicStop успевал
    // записать wasPlaying=false → следующая загрузка не возобновляла воспроизведение
    // («не всегда срабатывает»). beforeunload приходит раньше teardown-паузы и на
    // reload/навигации закрывает гонку; pagehide — запасной вариант.
    const markUnloading = (): void => {
      unloading = true;
      savePos(true);
      if (wasPlayingOnLoad && !resumed) isPlaying = true;
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
    const ready = !!ap?.getCurrentAudio?.();

    // Poll until VK has finished restoring the previous track into the player.
    if (!ready && resumeAttempts < RESUME_MAX_TRIES) {
      resumeAttempts++;
      clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(tryResume, RESUME_RETRY_MS);
      return;
    }

    if (!ap || !ready) {
      armGestureFallback();
      return;
    }
    console.log('[VKify] autoplay: resuming — getCurrentAudio:', !!ap.getCurrentAudio(),
                'after', resumeAttempts, 'tries');
    if (reallyPlaying()) { onMusicPlay(); return; }
    restorePos();           // если VK не восстановил позицию — вернём сами
    // Армим жест-фолбэк СРАЗУ: ap.play() после reload почти всегда блокируется
    // autoplay-политикой, и пользователь жмёт play в первые же мгновения. Если
    // вешать фолбэк только после ~2.4 c неудачных ретраев, этот первый клик
    // пропадал впустую → «не всегда запускается». Теперь первый клик возобновляет.
    armGestureFallback();
    playViaAp(3);
  }

  // VK может лишь переключить свой UI или пропустить повторный play() из-за
  // оптимистичного _isPlaying. Запускаем тот же подготовленный media-элемент;
  // URL, HLS/MSE, громкость и выбор трека остаются под управлением VK.
  function startMediaPlayback(): void {
    if (!autoplayEnabled || resumed || unloading || autoplayBlocked) return;
    const el = getPlayerAudioEl();
    if (!el || pendingMediaPlays.has(el) || (!el.currentSrc && !el.src && !el.srcObject)) return;
    watchMusicEl(el);
    pendingMediaPlays.add(el);
    const failed = (error: unknown): void => {
      if (!autoplayEnabled || resumed || el !== getPlayerAudioEl()) return;
      if (error && typeof error === 'object' && 'name' in error && error.name === 'NotAllowedError') {
        autoplayBlocked = true;
        clearTimeout(playTimer);
      }
      armGestureFallback();
    };
    try {
      // Вызываем синхронно: при жесте нельзя потерять user activation на await.
      void el.play().then(() => {
        if (autoplayEnabled && el === getPlayerAudioEl()) onMusicPlay();
      }).catch(failed).finally(() => { pendingMediaPlays.delete(el); });
    } catch (error) {
      pendingMediaPlays.delete(el);
      failed(error);
    }
  }

  // Resume by handing control to VK's own play(), which also updates its UI.
  // Retries a few times in case the track is still loading, then falls back to
  // a user-gesture handler if the autoplay policy is blocking us.
  function playViaAp(retriesLeft: number): void {
    if (!autoplayEnabled || resumed || unloading || autoplayBlocked) return;
    const ap = getPlayer();
    if (!ap?.getCurrentAudio?.()) return;
    if (reallyPlaying()) { onMusicPlay(); return; }
    watchMusicEl(getPlayerAudioEl());

    console.log('[VKify] autoplay: calling ap.play() — retriesLeft:', retriesLeft);
    const el = getPlayerAudioEl();
    // Не перезапускаем загрузку VK, пока native play() ждёт данные.
    if (!el || !pendingMediaPlays.has(el)) {
      try {
        void Promise.resolve(ap.play()).catch(() => {
          if (autoplayEnabled && !resumed) armGestureFallback();
        });
      } catch { armGestureFallback(); }
      startMediaPlayback();
    }

    clearTimeout(playTimer);
    playTimer = window.setTimeout(() => {
      if (!autoplayEnabled || resumed || unloading) return;
      if (reallyPlaying()) {
        onMusicPlay();
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
    if (!autoplayEnabled || resumed || gestureFallbackArmed) return;
    gestureFallbackArmed = true;

    // После обработчика VK: capture pointerdown запускал трек до его click,
    // после чего кнопка VK могла тут же поставить музыку обратно на паузу.
    const events = ['click', 'keydown'];
    const resume = (event: Event): void => {
      if (!event.isTrusted || navigator.userActivation?.isActive === false) return;
      const ap = getPlayer();
      if (!autoplayEnabled || !ap?.getCurrentAudio?.()) return;
      if (reallyPlaying()) { onMusicPlay(); return; }
      autoplayBlocked = false;
      restorePos();
      playViaAp(0);
    };
    const cleanup = (): void => {
      gestureFallbackArmed = false;
      for (const name of events) document.removeEventListener(name, resume);
      cancelGestureFallback = null;
    };

    cancelGestureFallback = cleanup;
    for (const name of events) document.addEventListener(name, resume);
  }

  // ── Autoplay enable / disable ─────────────────────────────────────────────

  function enableAutoplay(wasPlaying: boolean): void {
    autoplayEnabled  = true;
    autoplayBlocked = false;
    wasPlayingOnLoad = wasPlaying;
    console.log('[VKify] autoplay: enabled, wasPlaying =', wasPlaying);
    armTracking();
    syncMusicEl();
    if (trackingTimer === undefined) trackingTimer = window.setInterval(syncMusicEl, 500);
    if (wasPlaying) {
      armGestureFallback();
      resumeAttempts = 0;
      tryResume();
    }
  }

  function disableAutoplay(): void {
    autoplayEnabled = false;
    clearTimeout(resumeTimer);
    clearTimeout(playTimer);
    clearInterval(trackingTimer);
    trackingTimer = undefined;
    cancelGestureFallback?.();
    watchMusicEl(null);
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
