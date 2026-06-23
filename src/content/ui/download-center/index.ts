/**
 * Единый центр загрузок (общий для всех download/export-фич).
 *
 * Один плавающий элемент на body. Любая фича (аудио, видео, клипы, сторис,
 * фото, экспорт диалогов) добавляет сюда задачи через jobStart/Update/Done/Error.
 * Пользователь может уйти на другую страницу — центр переживает SPA-навигацию
 * (фичи в своём scan вызывают ensureDownloadCenter). Центр НЕ должен сам
 * рендериться из чужих MutationObserver'ов — рендер дёргается только при
 * изменении задач.
 *
 * Панель построена на общем FloatingWidget (drag за шапку, стиль, z-index,
 * позиционирование); позиция запоминается в localStorage и переживает
 * перезагрузку.
 *
 * Модули: constants · types · util · styles · state · view · jobs.
 * Публичный API — только из jobs (этот barrel его и реэкспортирует).
 */

export type { DlJob, DlState } from './types.js';

export {
  downloadCenterJobStart, downloadCenterJobUpdate,
  downloadCenterJobDone, downloadCenterJobError, downloadCenterJobRemove,
  ensureDownloadCenter, destroyDownloadCenter,
} from './jobs.js';
