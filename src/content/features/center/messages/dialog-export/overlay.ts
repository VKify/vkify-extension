/** Прогресс-оверлей экспорта (фаза, прогресс-бар, отмена). */

import { escapeHtml } from '../../../../../shared/utils/html.js';
import { createFloatingCard } from '../../../../ui/floating-card.js';
import { ROOT_ID } from './constants.js';

export interface ProgressOverlay {
  setPhase: (label: string) => void;
  setProgress: (loaded: number, total: number) => void;
  onCancel: (cb: () => void) => void;
  close: () => void;
}

export function showProgressOverlay(title: string): ProgressOverlay {
  document.getElementById(ROOT_ID)?.remove();

  const root = document.createElement('div');
  root.id = ROOT_ID;

  const { root: card, head, list } = createFloatingCard({
    title: 'Экспорт диалога',
    className: 'vkify-export-progress',
  });
  list.innerHTML = `
    <div class="vkify-export-sub" data-vkify-sub>«${escapeHtml(title)}»</div>
    <div class="vkify-export-bar"><div class="vkify-export-fill" data-vkify-fill></div></div>
    <div class="vkify-export-actions">
      <button class="vkify-export-cancel" data-vkify-cancel>Отмена</button>
    </div>
  `;
  root.appendChild(card);
  document.body.appendChild(root);

  const fill  = root.querySelector<HTMLElement>('[data-vkify-fill]')!;
  const sub   = root.querySelector<HTMLElement>('[data-vkify-sub]')!;
  const phase = head!.querySelector<HTMLElement>('span')!;
  const cancelBtn = root.querySelector<HTMLButtonElement>('[data-vkify-cancel]')!;
  let cancelCb: (() => void) | null = null;

  cancelBtn.addEventListener('click', () => cancelCb?.());

  return {
    setPhase(label) {
      phase.textContent = label;
    },
    setProgress(loaded, total) {
      const pct = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
      fill.style.width = pct + '%';
      sub.textContent = total > 0
        ? `«${title}» · ${loaded} из ${total} (${pct}%)`
        : `«${title}» · загружено ${loaded}`;
    },
    onCancel(cb) { cancelCb = cb; },
    close() { root.remove(); },
  };
}
