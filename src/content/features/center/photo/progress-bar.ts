/** Inline-прогресс «████ 23/450» для скачивания альбома. */

import { t } from '@/content/i18n/index.js';

export interface ProgressBar {
  el:     HTMLElement;
  set:    (done: number, total: number) => void;
  finish: (ok: number, total: number, failed: number) => void;
  error:  () => void;
  remove: () => void;
}

/** Inline-прогресс «████ 23/450» — track + fill + текст. */
export function createProgressBar(): ProgressBar {
  const root = document.createElement('span');
  root.className = 'vkify-pb';

  const track = document.createElement('span');
  track.className = 'vkify-pb-track';

  const fill = document.createElement('span');
  fill.className = 'vkify-pb-fill';
  track.appendChild(fill);

  const text = document.createElement('span');
  text.className = 'vkify-pb-text';
  text.textContent = '0/?';

  root.appendChild(track);
  root.appendChild(text);

  let removed = false;

  return {
    el: root,
    set(done, total) {
      if (removed || total <= 0) return;
      const pct = Math.min(100, Math.round((done / total) * 100));
      fill.style.width = `${pct}%`;
      text.textContent = `${done}/${total}`;
    },
    finish(ok, total, failed) {
      if (removed) return;
      fill.style.width = '100%';
      fill.classList.add('vkify-pb-done');
      text.textContent = failed > 0 ? `${ok}/${total} (×${failed})` : `${ok}/${total} ✓`;
    },
    error() {
      if (removed) return;
      fill.classList.add('vkify-pb-err');
      text.textContent = t('download.common.error');
    },
    remove() {
      if (removed) return;
      removed = true;
      root.remove();
    },
  };
}
