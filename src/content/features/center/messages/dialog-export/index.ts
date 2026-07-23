import type { FeatureManager } from '@/content/core/feature-manager.js';
import { handlerFeature } from '@/content/core/features/index.js';
import {
  attachBrandTooltip,
  hideBrandTooltip,
  buildDownloadIconSvg,
} from '../../_shared/index.js';
import { ensureDownloadCenter } from '@/content/ui/download-center/index.js';
import { BTN_ATTR, STYLE_ID } from './constants.js';
import { STYLE_CSS } from './styles.js';
import { showFormatMenu } from './menu.js';
import { safeQuerySelector } from '@/content/core/dom/query.js';
import { SELECTORS } from '@/content/selectors/index.js';
import { specUnion } from '@/content/selectors/types.js';
import { t } from '@/content/i18n/index.js';

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
  btn.setAttribute('aria-label', t('messages.export.aria'));
  btn.appendChild(buildDownloadIconSvg(22));
  attachBrandTooltip(btn, t('messages.export.aria'));
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    hideBrandTooltip();
    showFormatMenu(btn);
  });

  // Кнопка «Ещё» вложена в DropdownReforged-обёртки — поднимаемся до прямого
  // ребёнка controls, иначе insertBefore бросит NotFoundError.
  const moreTrigger = safeQuerySelector<HTMLElement>(SELECTORS.messages.convoMoreMenuTrigger, controls);
  let anchor: Element | null = moreTrigger;
  while (anchor && anchor.parentElement !== controls) {
    anchor = anchor.parentElement;
  }
  if (anchor && anchor.parentElement === controls) controls.insertBefore(btn, anchor);
  else controls.appendChild(btn);

  controls.setAttribute(BTN_ATTR, '1');
}

export function registerDialogExportFeature(manager: FeatureManager): void {
  let off: (() => void) | null = null;
  let styleEl: HTMLStyleElement | null = null;

  manager.registerDefinition(handlerFeature({
    id: 'dialog_export_enabled',
    name: 'Экспорт диалога', category: 'messages', impact: 'medium',
    tags: ['im', 'export'],
    reapplyOnLanguageChange: true,
    handler: {
      enable: () => {
        if (off) return;

        styleEl = document.createElement('style');
        styleEl.id = STYLE_ID;
        styleEl.textContent = STYLE_CSS;
        document.head.appendChild(styleEl);

        ensureDownloadCenter(); // общий центр загрузок переживает SPA-навигацию
        // initial-скан шапок чата + подписка на новые (смена диалога) — общий observer.
        // Нужны все варианты одновременно: на странице могут сосуществовать
        // ConvoHeader обычного IM и DialogHeader кабинета сообщества/мини-чата.
        off = manager.observeMatches(
          'dialog_export_enabled',
          specUnion(SELECTORS.messages.headerControls),
          injectIntoHeader,
        );

        console.log('[VKify] Dialog export enabled');
      },

      disable: () => {
        off?.();
        off = null;
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
    },
  }));
}
