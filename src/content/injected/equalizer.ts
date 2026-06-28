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
  const wired = new WeakMap<AudioEl, MediaElementAudioSourceNode>();
  let currentEl: AudioEl | null = null;

  // Желаемое состояние (из настроек расширения).
  let enabled = false;
  let preampDb = 0;
  let bands: number[] = new Array(FREQS.length).fill(0);

  function dbToGain(db: number): number {
    return Math.pow(10, db / 20);
  }

  function getPlayerEl(): HTMLAudioElement | null {
    return (
      w.ap?._impl?._currentAudioEl?.audioElement ??
      w.audio?._impl?._currentAudioEl?.audioElement ??
      document.querySelector<HTMLAudioElement>('audio')
    );
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

  // Подключить текущий элемент VK к графу (идемпотентно на элемент).
  function wireElement(el: AudioEl): void {
    if (!ensureContext() || !ctx || !preamp) return;

    let src = wired.get(el);
    if (!src) {
      try {
        src = ctx.createMediaElementSource(el);
      } catch (err) {
        // Элемент уже перехвачен кем-то ещё или невалиден — выходим, не ломая звук.
        console.warn('[VKify] equalizer: createMediaElementSource failed', err);
        return;
      }
      wired.set(el, src);
    }

    // Сменился трек/элемент — отцепим предыдущий источник от графа.
    if (currentEl && currentEl !== el) {
      const prev = wired.get(currentEl);
      try { prev?.disconnect(preamp); } catch {}
    }
    try { src.connect(preamp); } catch {}
    currentEl = el;
  }

  // Привязаться к актуальному элементу плеера и применить значения.
  function attachAndApply(): void {
    if (!enabled) return;
    if (!ensureContext()) return;
    void ctx?.resume?.();        // автоплей-политика могла подвесить контекст
    const el = getPlayerEl();
    if (el) wireElement(el);
    applyValues();
  }

  // ── Привязка к элементу плеера с ретраями ──────────────────────────────────
  //
  // После перезагрузки страницы window.ap и его <audio> восстанавливаются VK
  // АСИНХРОННО, и в момент vkify:equalizer:update элемента ещё может не быть, а
  // событие 'playing'/'loadeddata' могло уйти ДО навешивания слушателей этого
  // скрипта (кэшированный трек стартует быстро). Из-за этого до перезагрузки EQ
  // срабатывал, а после — «50 на 50». Чиним коротким опросом getPlayerEl(),
  // пока элемент не появится и не будет привязан к графу.
  const RETRY_MS = 250;
  const RETRY_MAX = 40;        // ~10 c — успеть поймать восстановление плеера
  let wireTimer: number | undefined;
  let wireTries = 0;

  function stopWireRetry(): void {
    if (wireTimer !== undefined) { clearTimeout(wireTimer); wireTimer = undefined; }
    wireTries = 0;
  }

  function wiredToCurrent(): boolean {
    const el = getPlayerEl();
    return !!el && currentEl === el && wired.has(el);
  }

  function scheduleWireRetry(): void {
    stopWireRetry();
    const tick = (): void => {
      wireTimer = undefined;
      if (!enabled) return;
      attachAndApply();
      if (wiredToCurrent() || wireTries >= RETRY_MAX) return;
      wireTries++;
      wireTimer = window.setTimeout(tick, RETRY_MS);
    };
    tick();
  }

  // AudioContext, созданный без пользовательского жеста, стартует suspended, и
  // resume() без жеста может не сработать. Возобновляем на первом взаимодействии
  // и до-привязываем элемент (на случай, если он появился позже).
  let gestureArmed = false;
  function armGestureResume(): void {
    if (gestureArmed) return;
    gestureArmed = true;
    const onGesture = (): void => {
      void ctx?.resume?.().then(() => {
        if (ctx?.state === 'running') {
          cleanup();
          if (enabled) scheduleWireRetry();
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

  // VK создаёт новый <audio> на трек → ловим старт воспроизведения любого медиа
  // в фазе capture (media-события не всплывают, но проходят capture на document)
  // и переподключаем граф к актуальному элементу.
  function onMediaActivity(e: Event): void {
    if (!enabled) return;
    const t = e.target;
    if (!(t instanceof HTMLMediaElement)) return;

    // Привязываем элемент, который РЕАЛЬНО зазвучал. На смене трека VK создаёт
    // новый <audio> и ненадолго отстаёт с обновлением ap._currentAudioEl, поэтому
    // опираться только на getPlayerEl() нельзя — иначе EQ оживает лишь после того,
    // как тронешь настройку (она шлёт update и пере-привязывает граф). Решение:
    //   • 'playing' (элемент зазвучал) → берём САМ элемент, если это <audio>
    //     (музыка), а не <video> ленты/клипов — независимо от лага ap;
    //   • 'loadeddata' → только если это уже актуальный элемент плеера, чтобы не
    //     схватить предзагруженный следующий трек.
    const el = getPlayerEl();
    if ((e.type === 'playing' && t.tagName === 'AUDIO') || t === el) {
      wireElement(t);
      applyValues();
    }
  }
  document.addEventListener('playing', onMediaActivity, true);
  document.addEventListener('loadeddata', onMediaActivity, true);

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
      scheduleWireRetry();       // опрос вместо одного attachAndApply (см. выше)
    } else {
      stopWireRetry();
      applyValues();             // прозрачный проброс (граф не рвём — см. шапку)
    }
  });

  window.dispatchEvent(new CustomEvent('vkify-script-ready', {
    detail: { name: 'equalizer' },
  }));
})();
