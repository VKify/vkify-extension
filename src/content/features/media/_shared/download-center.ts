/**
 * Единый центр загрузок (общий для всех download-фич).
 *
 * Один фиксированный элемент на body. Любая фича (аудио, видео, клипы, сторис,
 * фото) добавляет сюда задачи через jobStart/Update/Done/Error. Пользователь
 * может уйти на другую страницу — центр переживает SPA-навигацию (фичи в своём
 * scan вызывают ensureDownloadCenter). Центр НЕ должен сам рендериться из чужих
 * MutationObserver'ов — рендер дёргается только при изменении задач.
 */

import { buildVkifyLogo, ensureCardStyles } from '../../../ui/floating-card.js';

type DlState = 'load' | 'done' | 'err';
interface DlJob { title: string; text: string; state: DlState; }

const DL_CENTER_ATTR   = 'data-vkify-dl-center';
const DL_CENTER_CSS_ID = 'vkify-dl-center-css';
const dlJobs   = new Map<string, DlJob>();
const dlTimers = new Map<string, number>();
let   dlCenterEl: HTMLElement | null = null;

function ensureDlCenterStyles(): void {
  ensureCardStyles();
  if (document.getElementById(DL_CENTER_CSS_ID)) return;
  const s = document.createElement('style');
  s.id = DL_CENTER_CSS_ID;
  s.textContent = `
    @keyframes vkify-dlc-spin { to { transform: rotate(360deg); } }
    .vkify-dl-center { right: 16px; bottom: 16px; width: 300px; max-height: 60vh; display: none; }
    .vkify-dl-center.is-open { display: flex; animation: vkify-card-in .18s ease-out; }
    .vkify-dl-center__count { margin-left: auto; font-size: 11px; font-weight: 600; color: var(--vkui--color_text_secondary, #818c99); }
    .vkify-dl-center__clear {
      border: 0; background: transparent; cursor: pointer; padding: 2px 5px; border-radius: 6px;
      color: var(--vkui--color_text_secondary, #818c99); font-size: 14px; line-height: 1;
    }
    .vkify-dl-center__clear:hover { background: rgba(127,127,127,.14); }
    .vkify-dl-center__ic {
      flex: 0 0 auto; width: 16px; height: 16px;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; line-height: 1;
    }
    .vkify-dl-center__ic.s-load::before {
      content: ''; width: 13px; height: 13px; border-radius: 50%;
      border: 2px solid rgba(127,127,127,.3); border-top-color: var(--vkui--color_text_accent, #2688eb);
      animation: vkify-dlc-spin .7s linear infinite;
    }
    .vkify-dl-center__ic.s-done { color: #4bb34b; }
    .vkify-dl-center__ic.s-err  { color: #e64646; }
  `;
  document.head.appendChild(s);
}

function ensureDlCenterEl(): HTMLElement {
  ensureDlCenterStyles();
  if (dlCenterEl && dlCenterEl.isConnected) return dlCenterEl;
  dlCenterEl = document.createElement('div');
  dlCenterEl.className = 'vkify-card vkify-dl-center';
  dlCenterEl.setAttribute(DL_CENTER_ATTR, '');
  document.body.appendChild(dlCenterEl);
  return dlCenterEl;
}

function clearFinishedDlJobs(): void {
  for (const [id, j] of dlJobs) if (j.state !== 'load') dlJobs.delete(id);
  renderDlCenter();
}

function renderDlCenter(): void {
  const el = ensureDlCenterEl();
  if (dlJobs.size === 0) { el.classList.remove('is-open'); el.replaceChildren(); return; }

  const active = [...dlJobs.values()].filter(j => j.state === 'load').length;

  const head = document.createElement('div');
  head.className = 'vkify-card__head';
  head.appendChild(buildVkifyLogo(16));
  const ttl = document.createElement('span');
  ttl.textContent = 'Загрузки';
  const cnt = document.createElement('span');
  cnt.className = 'vkify-dl-center__count';
  cnt.textContent = active > 0 ? `${active} в работе` : 'готово';
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'vkify-dl-center__clear';
  clear.setAttribute('aria-label', 'Очистить завершённые');
  clear.textContent = '✕';
  clear.addEventListener('click', clearFinishedDlJobs);
  head.append(ttl, cnt, clear);

  const list = document.createElement('div');
  list.className = 'vkify-card__list';
  for (const job of dlJobs.values()) {
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
    item.append(ic, txt);
    list.appendChild(item);
  }

  el.replaceChildren(head, list);
  el.classList.add('is-open');
}

function scheduleDlCleanup(id: string, ms: number): void {
  const prev = dlTimers.get(id);
  if (prev) window.clearTimeout(prev);
  dlTimers.set(id, window.setTimeout(() => {
    dlJobs.delete(id);
    dlTimers.delete(id);
    renderDlCenter();
  }, ms));
}

/** Регистрирует/перезапускает задачу загрузки в центре. */
export function downloadCenterJobStart(id: string, title: string): void {
  const prev = dlTimers.get(id);
  if (prev) { window.clearTimeout(prev); dlTimers.delete(id); }
  dlJobs.set(id, { title, text: 'В очереди…', state: 'load' });
  renderDlCenter();
}
export function downloadCenterJobUpdate(id: string, text: string): void {
  const j = dlJobs.get(id);
  if (!j) return;
  j.text = text;
  renderDlCenter();
}
export function downloadCenterJobDone(id: string, text = 'Готово'): void {
  const j = dlJobs.get(id);
  dlJobs.set(id, { title: j?.title ?? '', text, state: 'done' });
  renderDlCenter();
  scheduleDlCleanup(id, 10000);
}
export function downloadCenterJobError(id: string, text = 'Ошибка'): void {
  const j = dlJobs.get(id);
  dlJobs.set(id, { title: j?.title ?? '', text, state: 'err' });
  renderDlCenter();
  scheduleDlCleanup(id, 15000);
}
export function downloadCenterJobRemove(id: string): void {
  dlJobs.delete(id);
  const t = dlTimers.get(id);
  if (t) { window.clearTimeout(t); dlTimers.delete(id); }
  renderDlCenter();
}

/** Возвращает центр на body, если SPA-навигация его оторвала (без ре-рендера). */
export function ensureDownloadCenter(): void {
  if (dlJobs.size > 0 && dlCenterEl && !dlCenterEl.isConnected) {
    document.body.appendChild(dlCenterEl);
  }
}

/** Полностью удаляет центр (для тестов/жёсткой очистки). */
export function destroyDownloadCenter(): void {
  dlCenterEl?.remove();
  dlCenterEl = null;
  document.getElementById(DL_CENTER_CSS_ID)?.remove();
  dlJobs.clear();
  dlTimers.forEach(t => window.clearTimeout(t));
  dlTimers.clear();
}
