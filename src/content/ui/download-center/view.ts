/** Сборка центра загрузок поверх общего FloatingWidget: панель, строки задач, рендер. */

import { buildVkifyLogo } from '../floating-card.js';
import { createFloatingWidget, type FloatingWidgetPosition } from '../floating-widget.js';
import { DL_POS_KEY } from './constants.js';
import { clamp } from './util.js';
import { ensureDlCenterStyles } from './styles.js';
import { dlJobs, dlCenter } from './state.js';
import type { DlJob } from './types.js';
import { t as tr } from '@/content/i18n/index.js';

/** Счётчик «N в работе» в шапке — обновляется при каждом рендере, не пересоздаётся. */
let countEl: HTMLElement | null = null;

function loadDlPos(): FloatingWidgetPosition | null {
  try {
    const raw = localStorage.getItem(DL_POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { left?: unknown; top?: unknown };
    if (typeof p.left === 'number' && typeof p.top === 'number') return { left: p.left, top: p.top };
  } catch { /* битый JSON / нет доступа — дефолтная позиция */ }
  return null;
}

function saveDlPos(pos: FloatingWidgetPosition): void {
  try { localStorage.setItem(DL_POS_KEY, JSON.stringify(pos)); } catch { /* приватный режим */ }
}

/**
 * Крестик в шапке = «закрыть панель». Завершённые задачи убираем сразу, а саму
 * панель прячем (фоновые загрузки продолжаются). Панель вернётся, когда
 * стартует новая задача (jobStart сбрасывает dlCenter.hidden).
 */
function closeDlCenter(): void {
  for (const [id, j] of dlJobs) if (j.state !== 'load') dlJobs.delete(id);
  dlCenter.hidden = true;
  renderDlCenter();
}

/** Создаёт/возвращает singleton-панель центра; навешивает поведение один раз. */
export function ensureDlCenterWidget(): NonNullable<typeof dlCenter.widget> {
  ensureDlCenterStyles();
  if (dlCenter.widget) { dlCenter.widget.reattach(); return dlCenter.widget; }

  countEl = document.createElement('span');
  countEl.className = 'vkify-dl-center__count';

  const widget = createFloatingWidget({
    id: 'download-center',
    title: tr('download.center.title'),
    icon: buildVkifyLogo(16),
    width: 300,
    maxHeight: '60vh',
    initialPosition: 'bottom-right',
    closeTitle: tr('download.center.close'),
    loadPosition: loadDlPos,
    onPositionChange: saveDlPos,
    onClose: closeDlCenter,
  });
  widget.aux.appendChild(countEl);
  widget.mount();
  widget.hide(); // появляется только при наличии задач

  dlCenter.widget = widget;
  return widget;
}

function buildJobItem(job: DlJob): HTMLElement {
  const item = document.createElement('div');
  item.className = 'vkify-card__item';

  const ic = document.createElement('span');
  ic.className = `vkify-dl-center__ic s-${job.state}`;
  ic.textContent = job.state === 'done' ? '✓' : job.state === 'err' ? '✕' : '';

  const txt = document.createElement('div');
  txt.className = 'vkify-card__txt';
  const t = document.createElement('div');
  t.className = 'vkify-card__title';
  t.textContent = job.title || tr('download.center.job_default');
  const s = document.createElement('div');
  s.className = 'vkify-card__status';
  s.textContent = job.text;
  txt.append(t, s);

  if (job.state === 'load' && (job.total ?? 0) > 0) {
    const pct = clamp(Math.round(((job.loaded ?? 0) / (job.total as number)) * 100), 0, 100);
    const bar = document.createElement('div');
    bar.className = 'vkify-dl-center__bar';
    const fill = document.createElement('div');
    fill.className = 'vkify-dl-center__fill';
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);
    txt.appendChild(bar);
  }

  item.append(ic, txt);

  if (job.state === 'load' && job.onCancel) {
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'vkify-dl-center__cancel';
    cancel.setAttribute('aria-label', tr('download.center.cancel'));
    cancel.textContent = '✕';
    // Прогресс перерисовывает список по нескольку раз в секунду (replaceChildren
    // уничтожает и пересоздаёт эту кнопку), а `click` требует mousedown и mouseup
    // на одном узле — между ними узел успевает смениться, и клик теряется.
    // `pointerdown` срабатывает на самом нажатии, до возможного ре-рендера.
    cancel.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      job.onCancel?.();
    });
    item.appendChild(cancel);
  }

  return item;
}

/** Перерисовывает панель из текущего набора задач. */
export function renderDlCenter(): void {
  const widget = ensureDlCenterWidget();
  if (dlJobs.size === 0 || dlCenter.hidden) { widget.hide(); return; }

  const active = [...dlJobs.values()].filter((j) => j.state === 'load').length;
  if (countEl) countEl.textContent = active > 0 ? tr('download.center.in_progress', { count: active }) : tr('download.center.all_done');

  const list = document.createElement('div');
  list.className = 'vkify-card__list';
  for (const job of dlJobs.values()) list.appendChild(buildJobItem(job));

  widget.body.replaceChildren(list);
  widget.show();
}
