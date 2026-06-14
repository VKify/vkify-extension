/**
 * Перетаскивание карточки за шапку + запоминание позиции в localStorage.
 *
 * Текущая позиция живёт в памяти (`dlPos`) и служит источником истины: рендер
 * во время загрузки дёргается часто, и чтение «старой» сохранённой позиции из
 * localStorage сбрасывало бы карточку назад прямо посреди перетаскивания.
 * В хранилище пишем только при отпускании.
 */

import { DL_POS_KEY } from './constants.js';
import { clamp } from './util.js';

interface Pos { left: number; top: number; }

let dlPos: Pos | null = null;

function loadDlPos(): Pos | null {
  try {
    const raw = localStorage.getItem(DL_POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { left?: unknown; top?: unknown };
    if (typeof p.left === 'number' && typeof p.top === 'number') {
      return { left: p.left, top: p.top };
    }
  } catch { /* битый JSON / нет доступа — используем дефолтную позицию */ }
  return null;
}

function saveDlPos(pos: Pos): void {
  try { localStorage.setItem(DL_POS_KEY, JSON.stringify(pos)); } catch { /* приватный режим */ }
}

function setDlPos(el: HTMLElement, left: number, top: number): void {
  el.style.left   = `${left}px`;
  el.style.top    = `${top}px`;
  el.style.right  = 'auto';
  el.style.bottom = 'auto';
}

/** Применяет текущую (in-memory) позицию, прижимая карточку к видимой области. */
export function applyDragPosition(el: HTMLElement): void {
  if (!dlPos) return;
  const w = el.offsetWidth  || 300;
  const h = el.offsetHeight || 0;
  setDlPos(el, clamp(dlPos.left, 0, window.innerWidth - w), clamp(dlPos.top, 0, window.innerHeight - h));
}

function startDrag(e: PointerEvent, el: HTMLElement): void {
  const target = e.target as Element | null;
  if (!target?.closest('.vkify-card__head')) return; // тянем только за шапку
  if (target.closest('button')) return;              // не мешаем кнопке «очистить»

  e.preventDefault();
  const rect = el.getBoundingClientRect();
  const offX = e.clientX - rect.left;
  const offY = e.clientY - rect.top;
  el.classList.add('is-dragging');

  const move = (ev: PointerEvent): void => {
    const left = clamp(ev.clientX - offX, 0, window.innerWidth  - el.offsetWidth);
    const top  = clamp(ev.clientY - offY, 0, window.innerHeight - el.offsetHeight);
    dlPos = { left, top };
    setDlPos(el, left, top);
  };
  const up = (): void => {
    el.classList.remove('is-dragging');
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    const r = el.getBoundingClientRect();
    dlPos = { left: r.left, top: r.top };
    saveDlPos(dlPos);
  };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
}

/** Навешивает перетаскивание на карточку и подхватывает сохранённую позицию. */
export function attachDrag(el: HTMLElement): void {
  dlPos = loadDlPos(); // последняя сохранённая позиция — один раз при создании
  el.addEventListener('pointerdown', (e) => startDrag(e, el));
}
