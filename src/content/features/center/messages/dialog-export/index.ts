import type { FeatureManager } from '@/content/core/feature-manager.js';
import {
  attachBrandTooltip,
  hideBrandTooltip,
  buildDownloadIconSvg,
} from '../../_shared.js';
import { ensureDownloadCenter } from '@/content/ui/download-center/index.js';
import { BTN_ATTR, STYLE_ID } from './constants.js';
import { STYLE_CSS } from './styles.js';
import { showFormatMenu } from './menu.js';

/**
 * Экспорт текущего диалога в файл (JSON / TXT / HTML / ZIP) — кнопка в шапке
 * чата с меню форматов. История фетчится через messages.getHistory постранично;
 * у больших чатов это занимает минуты, поэтому есть прогресс-оверлей с отменой.
 *
 * Прогресс экспорта (с отменой) идёт в общий центр загрузок VKify, тот же, что
 * у медиа-фич, — отдельного модального оверлея больше нет.
 *
 * Фича собрана из модулей: peer · history · decrypt · attachments · render ·
 * images · menu · run.
 */

function injectIntoHeader(controls: Element): void {
  if (controls.hasAttribute(BTN_ATTR)) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'vkify-export-btn';
  btn.setAttribute('aria-label', 'Экспорт диалога');
  btn.appendChild(buildDownloadIconSvg(22));
  attachBrandTooltip(btn, 'Экспорт диалога');
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    hideBrandTooltip();
    showFormatMenu(btn);
  });

  // Кнопка «Ещё» вложена в DropdownReforged-обёртки — поднимаемся до прямого
  // ребёнка controls, иначе insertBefore бросит NotFoundError.
  const moreTrigger = controls.querySelector<HTMLElement>('#convo-more-menu-trigger');
  let anchor: Element | null = moreTrigger;
  while (anchor && anchor.parentElement !== controls) {
    anchor = anchor.parentElement;
  }
  if (anchor && anchor.parentElement === controls) controls.insertBefore(btn, anchor);
  else controls.appendChild(btn);

  controls.setAttribute(BTN_ATTR, '1');
}

function scanAll(): void {
  document.querySelectorAll('.ConvoHeader__controls').forEach(injectIntoHeader);
  ensureDownloadCenter(); // общий центр загрузок переживает SPA-навигацию
}

export function registerDialogExportFeature(manager: FeatureManager): void {
  let observer: MutationObserver | null = null;
  let styleEl: HTMLStyleElement | null = null;

  manager.register('dialog_export_enabled', {
    enable: () => {
      if (observer) return;

      styleEl = document.createElement('style');
      styleEl.id = STYLE_ID;
      styleEl.textContent = STYLE_CSS;
      document.head.appendChild(styleEl);

      scanAll();

      observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (!(node instanceof Element)) continue;
            if (node.matches?.('.ConvoHeader__controls')) {
              injectIntoHeader(node);
            } else {
              node.querySelectorAll?.('.ConvoHeader__controls').forEach(injectIntoHeader);
            }
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      console.log('[VKify] Dialog export enabled');
    },

    disable: () => {
      observer?.disconnect();
      observer = null;
      styleEl?.remove();
      styleEl = null;

      document.getElementById('vkify-export-menu-root')?.remove();
      // Центр загрузок общий для всех фич — его не трогаем при выключении экспорта.
      // Tooltip общий для всех download-фич — не удаляем элемент, лишь прячем.
      hideBrandTooltip();

      document.querySelectorAll(`[${BTN_ATTR}]`).forEach((el) => {
        el.removeAttribute(BTN_ATTR);
        el.querySelectorAll('.vkify-export-btn').forEach(b => b.remove());
      });

      console.log('[VKify] Dialog export disabled');
    },
  });
}
