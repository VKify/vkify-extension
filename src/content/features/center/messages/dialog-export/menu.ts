/** Выпадающее меню выбора формата экспорта (+ опция расшифровки). */

import { createFloatingCard } from '../../../../ui/floating-card.js';
import { runExport } from './run.js';
import type { ExportFormat } from './types.js';

export function showFormatMenu(anchor: HTMLElement): void {
  document.getElementById('vkify-export-menu-root')?.remove();

  const { root: menu, list } = createFloatingCard({
    title: 'Экспорт диалога',
    className: 'vkify-export-menu',
  });
  menu.id = 'vkify-export-menu-root';

  const row = (fmt: string, chip: string, title: string, status: string): string => `
    <button class="vkify-card__item" data-fmt="${fmt}">
      <span class="vkify-fmt">${chip}</span>
      <span class="vkify-card__txt">
        <span class="vkify-card__title">${title}</span>
        <span class="vkify-card__status">${status}</span>
      </span>
    </button>`;

  list.innerHTML = `
    ${row('json',       'JSON',  'Сырые данные',       'Для скриптов и программ')}
    ${row('txt',        'TXT',   'Простой текст',      'Лёгкий и читаемый')}
    ${row('html',       'HTML',  'Веб-страница',       'Ссылки на фото (легче)')}
    ${row('html-embed', 'HTML+', 'Веб-страница + фото','Фото внутри файла (base64)')}
    ${row('html-zip',   'ZIP',   'Архив',              'HTML + папка с фото')}
    <div class="vkify-card__sep"></div>
    <label class="vkify-card__item" data-vkify-decrypt>
      <input type="checkbox" data-vkify-decrypt-cb>
      <span>Расшифровать сообщения ключом из настроек</span>
    </label>
  `;

  document.body.appendChild(menu);

  // Под кнопкой; если не влезает справа — прижимаем к правому краю окна.
  const rect = anchor.getBoundingClientRect();
  menu.style.top  = `${rect.bottom + 6}px`;
  menu.style.left = `${Math.min(rect.left, window.innerWidth - menu.offsetWidth - 8)}px`;

  menu.addEventListener('click', (e) => {
    // Клик по чекбоксу — часть выбора, меню не закрываем.
    if ((e.target as HTMLElement).closest('[data-vkify-decrypt]')) return;

    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-fmt]');
    if (!btn) return;
    const fmt = btn.dataset['fmt'] as ExportFormat;
    const decrypt = menu.querySelector<HTMLInputElement>('[data-vkify-decrypt-cb]')?.checked ?? false;
    menu.remove();
    void runExport(fmt, decrypt);
  });

  const outside = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node) && e.target !== anchor) {
      menu.remove();
      document.removeEventListener('mousedown', outside, true);
    }
  };
  document.addEventListener('mousedown', outside, true);
}
