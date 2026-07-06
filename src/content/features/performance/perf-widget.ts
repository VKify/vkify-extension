import type { FeatureContext } from '../../core/feature-context.js';
import type { FeatureMap } from '@/types/index.js';
import type { PerfWidgetPosition } from '@/shared/constants/perf.js';
import { createFloatingWidget, type FloatingWidgetHandle } from '../../ui/floating-widget.js';
import { sendMessage } from '@/shared/messaging.js';
import { t } from '@/content/i18n/index.js';

/**
 * PerfWidget — компактный плавающий мини-монитор производительности поверх vk.com.
 *
 * Весь «оконный» код (перетаскивание, стиль, сворачивание, закрытие,
 * позиционирование, z-index) живёт в общем `FloatingWidget` — здесь только
 * специфика монитора: метрики, их вёрстка и петли обновления.
 *
 * Данные: FPS считается локально (rAF), остальные метрики берутся из общего
 * снимка `GET_PERF_TELEMETRY` (тот же источник, что у дашборда) — так мутации
 * (domObserver) и API учитываются корректно, включая фоновые поллеры, которых
 * content-сборщик в одиночку не видит.
 *
 * Минимизация нагрузки: rAF-петля FPS и интервал обновления (1с) работают только
 * пока вкладка видима (`visibilitychange` ставит их на паузу) и пока фича
 * включена. Виджет существует только в content-скрипте vk.com.
 *
 * Позиция хранится в настройках (`perfWidgetPosition`), чтобы дашборд мог её
 * сбросить; состояние «свёрнут» — в localStorage (косметика, не настройка).
 */

const WIDGET_CSS_ID = 'vkify-perf-widget-css';
const COLLAPSED_KEY = 'vkify:perf-widget:collapsed';
const UPDATE_MS = 1000;
const SPARK_MAX = 60; // точек истории API-rate (≈60 c)
const SVG_NS = 'http://www.w3.org/2000/svg';

// Стили только для содержимого монитора; «оконные» стили даёт FloatingWidget.
const WIDGET_CSS = `
  .vkify-perf-body {
    padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 5px;
  }
  .vkify-perf-row { display: flex; align-items: center; justify-content: space-between; font-size: 11px; }
  .vkify-perf-row > span:first-child { color: var(--vkui--color_text_secondary, #818c99); }
  .vkify-perf-val { font-weight: 700; font-variant-numeric: tabular-nums; }
  .vkify-perf-spark { width: 100%; height: 30px; margin-top: 3px; color: var(--vkui--color_text_accent, #2688eb); display: block; }
  .vkify-perf-hint { font-size: 9px; color: var(--vkui--color_text_secondary, #818c99); text-align: center; margin-top: 1px; }
`;

function formatMB(bytes?: number): string {
  if (bytes == null || bytes <= 0) return t('perf.na');
  return t('perf.mb', { value: (bytes / (1024 * 1024)).toFixed(0) });
}

function ensureWidgetStyles(): void {
  if (document.getElementById(WIDGET_CSS_ID)) return;
  const s = document.createElement('style');
  s.id = WIDGET_CSS_ID;
  s.textContent = WIDGET_CSS;
  document.head.appendChild(s);
}

/** Спидометр из @vkontakte/icons (Icon20SpeedometerMaxOutline, упрощённый путь). */
function buildSpeedometer(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'width:15px;height:15px;flex-shrink:0;color:var(--vkui--color_text_accent,#2688eb)';
  const circle = document.createElementNS(SVG_NS, 'path');
  circle.setAttribute('d', 'M10 2.75a7.25 7.25 0 1 0 0 14.5 7.25 7.25 0 0 0 0-14.5Z');
  circle.setAttribute('stroke', 'currentColor');
  circle.setAttribute('stroke-width', '1.5');
  const needle = document.createElementNS(SVG_NS, 'path');
  needle.setAttribute('d', 'M10 10l3.2-3.2');
  needle.setAttribute('stroke', 'currentColor');
  needle.setAttribute('stroke-width', '1.5');
  needle.setAttribute('stroke-linecap', 'round');
  svg.append(circle, needle);
  return svg;
}

interface Refs {
  fps: HTMLElement; load: HTMLElement; features: HTMLElement;
  heavy: HTMLElement; observers: HTMLElement;
  api: HTMLElement; flushes: HTMLElement; heap: HTMLElement;
  spark: SVGPolylineElement;
}

function readCollapsed(): boolean {
  try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; }
}

/**
 * Фабрика фичи. Всё изменяемое состояние и хелперы живут в этом замыкании —
 * фабрику вызывают один раз при регистрации, так что это де-факто синглтон на
 * вкладку, но без глобальных модульных переменных.
 */
export function createPerfWidgetFeature(ctx: FeatureContext): FeatureMap {
  let widget: FloatingWidgetHandle | null = null;
  let refs: Refs | null = null;
  let rafId = 0;
  let intervalId = 0;
  let frames = 0;
  let lastFpsTs = 0;
  let fps = 0;
  let inFlight = false; // защита от наложения снимков, если ответ медленнее тика
  let running = false;
  let offStorage: (() => void) | null = null;
  let onVisibility: (() => void) | null = null;

  function fpsLoop(ts: number): void {
    frames++;
    if (!lastFpsTs) lastFpsTs = ts;
    const dt = ts - lastFpsTs;
    if (dt >= 1000) {
      fps = Math.round((frames * 1000) / dt);
      frames = 0;
      lastFpsTs = ts;
    }
    rafId = requestAnimationFrame(fpsLoop);
  }

  function buildRow(label: string): { row: HTMLElement; val: HTMLElement } {
    const row = document.createElement('div');
    row.className = 'vkify-perf-row';
    const l = document.createElement('span');
    l.textContent = label;
    const val = document.createElement('span');
    val.className = 'vkify-perf-val';
    val.textContent = '—';
    row.append(l, val);
    return { row, val };
  }

  /** Наполняет тело виджета метриками; возвращает ссылки на изменяемые ячейки. */
  function buildBody(body: HTMLElement): Refs {
    body.classList.add('vkify-perf-body');

    const fpsR = buildRow('FPS');
    const loadR = buildRow(t('perf.load'));
    const featR = buildRow(t('perf.features'));
    const heavyR = buildRow(t('perf.heavy'));
    const obsR = buildRow('Observers');
    const apiR = buildRow(t('perf.api'));
    const flushR = buildRow(t('perf.mutations'));
    const heapR = buildRow('Heap');

    const spark = document.createElementNS(SVG_NS, 'svg') as unknown as SVGSVGElement;
    spark.setAttribute('viewBox', '0 0 240 30');
    spark.setAttribute('preserveAspectRatio', 'none');
    spark.setAttribute('class', 'vkify-perf-spark');
    const poly = document.createElementNS(SVG_NS, 'polyline') as SVGPolylineElement;
    poly.setAttribute('fill', 'none');
    poly.setAttribute('stroke', 'currentColor');
    poly.setAttribute('stroke-width', '1.5');
    poly.setAttribute('stroke-linejoin', 'round');
    poly.setAttribute('stroke-linecap', 'round');
    poly.setAttribute('vector-effect', 'non-scaling-stroke');
    spark.appendChild(poly);

    const hint = document.createElement('div');
    hint.className = 'vkify-perf-hint';
    hint.textContent = t('perf.hint');

    body.append(fpsR.row, loadR.row, featR.row, heavyR.row, obsR.row, apiR.row, flushR.row, heapR.row, spark, hint);

    return {
      fps: fpsR.val, load: loadR.val, features: featR.val,
      heavy: heavyR.val, observers: obsR.val,
      api: apiR.val, flushes: flushR.val, heap: heapR.val, spark: poly,
    };
  }

  const apiHistory: number[] = [];

  function renderSpark(poly: SVGPolylineElement): void {
    if (apiHistory.length < 2) { poly.setAttribute('points', ''); return; }
    const max = Math.max(...apiHistory, 1);
    const stepX = 240 / (apiHistory.length - 1);
    poly.setAttribute(
      'points',
      apiHistory.map((v, i) => `${(i * stepX).toFixed(1)},${(30 - (v / max) * 28 - 1).toFixed(1)}`).join(' '),
    );
  }

  async function update(): Promise<void> {
    if (!widget || !refs) return;

    // FPS — локально через rAF, обновляем каждый тик сразу (без ожидания снимка).
    refs.fps.textContent = fps ? String(fps) : '—';

    // Остальные метрики берём из общего снимка (тот же источник, что у дашборда):
    // мутации = domObserver.getFlushCount(), API = content + background (спай/
    // профиль-поллеры). Content-сборщик в одиночку их не видит.
    if (inFlight) return;
    inFlight = true;
    try {
      const resp = await sendMessage({ type: 'GET_PERF_TELEMETRY' });
      if (!widget || !refs || !resp?.success) return;
      const { context, background } = resp.snapshot;

      refs.load.textContent = context.pageLoad ? t('perf.ms', { value: context.pageLoad.total }) : '—';
      refs.features.textContent = String(context.features.length);
      // Тяжёлых фич сейчас + число подписок на общий observer — компактный
      // индикатор «нагрузки» (impact приходит из FeatureRegistry в снимке).
      refs.heavy.textContent = String(context.features.filter((f) => f.impact === 'heavy').length);
      refs.observers.textContent = String(context.observerSubs);
      const api = context.apiCallsLastMin + background.apiCallsLastMin;
      refs.api.textContent = String(api);
      refs.flushes.textContent = String(context.mutationFlushes);
      refs.heap.textContent = formatMB(context.heapUsedBytes);

      apiHistory.push(api);
      if (apiHistory.length > SPARK_MAX) apiHistory.shift();
      renderSpark(refs.spark);
    } catch {
      // Канал недоступен (контекст расширения инвалидирован) — оставляем прошлые значения.
    } finally {
      inFlight = false;
    }
  }

  function startLoops(): void {
    if (document.hidden) return; // не крутим петли на скрытой вкладке
    if (!rafId) { lastFpsTs = 0; frames = 0; rafId = requestAnimationFrame(fpsLoop); }
    if (!intervalId) intervalId = window.setInterval(() => void update(), UPDATE_MS);
    void update();
  }

  function stopLoops(): void {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    if (intervalId) { clearInterval(intervalId); intervalId = 0; }
  }

  function ensureWidget(): void {
    ensureWidgetStyles();

    if (!widget) {
      widget = createFloatingWidget({
        id: 'perf-widget',
        title: 'VKify Perf',
        icon: buildSpeedometer(),
        width: 220,
        initialPosition: { left: 16, top: 80 },
        collapsible: true,
        startCollapsed: readCollapsed(),
        closeTitle: t('perf.close_title'),
        bodyClickable: true,
        bodyTitle: t('perf.body_title'),
        // Позиция — в настройках, чтобы дашборд мог её сбросить.
        loadPosition: () => ctx.getSetting<PerfWidgetPosition>('perfWidgetPosition'),
        onPositionChange: (pos) => { void ctx.setSetting('perfWidgetPosition', pos); },
        // Закрытие = выключение фичи; storage.onChange в FeatureManager сам вызовет
        // disable() и уберёт виджет. Дашборд-тоггл это отразит.
        onClose: () => { void ctx.setSetting('perf_widget', false); },
        onToggle: (collapsed) => {
          try { localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0'); } catch { /* приватный режим */ }
        },
        onBodyClick: () => { void sendMessage({ type: 'OPEN_PERF_DASHBOARD' }); },
      });
      refs = buildBody(widget.body);
    }

    widget.mount();

    if (!offStorage) {
      // Реакция на сброс позиции из дашборда (perfWidgetPosition → null).
      // Собственные записи (объект) игнорируем — виджет уже спозиционирован.
      offStorage = ctx.onStorageChange((key, value) => {
        if (key !== 'perfWidgetPosition') return;
        if (value == null) widget?.setPosition(null);
      });
    }
    if (!onVisibility) {
      onVisibility = () => { if (document.hidden) stopLoops(); else startLoops(); };
      document.addEventListener('visibilitychange', onVisibility);
    }

    startLoops();
    running = true;
  }

  function teardown(): void {
    stopLoops();
    offStorage?.(); offStorage = null;
    if (onVisibility) { document.removeEventListener('visibilitychange', onVisibility); onVisibility = null; }
    widget?.destroy();
    widget = null;
    refs = null;
    apiHistory.length = 0;
    running = false;
  }

  return {
    perf_widget: {
      // VK SPA сохраняет добавленный к body виджет между переходами, но на
      // всякий случай переподтверждаем его присутствие после навигации.
      reapplyOnNavigate: true,
      reapplyOnLanguageChange: true,
      enable: () => {
        if (running && widget?.isMounted()) return; // идемпотентно (reapplyOnNavigate)
        // document_start: body может ещё не существовать — ждём парсинга DOM.
        if (!document.body) {
          document.addEventListener('DOMContentLoaded', () => { ensureWidget(); }, { once: true });
          return;
        }
        ensureWidget();
      },
      disable: () => teardown(),
    },
  };
}
