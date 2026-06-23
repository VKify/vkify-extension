/**
 * Разделяемое мутабельное состояние центра — единственный экземпляр на вкладку.
 * Держим хэндл плавающей панели (FloatingWidget) в поле объекта, чтобы и view,
 * и jobs могли переприсваивать его между модулями.
 */

import type { FloatingWidgetHandle } from '../floating-widget.js';
import type { DlJob } from './types.js';

/** Активные задачи центра (id → задача). */
export const dlJobs = new Map<string, DlJob>();

/** Таймеры авто-очистки завершённых задач (id → handle). */
export const dlTimers = new Map<string, number>();

export const dlCenter: { widget: FloatingWidgetHandle | null; hidden: boolean } = {
  widget: null,
  hidden: false,
};
