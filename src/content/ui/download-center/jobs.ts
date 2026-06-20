/** Публичный API жизненного цикла задач: фичи дёргают только эти функции. */

import { DONE_TTL_MS, ERROR_TTL_MS } from './constants.js';
import { removeDlCenterStyles } from './styles.js';
import { dlJobs, dlTimers, dlCenter } from './state.js';
import { renderDlCenter } from './view.js';
import { coalesceFrame } from '../../utils/raf-coalesce.js';

// Прогресс обновляется по нескольку раз в секунду на задачу; при нескольких
// активных загрузках full-rebuild карточки начинает молотить вхолостую.
// Частый путь (jobUpdate) схлопываем в один рендер на кадр. Смены состояния
// (start/done/error/remove) рендерим сразу — они редки и важны визуально.
const renderSoon = coalesceFrame(renderDlCenter);

function scheduleDlCleanup(id: string, ms: number): void {
  const prev = dlTimers.get(id);
  if (prev) window.clearTimeout(prev);
  dlTimers.set(id, window.setTimeout(() => {
    dlJobs.delete(id);
    dlTimers.delete(id);
    renderDlCenter();
  }, ms));
}

/**
 * Регистрирует/перезапускает задачу загрузки в центре. `onCancel` (если задан)
 * рисует у задачи крестик отмены, пока она в работе.
 */
export function downloadCenterJobStart(id: string, title: string, onCancel?: () => void): void {
  const prev = dlTimers.get(id);
  if (prev) { window.clearTimeout(prev); dlTimers.delete(id); }
  dlJobs.set(id, { title, text: 'В очереди…', state: 'load', onCancel: onCancel ?? null });
  dlCenter.hidden = false; // новая загрузка — показываем панель, даже если её закрыли
  renderDlCenter();
}

/** Обновляет подпись задачи; loaded/total (если total > 0) рисуют полосу прогресса. */
export function downloadCenterJobUpdate(id: string, text: string, loaded?: number, total?: number): void {
  const j = dlJobs.get(id);
  if (!j) return;
  j.text = text;
  if (loaded !== undefined) j.loaded = loaded;
  if (total  !== undefined) j.total  = total;
  renderSoon();
}

export function downloadCenterJobDone(id: string, text = 'Готово'): void {
  const j = dlJobs.get(id);
  dlJobs.set(id, { title: j?.title ?? '', text, state: 'done' });
  renderDlCenter();
  scheduleDlCleanup(id, DONE_TTL_MS);
}

export function downloadCenterJobError(id: string, text = 'Ошибка'): void {
  const j = dlJobs.get(id);
  dlJobs.set(id, { title: j?.title ?? '', text, state: 'err' });
  renderDlCenter();
  scheduleDlCleanup(id, ERROR_TTL_MS);
}

export function downloadCenterJobRemove(id: string): void {
  dlJobs.delete(id);
  const t = dlTimers.get(id);
  if (t) { window.clearTimeout(t); dlTimers.delete(id); }
  renderDlCenter();
}

/** Возвращает центр на body, если SPA-навигация его оторвала (без ре-рендера). */
export function ensureDownloadCenter(): void {
  if (dlJobs.size > 0 && dlCenter.el && !dlCenter.el.isConnected) {
    document.body.appendChild(dlCenter.el);
  }
}

/** Полностью удаляет центр (для тестов/жёсткой очистки). */
export function destroyDownloadCenter(): void {
  renderSoon.cancel(); // иначе отложенный кадр воскресит карточку после удаления
  dlCenter.el?.remove();
  dlCenter.el = null;
  dlCenter.hidden = false;
  removeDlCenterStyles();
  dlJobs.clear();
  dlTimers.forEach(t => window.clearTimeout(t));
  dlTimers.clear();
}
