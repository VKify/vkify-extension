/** Сборка DOM карточки: элемент, шапка, строки задач, рендер. */

import { buildVkifyLogo } from '../floating-card.js';
import { DL_CENTER_ATTR } from './constants.js';
import { clamp } from './util.js';
import { ensureDlCenterStyles } from './styles.js';
import { buildDragHandleIcon } from './icon.js';
import { applyDragPosition, attachDrag } from './drag.js';
import { dlJobs, dlCenter } from './state.js';
import type { DlJob } from './types.js';

/** Создаёт/возвращает singleton-элемент карточки; навешивает перетаскивание один раз. */
export function ensureDlCenterEl(): HTMLElement {
  ensureDlCenterStyles();
  if (dlCenter.el && dlCenter.el.isConnected) return dlCenter.el;
  if (!dlCenter.el) {
    const el = document.createElement('div');
    el.className = 'vkify-card vkify-dl-center';
    el.setAttribute(DL_CENTER_ATTR, '');
    attachDrag(el);
    dlCenter.el = el;
  }
  document.body.appendChild(dlCenter.el);
  return dlCenter.el;
}

function clearFinishedDlJobs(): void {
  for (const [id, j] of dlJobs) if (j.state !== 'load') dlJobs.delete(id);
  renderDlCenter();
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
  t.textContent = job.title || 'Загрузка';
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
    cancel.setAttribute('aria-label', 'Отменить');
    cancel.textContent = '✕';
    cancel.addEventListener('click', () => job.onCancel?.());
    item.appendChild(cancel);
  }

  return item;
}

function buildHead(activeCount: number): HTMLElement {
  const head = document.createElement('div');
  head.className = 'vkify-card__head';
  head.appendChild(buildDragHandleIcon(18)); // affordance: «окно можно таскать»
  head.appendChild(buildVkifyLogo(16));

  const ttl = document.createElement('span');
  ttl.textContent = 'Загрузки';
  const cnt = document.createElement('span');
  cnt.className = 'vkify-dl-center__count';
  cnt.textContent = activeCount > 0 ? `${activeCount} в работе` : 'готово';
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'vkify-dl-center__clear';
  clear.setAttribute('aria-label', 'Очистить завершённые');
  clear.textContent = '✕';
  clear.addEventListener('click', clearFinishedDlJobs);

  head.append(ttl, cnt, clear);
  return head;
}

/** Перерисовывает карточку из текущего набора задач. */
export function renderDlCenter(): void {
  const el = ensureDlCenterEl();
  if (dlJobs.size === 0) { el.classList.remove('is-open'); el.replaceChildren(); return; }

  const active = [...dlJobs.values()].filter(j => j.state === 'load').length;

  const list = document.createElement('div');
  list.className = 'vkify-card__list';
  for (const job of dlJobs.values()) list.appendChild(buildJobItem(job));

  el.replaceChildren(buildHead(active), list);
  el.classList.add('is-open');
  applyDragPosition(el);
}
