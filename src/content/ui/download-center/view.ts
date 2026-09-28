import { createWidgetFeature } from '../create-widget-feature.js';
import { widgetIcon } from '../widget-icons.js';
import { storage } from '@/content/core/storage.js';
import { DOWNLOAD_CENTER_OPEN } from '@/shared/widget-visibility.js';
import { buildDownloadIconSvg } from '@/content/features/center/_shared/download-icon.js';
/** Сборка центра загрузок поверх общего FloatingWidget: панель, строки задач, рендер. */

import { createFloatingWidget } from '../floating-widget.js';
import { clamp } from './util.js';
import { ensureDlCenterStyles } from './styles.js';
import { dlJobs, dlCenter } from './state.js';
import type { DlJob } from './types.js';
import { t as tr } from '@/content/i18n/index.js';

/** Счётчик «N в работе» в шапке — обновляется при каждом рендере, не пересоздаётся. */
let countEl: HTMLElement | null = null;

/**
 * Крестик в шапке = «закрыть панель». Завершённые задачи убираем сразу, а саму
 * панель прячем (фоновые загрузки продолжаются). Панель вернётся, когда
 * стартует новая задача (jobStart сбрасывает dlCenter.hidden).
 */
function closeDlCenter(): void {
  for (const [id, j] of dlJobs) if (j.state !== 'load') dlJobs.delete(id);
  dlCenter.hidden = true;
  dlCenter.pinned = false;
  void storage.set(DOWNLOAD_CENTER_OPEN, false).catch(() => {});
  renderDlCenter();
}

const widgetFeature = createWidgetFeature({
  getSetting: <T = unknown>(key: string) => storage.get<T>(key),
  onStorageChange: (callback: (key: string, value: unknown) => void) => storage.onChange(callback),
}, {
  id: 'download-center',
  isVisible: () => (dlCenter.pinned || dlJobs.size > 0) && !dlCenter.hidden,
  create: () => {
    ensureDlCenterStyles();
    countEl = document.createElement('span');
    countEl.className = 'vkify-dl-center__count';
    const widget = createFloatingWidget({
      id: 'download-center',
      title: tr('download.center.title'), titleKey: 'download.center.title',
      icon: buildDownloadIconSvg(16),
      width: 300,
      maxHeight: '60vh',
      initialPosition: 'bottom-right',
      closeTitle: tr('download.center.close'),
      onClose: closeDlCenter,
    });
    widget.aux.appendChild(countEl);
    dlCenter.widget = widget;
    return widget;
  },
  onLanguageChange: () => renderDlCenter(),
  onUnmount: () => { dlCenter.widget = null; countEl = null; },
});

/** Create or reattach through the common window lifecycle. */
export function ensureDlCenterWidget(): NonNullable<typeof dlCenter.widget> {
  void widgetFeature.enable();
  return dlCenter.widget!;
}

export function destroyDlCenterWidget(): void {
  void widgetFeature.disable();
}

function buildJobItem(job: DlJob): HTMLElement {
  const item = document.createElement('div');
  item.className = 'vkify-card__item';

  const ic = document.createElement('span');
  ic.className = `vkify-dl-center__ic s-${job.state}`;
  if (job.state !== 'load') ic.append(widgetIcon(job.state === 'done' ? 'done' : 'error'));

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
    cancel.append(widgetIcon('close'));
    cancel.addEventListener('click', e => { if (e.detail === 0) job.onCancel?.(); });
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
  if ((!dlCenter.pinned && dlJobs.size === 0) || dlCenter.hidden) { return; }

  if (dlJobs.size === 0) {
    if (countEl) countEl.textContent = '';
    const empty = document.createElement('div');
    empty.className = 'vkify-dl-center__empty';
    empty.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:10px;padding:28px 20px;text-align:center;color:var(--vkui--color_text_secondary,#818c99);font-size:12px;line-height:1.5';
    const title = document.createElement('strong'); title.textContent = tr('download.center.empty_title');
    const hint = document.createElement('span'); hint.textContent = tr('download.center.empty_hint');
    empty.append(buildDownloadIconSvg(32), title, hint);
    widget.body.replaceChildren(empty); return;
  }
  const active = [...dlJobs.values()].filter((j) => j.state === 'load').length;
  if (countEl) countEl.textContent = active > 0 ? tr('download.center.in_progress', { count: active }) : tr('download.center.all_done');

  const list = document.createElement('div');
  list.className = 'vkify-card__list';
  for (const job of dlJobs.values()) list.appendChild(buildJobItem(job));

  widget.body.replaceChildren(list);
}
