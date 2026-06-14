/**
 * Разделяемое мутабельное состояние центра — единственный экземпляр на вкладку.
 * Держим элемент в поле объекта (а не в `let`-binding), чтобы и view, и jobs
 * могли переприсваивать его между модулями.
 */

import type { DlJob } from './types.js';

/** Активные задачи центра (id → задача). */
export const dlJobs = new Map<string, DlJob>();

/** Таймеры авто-очистки завершённых задач (id → handle). */
export const dlTimers = new Map<string, number>();

/** Singleton-элемент карточки центра. */
export const dlCenter: { el: HTMLElement | null } = { el: null };
