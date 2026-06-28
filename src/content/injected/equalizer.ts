(function () {
  'use strict';

  // ── Page-world DSP эквалайзера ──────────────────────────────────────────────
  //
  // Живёт в МИРЕ СТРАНИЦЫ (как player-control.ts), потому что <audio> принадлежит
  // VK и достаётся через window.ap. Строит Web Audio граф:
  //
  //   MediaElementSource(audioEl) → preamp(Gain) → band0..band9(Biquad) → destination
  //
  // band0 (31Hz) = lowshelf, band9 (16kHz) = highshelf, остальные = peaking.
  // gain полос — в dB напрямую (Biquad), преамп — линейный (Gain), 10^(dB/20).
  //
  // ВАЖНО про createMediaElementSource: вызывается на элемент РОВНО ОДИН РАЗ и
  // НЕОБРАТИМО перехватывает его вывод (после этого звук элемента идёт только
  // через граф). Поэтому:
  //   • AudioContext создаётся ЛЕНИВО — только при первом включении (нулевой
  //     overhead, пока фичу не трогали);
  //   • «выключение» НЕ рвёт граф (это оглушило бы трек), а делает граф
  //     ПРОЗРАЧНЫМ: преамп=1, все полосы=0 → исходный звук без изменений;
  //   • уже подключённые элементы помним в WeakMap, чтобы при смене трека не
  //     звать createMediaElementSource повторно (иначе InvalidStateError).

  // Частоты полос — ДОЛЖНЫ совпадать с EQ_FREQUENCIES в
  // features/center/player/equalizer/presets.ts.
  const FREQS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

  type AudioEl = HTMLMediaElement;
  type VKPlayerImpl = { _currentAudioEl?: { audioElement?: HTMLAudioElement } };
  type VKPlayer = { _impl?: VKPlayerImpl };
  type WindowWithEq = Window & {
    __vkifyEqualizer?: boolean;
    ap?: VKPlayer;
    audio?: VKPlayer;
    webkitAudioContext?: typeof AudioContext;
  };

  const w = window as WindowWithEq;
  if (w.__vkifyEqualizer) return;
  w.__vkifyEqualizer = true;

  let ctx: AudioContext | null = null;
  let preamp: GainNode | null = null;
  let filters: BiquadFilterNode[] = [];
  // Один source на элемент (createMediaElementSource необратим и одноразов).
  const wired = new WeakMap<AudioEl, MediaElementAudioSourceNode>();
  // Какие элементы сейчас подключены к preamp (чтобы не дублировать connect и
  // корректно отключать остановленные).
  const connected = new WeakSet<AudioEl>();
  // Элементы, на которых createMediaElementSource бросил (перехвачены кем-то ещё)
  // — больше не пытаемся, иначе спам/исключения на каждом timeupdate.
  const failed = new WeakSet<AudioEl>();
  let currentEl: AudioEl | null = null;

  // Желаемое состояние (из настроек расширения).
  let enabled = false;
  let preampDb = 0;
  let bands: number[] = new Array(FREQS.length).fill(0);

  function dbToGain(db: number): number {
    return Math.pow(10, db / 20);
  }

  // Актуальный элемент музыкального плеера. Приоритет — то, что VK считает
  // текущим (ap._currentAudioEl); фолбэк — реально играющий <audio> в DOM, иначе
  // первый <audio>. Видео ленты/клипов сюда не попадают.
  function getActiveAudio(): HTMLAudioElement | null {
    const fromAp =
      w.ap?._impl?._currentAudioEl?.audioElement ??
      w.audio?._impl?._currentAudioEl?.audioElement ??
      null;
    if (fromAp) return fromAp;
    const audios = Array.from(document.querySelectorAll<HTMLAudioElement>('audio'));
    return audios.find((a) => !a.paused) ?? audios[0] ?? null;
  }

  function ensureContext(): boolean {
    if (ctx) return true;
    const AC = window.AudioContext ?? w.webkitAudioContext;
    if (!AC) {
      console.warn('[VKify] equalizer: Web Audio API недоступен');
      return false;
    }
    ctx = new AC();
    preamp = ctx.createGain();
    filters = FREQS.map((freq, i) => {
      const f = ctx!.createBiquadFilter();
      f.type = i === 0 ? 'lowshelf' : i === FREQS.length - 1 ? 'highshelf' : 'peaking';
      f.frequency.value = freq;
      f.Q.value = 1.0;
      f.gain.value = 0;
      return f;
    });
    // preamp → f0 → … → fN → destination
    let node: AudioNode = preamp;
    for (const f of filters) { node.connect(f); node = f; }
    node.connect(ctx.destination);
    return true;
  }

  // Применить желаемые значения к узлам (или прозрачный проброс, если выключено).
  function applyValues(): void {
    if (!ctx || !preamp) return;
    if (enabled) {
      preamp.gain.value = dbToGain(preampDb);
      for (let i = 0; i < filters.length; i++) filters[i].gain.value = bands[i] ?? 0;
    } else {
      // Прозрачный граф: исходный звук без изменений.
      preamp.gain.value = 1;
      for (const f of filters) f.gain.value = 0;
    }
  }

  // ── Привязка элемента к графу ───────────────────────────────────────────────
  //
  // ЕДИНСТВЕННАЯ точка подключения. Никогда не рвёт активный звук: отключение
  // остановленных источников делается отдельно по pause/ended. Привязываем только
  // при running-контексте — иначе перехват играющего элемента в suspended-граф
  // даёт ТИШИНУ (после перезагрузки контекст suspended до первого жеста).
  function ensureWired(el: AudioEl | null): void {
    if (!enabled || !el) return;
    if (!ensureContext() || !ctx || !preamp) return;
    void ctx.resume?.();
    if (ctx.state !== 'running') return;   // не глушим: ждём жеста/следующего тика

    let src = wired.get(el);
    if (!src) {
      if (failed.has(el)) return;
      try {
        src = ctx.createMediaElementSource(el);
      } catch {
        // Элемент уже перехвачен (InvalidStateError) — помечаем и больше не пробуем.
        failed.add(el);
        return;
      }
      wired.set(el, src);
    }

    if (!connected.has(el)) {
      try { src.connect(preamp); connected.add(el); } catch {}
    }
    currentEl = el;
    applyValues();
  }

  // Отключить источник остановленного элемента от графа (гигиена + ограничение
  // роста). Безопасно: элемент уже не звучит; на следующем play переподключится.
  function unwireStopped(el: AudioEl): void {
    if (!preamp || !connected.has(el)) return;
    const src = wired.get(el);
    try { src?.disconnect(preamp); } catch {}
    connected.delete(el);
  }

  // ── Отслеживание элемента плеера ────────────────────────────────────────────
  //
  // КЛЮЧЕВОЕ: новый веб-плеер VK (web2, audioplayer-lib) держит свой медиа-элемент
  // ВНЕ DOM (создан через new Audio()/managed плеером), поэтому capture-слушатели
  // на document его событий НЕ получают — авто-привязка не срабатывала, а EQ
  // «оживал» лишь после касания Preamp (тот путь идёт через ap, а не через события
  // DOM). Поэтому опираемся на ap как на источник истины:
  //   • watchdog раз в 800 мс берёт getActiveAudio() и привязывает его — это ловит
  //     старт после перезагрузки и смену трека без участия пользователя;
  //   • слушатели вешаем ПРЯМО на элемент (срабатывают даже для detached-элемента)
  //     для мгновенной реакции и гигиены графа (pause/ended).
  function onElPlay(e: Event): void {
    const t = e.target;
    if (t instanceof HTMLMediaElement) ensureWired(t);
  }
  function onElStop(e: Event): void {
    const t = e.target;
    if (t instanceof HTMLMediaElement) unwireStopped(t);
  }
  const PLAY_EVENTS = ['loadedmetadata', 'play', 'playing', 'timeupdate'];
  const STOP_EVENTS = ['pause', 'ended'];
  let trackedEl: AudioEl | null = null;

  function attachTo(el: AudioEl): void {
    if (el === trackedEl) return;
    if (trackedEl) {
      for (const ev of PLAY_EVENTS) trackedEl.removeEventListener(ev, onElPlay);
      for (const ev of STOP_EVENTS) trackedEl.removeEventListener(ev, onElStop);
    }
    trackedEl = el;
    for (const ev of PLAY_EVENTS) el.addEventListener(ev, onElPlay);
    for (const ev of STOP_EVENTS) el.addEventListener(ev, onElStop);
  }

  function syncPlayer(): void {
    if (!enabled) return;
    const el = getActiveAudio();
    if (!el) return;
    attachTo(el);          // перевешиваем слушатели при смене элемента VK
    ensureWired(el);
  }

  let watchTimer: number | undefined;
  function startWatch(): void {
    if (watchTimer !== undefined) return;
    syncPlayer();
    watchTimer = window.setInterval(syncPlayer, 800);
  }
  function stopWatch(): void {
    if (watchTimer !== undefined) { clearInterval(watchTimer); watchTimer = undefined; }
  }

  // AudioContext без пользовательского жеста стартует suspended, resume() без
  // жеста может не сработать. Возобновляем на первом взаимодействии и привязываем.
  let gestureArmed = false;
  function armGestureResume(): void {
    if (gestureArmed) return;
    gestureArmed = true;
    const onGesture = (): void => {
      void ctx?.resume?.().then(() => {
        if (ctx?.state === 'running') {
          cleanup();
          syncPlayer();
        }
      }).catch(() => {});
    };
    const cleanup = (): void => {
      gestureArmed = false;
      document.removeEventListener('pointerdown', onGesture, true);
      document.removeEventListener('keydown', onGesture, true);
    };
    document.addEventListener('pointerdown', onGesture, true);
    document.addEventListener('keydown', onGesture, true);
  }

  // ── Шина настроек (content → page) ──────────────────────────────────────────
  window.addEventListener('vkify:equalizer:update', (e: Event) => {
    const d = (e as CustomEvent<{ enabled?: boolean; preamp?: number; bands?: number[] }>).detail || {};
    if (typeof d.enabled === 'boolean') enabled = d.enabled;
    if (typeof d.preamp === 'number' && Number.isFinite(d.preamp)) preampDb = d.preamp;
    if (Array.isArray(d.bands)) {
      bands = FREQS.map((_, i) => {
        const v = Number(d.bands![i]);
        return Number.isFinite(v) ? v : 0;
      });
    }

    if (enabled) {
      armGestureResume();
      startWatch();          // watchdog по ap + прямые слушатели держат привязку
    } else {
      stopWatch();
    }
    // Preamp/пресет/выкл меняют только gain-значения — граф не пере-привязываем.
    applyValues();
  });

  window.dispatchEvent(new CustomEvent('vkify-script-ready', {
    detail: { name: 'equalizer' },
  }));
})();
