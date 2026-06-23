import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap } from '@/types/index.js';
import type { PerfWidgetPosition } from '@/shared/constants/perf.js';
import { ensureCardStyles } from '../../ui/floating-card.js';
import { sendMessage } from '@/shared/messaging.js';

/**
 * PerfWidget — плавающий мини-монитор производительности поверх vk.com.
 *
 * Тот же UX, что у Центра загрузок: одна плавающая карточка на body, тянется за
 * шапку, позиция запоминается (здесь — в настройках под `perfWidgetPosition`,
 * чтобы дашборд мог её сбросить), сворачивается/закрывается.
 *
 * Данные: FPS считается локально (rAF), остальные метрики берутся из общего
 * снимка `GET_PERF_TELEMETRY` (тот же источник, что у дашборда) — так мутации
 * (domObserver) и API учитываются корректно, включая фоновые поллеры, которых
 * content-сборщик в одиночку не видит.
 *
 * Минимизация нагрузки: rAF-петля FPS и интервал обновления (1с) работают только
 * пока вкладка видима (`visibilitychange` ставит их на паузу) и пока фича
 * включена. Виджет существует только в content-скрипте vk.com, т.е. вне
 * VK-вкладки его нет по определению.
 */

const WIDGET_CSS_ID = 'vkify-perf-widget-css';
const COLLAPSED_KEY = 'vkify:perf-widget:collapsed';
const UPDATE_MS = 1000;
const SPARK_MAX = 60; // точек истории API-rate (≈60 c)
const SVG_NS = 'http://www.w3.org/2000/svg';

const WIDGET_CSS = `
  .vkify-perf-widget {
    position: fixed; top: 80px; left: 16px; z-index: 2147483646;
    width: 220px; display: flex; flex-direction: column;
    background: color-mix(in srgb, var(--vkui--color_background_modal, #fff) 80%, transparent);
    -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
    color: var(--vkui--color_text_primary, #19191a);
    border-radius: 14px; overflow: hidden;
    box-shadow: 0 14px 44px rgba(0,0,0,.3), 0 0 0 1px rgba(127,127,127,.14);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    animation: vkify-card-in .18s ease-out;
  }
  .vkify-perf-widget.is-dragging { animation: none; user-select: none; cursor: grabbing; }
  .vkify-perf-widget__head {
    display: flex; align-items: center; gap: 6px; padding: 8px 10px;
    font-size: 12px; font-weight: 700; cursor: move; touch-action: none;
    border-bottom: 1px solid rgba(127,127,127,.16); flex-shrink: 0;
  }
  .vkify-perf-widget.is-collapsed .vkify-perf-widget__head { border-bottom: 0; }
  .vkify-perf-widget__grip { color: var(--vkui--color_icon_tertiary, #99a2ad); flex: 0 0 auto; display: block; }
  .vkify-perf-widget__title { white-space: nowrap; }
  .vkify-perf-widget__spacer { margin-left: auto; }
  .vkify-perf-widget__btn {
    border: 0; background: transparent; cursor: pointer; padding: 2px 5px; border-radius: 6px;
    color: var(--vkui--color_text_secondary, #818c99); font-size: 13px; line-height: 1;
  }
  .vkify-perf-widget__btn:hover { background: rgba(127,127,127,.14); }
  .vkify-perf-widget__body {
    padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 5px; cursor: pointer;
  }
  .vkify-perf-widget.is-collapsed .vkify-perf-widget__body { display: none; }
  .vkify-perf-widget__row { display: flex; align-items: center; justify-content: space-between; font-size: 11px; }
  .vkify-perf-widget__row > span:first-child { color: var(--vkui--color_text_secondary, #818c99); }
  .vkify-perf-widget__val { font-weight: 700; font-variant-numeric: tabular-nums; }
  .vkify-perf-widget__spark { width: 100%; height: 30px; margin-top: 3px; color: var(--vkui--color_text_accent, #2688eb); display: block; }
  .vkify-perf-widget__hint { font-size: 9px; color: var(--vkui--color_text_secondary, #818c99); text-align: center; margin-top: 1px; }
`;

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

function formatMB(bytes?: number): string {
  if (bytes == null || bytes <= 0) return 'н/д';
  return `${(bytes / (1024 * 1024)).toFixed(0)} МБ`;
}

function ensureWidgetStyles(): void {
  ensureCardStyles(); // тянет keyframe vkify-card-in + общие переменные
  if (document.getElementById(WIDGET_CSS_ID)) return;
  const s = document.createElement('style');
  s.id = WIDGET_CSS_ID;
  s.textContent = WIDGET_CSS;
  document.head.appendChild(s);
}

/** SVG-иконка «ручка перетаскивания» (грубые полосы) — affordance шапки. */
function buildGrip(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'vkify-perf-widget__grip');
  svg.style.cssText = 'width:16px;height:16px';
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', 'M3.9 9.2a.9.9 0 1 0 0 1.8h16.2a.9.9 0 1 0 0-1.8H3.9Zm0 3.8a.9.9 0 1 0 0 1.8h16.2a.9.9 0 1 0 0-1.8H3.9Z');
  svg.appendChild(p);
  return svg;
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
  api: HTMLElement; flushes: HTMLElement; heap: HTMLElement;
  spark: SVGPolylineElement;
}

/**
 * Фабрика фичи. Всё изменяемое состояние и хелперы живут в этом замыкании —
 * фабрику вызывают один раз при регистрации, так что это де-факто синглтон на
 * вкладку, но без глобальных модульных переменных.
 */
export function createPerfWidgetFeature(manager: FeatureManager): FeatureMap {
  let el: HTMLElement | null = null;
  let refs: Refs | null = null;
  let rafId = 0;
  let intervalId = 0;
  let frames = 0;
  let lastFpsTs = 0;
  let fps = 0;
  let inFlight = false; // защита от наложения снимков, если ответ медленнее тика
  let pos: PerfWidgetPosition | null = null;
  let collapsed = false;
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

  function applyPos(node: HTMLElement): void {
    if (!pos) { node.style.left = ''; node.style.top = ''; return; }
    const w = node.offsetWidth || 220;
    const h = node.offsetHeight || 0;
    node.style.left = `${clamp(pos.left, 0, window.innerWidth - w)}px`;
    node.style.top = `${clamp(pos.top, 0, window.innerHeight - h)}px`;
  }

  function attachDrag(node: HTMLElement): void {
    node.addEventListener('pointerdown', (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t?.closest('.vkify-perf-widget__head')) return; // тянем только за шапку
      if (t.closest('button')) return;                     // не мешаем кнопкам
      e.preventDefault();

      const rect = node.getBoundingClientRect();
      const offX = e.clientX - rect.left;
      const offY = e.clientY - rect.top;
      node.classList.add('is-dragging');

      const move = (ev: PointerEvent): void => {
        pos = {
          left: clamp(ev.clientX - offX, 0, window.innerWidth - node.offsetWidth),
          top: clamp(ev.clientY - offY, 0, window.innerHeight - node.offsetHeight),
        };
        node.style.left = `${pos.left}px`;
        node.style.top = `${pos.top}px`;
      };
      const up = (): void => {
        node.classList.remove('is-dragging');
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        // Персист — только на отпускании (одна запись на drag, не на каждый кадр).
        if (pos) void manager.setSetting('perfWidgetPosition', pos);
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    });
  }

  function buildRow(label: string): { row: HTMLElement; val: HTMLElement } {
    const row = document.createElement('div');
    row.className = 'vkify-perf-widget__row';
    const l = document.createElement('span');
    l.textContent = label;
    const val = document.createElement('span');
    val.className = 'vkify-perf-widget__val';
    val.textContent = '—';
    row.append(l, val);
    return { row, val };
  }

  function build(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'vkify-perf-widget';
    root.setAttribute('data-vkify-perf-widget', '');

    // — Шапка —
    const head = document.createElement('div');
    head.className = 'vkify-perf-widget__head';
    head.append(buildGrip(), buildSpeedometer());
    const title = document.createElement('span');
    title.className = 'vkify-perf-widget__title';
    title.textContent = 'VKify Perf';
    const spacer = document.createElement('span');
    spacer.className = 'vkify-perf-widget__spacer';

    const collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.className = 'vkify-perf-widget__btn';
    collapseBtn.setAttribute('aria-label', 'Свернуть');
    collapseBtn.title = 'Свернуть/развернуть';
    const setCollapseGlyph = (): void => { collapseBtn.textContent = collapsed ? '▢' : '—'; };
    collapseBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      collapsed = !collapsed;
      root.classList.toggle('is-collapsed', collapsed);
      setCollapseGlyph();
      try { localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0'); } catch { /* приватный режим */ }
    });

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'vkify-perf-widget__btn';
    closeBtn.setAttribute('aria-label', 'Закрыть');
    closeBtn.title = 'Закрыть (выключить мини-виджет)';
    closeBtn.textContent = '✕';
    // Закрытие = выключение фичи; дашборд-тоггл это отразит. storage.onChange в
    // FeatureManager сам вызовет disable() и уберёт виджет.
    closeBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      void manager.setSetting('perf_widget', false);
    });

    head.append(title, spacer, collapseBtn, closeBtn);

    // — Тело (метрики) —
    const body = document.createElement('div');
    body.className = 'vkify-perf-widget__body';
    body.title = 'Открыть полный дашборд';
    body.addEventListener('click', () => { void sendMessage({ type: 'OPEN_PERF_DASHBOARD' }); });

    const fpsR = buildRow('FPS');
    const loadR = buildRow('Загрузка');
    const featR = buildRow('Активных фич');
    const apiR = buildRow('API/мин');
    const flushR = buildRow('Мутации');
    const heapR = buildRow('Heap');

    const spark = document.createElementNS(SVG_NS, 'svg') as unknown as SVGSVGElement;
    spark.setAttribute('viewBox', '0 0 240 30');
    spark.setAttribute('preserveAspectRatio', 'none');
    spark.setAttribute('class', 'vkify-perf-widget__spark');
    const poly = document.createElementNS(SVG_NS, 'polyline') as SVGPolylineElement;
    poly.setAttribute('fill', 'none');
    poly.setAttribute('stroke', 'currentColor');
    poly.setAttribute('stroke-width', '1.5');
    poly.setAttribute('stroke-linejoin', 'round');
    poly.setAttribute('stroke-linecap', 'round');
    poly.setAttribute('vector-effect', 'non-scaling-stroke');
    spark.appendChild(poly);

    const hint = document.createElement('div');
    hint.className = 'vkify-perf-widget__hint';
    hint.textContent = 'API-вызовы за 60 c · клик — дашборд';

    body.append(fpsR.row, loadR.row, featR.row, apiR.row, flushR.row, heapR.row, spark, hint);
    root.append(head, body);

    setCollapseGlyph();
    refs = {
      fps: fpsR.val, load: loadR.val, features: featR.val,
      api: apiR.val, flushes: flushR.val, heap: heapR.val, spark: poly,
    };
    return root;
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
    if (!el || !refs) return;

    // FPS — локально через rAF, обновляем каждый тик сразу (без ожидания снимка).
    refs.fps.textContent = fps ? String(fps) : '—';

    // Остальные метрики берём из общего снимка (тот же источник, что у дашборда):
    // мутации = domObserver.getFlushCount(), API = content + background (спай/
    // профиль-поллеры). Content-сборщик в одиночку их не видит — поэтому раньше
    // мутации и API в виджете были нулями.
    if (inFlight) return;
    inFlight = true;
    try {
      const resp = await sendMessage({ type: 'GET_PERF_TELEMETRY' });
      if (!el || !refs || !resp?.success) return;
      const { context, background } = resp.snapshot;

      refs.load.textContent = context.pageLoad ? `${context.pageLoad.total} мс` : '—';
      refs.features.textContent = String(context.features.length);
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

  async function ensureWidget(): Promise<void> {
    ensureWidgetStyles();

    if (!el) {
      el = build();
      attachDrag(el);
    }
    if (!el.isConnected && document.body) document.body.appendChild(el);

    collapsed = (() => { try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; } })();
    el.classList.toggle('is-collapsed', collapsed);

    // Позиция из настроек (может вернуться null — тогда дефолт из CSS).
    pos = (await manager.getSetting<PerfWidgetPosition>('perfWidgetPosition')) ?? null;
    applyPos(el);

    if (!offStorage) {
      // Реакция на сброс позиции из дашборда (perfWidgetPosition → null).
      // Собственные записи (объект) игнорируем — виджет уже спозиционирован.
      offStorage = manager.onStorageChange((key, value) => {
        if (key !== 'perfWidgetPosition') return;
        if (value == null) { pos = null; if (el) applyPos(el); }
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
    el?.remove();
    el = null;
    refs = null;
    apiHistory.length = 0;
    running = false;
  }

  return {
    perf_widget: {
      // VK SPA сохраняет добавленный к body виджет между переходами, но на
      // всякий случай переподтверждаем его присутствие после навигации.
      reapplyOnNavigate: true,
      enable: () => {
        if (running && el?.isConnected) return; // идемпотентно (reapplyOnNavigate)
        // document_start: body может ещё не существовать — ждём парсинга DOM.
        if (!document.body) {
          document.addEventListener('DOMContentLoaded', () => { void ensureWidget(); }, { once: true });
          return;
        }
        void ensureWidget();
      },
      disable: () => teardown(),
    },
  };
}
