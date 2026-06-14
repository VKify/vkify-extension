/** Модель задачи центра загрузок. */

export type DlState = 'load' | 'done' | 'err';

export interface DlJob {
  title: string;
  text: string;
  state: DlState;
  /** Определённый прогресс (показывает полосу), если total > 0. */
  loaded?: number;
  total?: number;
  /** Колбэк отмены — рисует крестик «отменить», пока задача в работе. */
  onCancel?: (() => void) | null;
}
