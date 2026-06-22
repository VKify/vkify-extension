/** Отрисовка списка шаблонов, подсветка выбора и позиционирование оверлея. */

import { escapeHtml } from '@/shared/utils/html.js';
import type { TemplatesState } from './state.js';

/**
 * Подсветка выбранного пункта — сменой класса `.is-active` у уже существующих
 * узлов; DOM при наведении не пересоздаётся.
 */
export function applySelectionClasses(state: TemplatesState): void {
  if (!state.list) return;
  const items = state.list.querySelectorAll<HTMLElement>('.vkify-tpl-item');
  items.forEach((el, i) => {
    const isActive = i === state.selectedIdx;
    el.classList.toggle('is-active', isActive);
    if (isActive) el.scrollIntoView({ block: 'nearest' });
  });
}

/** Перерисовывает список (только при смене фильтра/набора), счётчик и подсказку. */
export function renderList(state: TemplatesState): void {
  if (!state.list) return;

  // Счётчик в шапке.
  const countEl = state.overlay?.querySelector<HTMLElement>('[data-vkify-count]');
  if (countEl) countEl.textContent = String(state.filtered.length);

  // Подсказка хоткея в футере — синхронизируем с текущим биндингом.
  const hintEl = state.overlay?.querySelector<HTMLElement>('[data-vkify-hotkey-hint]');
  if (hintEl) hintEl.innerHTML = `<kbd>${escapeHtml(state.hotkey.label)}</kbd> закрыть`;

  if (state.filtered.length === 0) {
    state.list.innerHTML = `<div class="vkify-tpl-empty">Нет подходящих шаблонов</div>`;
    return;
  }

  // Один innerHTML — быстрее N appendChild'ов, плюс не нужны per-item listeners.
  state.list.innerHTML = state.filtered.map((t, i) => {
    const preview = t.text.length > 64 ? `${t.text.slice(0, 64)}…` : t.text;
    const active  = i === state.selectedIdx ? ' is-active' : '';
    const attachCount = t.attachments?.length ?? 0;
    const attachBadge = attachCount > 0 ? ` 📎${attachCount}` : '';
    return `<div class="vkify-tpl-item${active}" data-idx="${i}">`
         + `<div class="vkify-tpl-name">${escapeHtml(t.name)}${attachBadge}</div>`
         + `<div class="vkify-tpl-preview">${escapeHtml(preview)}</div>`
         + `</div>`;
  }).join('');
}

/** Ставит оверлей над/под инпутом, прижимая к видимой области. */
export function positionOverlay(state: TemplatesState, target: HTMLElement): void {
  if (!state.overlay) return;
  const rect = target.getBoundingClientRect();
  const overlay = state.overlay;
  overlay.style.display = 'flex';
  // Чтобы корректно измерить высоту, кадр должен отрисоваться один раз.
  const height = Math.min(overlay.offsetHeight || 280, 360);
  const top = rect.top > height + 8
    ? rect.top - height - 6
    : rect.bottom + 6;
  overlay.style.top  = `${Math.max(8, Math.min(top, window.innerHeight - height - 8))}px`;
  overlay.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 360))}px`;
}
