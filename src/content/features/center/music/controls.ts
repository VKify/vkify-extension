/**
 * Кнопка «⬇» + инлайн-статус для строк треков (классика / VKUI / плеер).
 * Клик идёт через семафор; прогресс дублируется в глобальный центр загрузок.
 *
 * Migrated to DOMObserver + selectors: якоря вставки кнопок берутся из
 * SELECTORS.music через safeQuerySelector/queryAll/findClosestVkElement.
 */

import {
  buildDownloadIconSvg,
  hideBrandTooltip, attachBrandTooltip,
  downloadCenterJobStart as jobStart,
  downloadCenterJobUpdate as jobUpdate,
  downloadCenterJobDone as jobDone,
  downloadCenterJobError as jobError,
} from '../_shared.js';
import { acquireSlot, releaseSlot, activeCount } from './queue.js';
import { produceMp3, triggerDownload } from './pipeline.js';
import {
  findAudioRows, classicRowToEntry, vkuiRowToEntry, playerToEntry, findActionsContainer,
} from './dom.js';
import { queryAll, safeQuerySelector } from '@/content/core/dom/query.js';
import { findClosestVkElement } from '@/content/core/dom/dom-utils.js';
import { SELECTORS } from '@/content/selectors/index.js';
import { BUTTON_ATTR, STATUS_ATTR, PLAYER_ATTR, MAX_CONCURRENT } from './constants.js';
import type { TrackEntry } from './types.js';

/**
 * Создаёт кнопку «⬇» и элемент статуса (idle/loading/done/error) с кликом через
 * семафор. Трек резолвится в момент клика (`getEntry`) — нужно для плеера, где
 * текущая запись меняется. Прогресс дублируется в глобальный центр загрузок.
 */
function createDownloadControl(getEntry: () => TrackEntry | null, btnClass: string): {
  btn: HTMLButtonElement;
  status: HTMLElement;
} {
  const baseCls = `${btnClass} vkify-dl-btn`;

  const status = document.createElement('div');
  status.className = 'vkify-dl-status';
  status.setAttribute(STATUS_ATTR, '');
  const statusDot = document.createElement('span');
  statusDot.className = 'vkify-dl-status-dot';
  const statusText = document.createElement('span');
  statusText.className = 'vkify-dl-status-text';
  status.append(statusDot, statusText);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = baseCls;
  btn.setAttribute(BUTTON_ATTR, '');
  btn.setAttribute('aria-label', 'Скачать MP3');
  attachBrandTooltip(btn, 'Скачать MP3');

  const iconBox = document.createElement('div');
  iconBox.className = 'audio_row__icon';
  const icDl = document.createElement('span');
  icDl.className = 'vkify-dl-ic-dl';
  icDl.appendChild(buildDownloadIconSvg(20));
  const icSpin = document.createElement('span');
  icSpin.className = 'vkify-dl-ic-spin';
  const icOk = document.createElement('span');
  icOk.className = 'vkify-dl-ic-ok';
  icOk.textContent = '✓';
  const icErr = document.createElement('span');
  icErr.className = 'vkify-dl-ic-err';
  icErr.textContent = '✕';
  iconBox.append(icDl, icSpin, icOk, icErr);
  btn.appendChild(iconBox);

  let resetTimer: number | undefined;
  const setStatus = (text: string, kind: 'load' | 'done' | 'err'): void => {
    statusText.textContent = text;
    status.title = text; // полный текст по наведению (инлайн-статус обрезается)
    status.className = `vkify-dl-status is-visible s-${kind}`;
  };
  const setIdle    = (): void => { status.className = 'vkify-dl-status'; status.title = ''; btn.className = baseCls; };
  const setLoading = (t: string): void => { window.clearTimeout(resetTimer); btn.className = `${baseCls} is-loading`; setStatus(t, 'load'); };
  const setDone    = (t: string): void => { btn.className = `${baseCls} is-done`;  setStatus(t, 'done'); resetTimer = window.setTimeout(setIdle, 4000); };
  const setError   = (t: string): void => { btn.className = `${baseCls} is-error`; setStatus(t, 'err');  resetTimer = window.setTimeout(setIdle, 8000); };

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (btn.classList.contains('is-loading')) return;

    const entry = getEntry();
    if (!entry) { setError('Нет трека'); return; }

    hideBrandTooltip();
    const jobId = entry.trackId;
    const jobTitle = entry.performer ? `${entry.performer} — ${entry.title}` : (entry.title || 'Трек');
    jobStart(jobId, jobTitle);
    const report = (t: string): void => { setLoading(t); jobUpdate(jobId, t); };

    report(activeCount() >= MAX_CONCURRENT ? 'В очереди' : 'Получение ссылки');
    await acquireSlot();
    try {
      report('Получение ссылки');
      const { filename, parts } = await produceMp3(entry, report);
      report('Сохранение');
      triggerDownload(parts, `${filename}.mp3`);
      setDone('Готово');
      jobDone(jobId, 'Готово');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка';
      setError(msg);
      jobError(jobId, msg);
    } finally {
      releaseSlot();
    }
  });

  return { btn, status };
}

// ── Классический интерфейс (.audio_row[data-full-id]) ───────────────────────────

function injectClassicButton(row: Element, entry: TrackEntry): void {
  if (row.querySelector(`[${BUTTON_ATTR}]`)) return;
  const actions = findActionsContainer(row);
  if (!actions) return;

  const { btn, status } = createDownloadControl(() => entry, 'audio_row__action');

  // Статус — внутрь элемента длительности (наследует VK-поведение видимости).
  const duration = safeQuerySelector(SELECTORS.music.rowDuration, row);
  if (duration) duration.appendChild(status);
  else (findClosestVkElement(actions, SELECTORS.music.rowInfo) ?? actions).appendChild(status);

  // Кнопка — перед «Ещё».
  const moreBtn = safeQuerySelector(SELECTORS.music.rowMore, actions);
  if (moreBtn) actions.insertBefore(btn, moreBtn);
  else actions.appendChild(btn);
}

export function injectClassicButtons(): void {
  for (const row of findAudioRows()) {
    const entry = classicRowToEntry(row);
    if (entry) injectClassicButton(row, entry);
  }
}

// ── Новый VKUI-интерфейс ([class*="vkitAudioRow__root"]) ─────────────────────────

export function injectVkuiButtons(): void {
  for (const row of queryAll(SELECTORS.music.vkuiRoot)) {
    if (row.querySelector(`[${BUTTON_ATTR}]`)) continue;

    const group = safeQuerySelector(SELECTORS.music.vkuiActions, row);
    if (!group) continue;

    const entry = vkuiRowToEntry(row);
    if (!entry) continue;

    // Берём класс и инлайн-размер у соседней нативной icon-кнопки → наша
    // выглядит идентично (классы VKUI хешированы и могут меняться).
    const sample = group.querySelector('button');
    const btnClass = (sample?.className ?? 'vkuiIconButton__host').replace(/\bvkify-dl-btn\b/, '').trim();
    const { btn, status } = createDownloadControl(() => entry, btnClass);
    if (sample?.getAttribute('style')) btn.setAttribute('style', sample.getAttribute('style')!);

    // Статус — рядом с длительностью (в .vkitAudioRow__after).
    const after = safeQuerySelector(SELECTORS.music.vkuiAfter, row)
      ?? safeQuerySelector(SELECTORS.music.vkuiDuration, row)?.parentElement
      ?? group;
    after.appendChild(status);

    // Кнопка — перед обёрткой кнопки-меню (последний элемент группы).
    const menuWrap = group.lastElementChild;
    if (menuWrap) group.insertBefore(btn, menuWrap);
    else group.appendChild(btn);
  }
}

// ── Кнопка в плеере (AudioPlayerBlock) ──────────────────────────────────────────

export function injectPlayerButton(): void {
  // Класс контейнера хеширован (…__audioButtons--XXXX) → ищем по подстроке.
  const group = safeQuerySelector(SELECTORS.music.playerButtons);
  if (!group || group.querySelector(`[${PLAYER_ATTR}]`)) return;

  const sample = group.querySelector('button');
  const btnClass = (sample?.className ?? 'vkuiIconButton__host').replace(/\bvkify-dl-btn\b/, '').trim();
  const { btn } = createDownloadControl(() => playerToEntry(), btnClass);
  btn.setAttribute(PLAYER_ATTR, '');
  if (sample?.getAttribute('style')) btn.setAttribute('style', sample.getAttribute('style')!);
  group.appendChild(btn);
}
