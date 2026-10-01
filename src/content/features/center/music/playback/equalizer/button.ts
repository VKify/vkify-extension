/**
 * Кнопка быстрого доступа к эквалайзеру в нижнем плеере VK.
 * Вставляется в ту же группу кнопок, что и кнопка скачивания (controls.ts),
 * наследует хешированный VKUI-класс соседней кнопки → выглядит нативно.
 * Клик переключает плавающую панель (panel.ts).
 */
import { widgetIcon } from '@/content/ui/widget-icons.js';
import { queryAll } from '@/content/core/dom/query.js';
import { SELECTORS } from '@/content/selectors/index.js';
import { attachBrandTooltip, hideBrandTooltip } from '@/content/features/center/_shared/index.js';
import { t } from '@/content/i18n/index.js';
import { specCandidates } from '@/content/selectors/types.js';

export const EQ_BTN_ATTR = 'data-vkify-eq-btn';

function buildEqIcon(size = 20): SVGSVGElement { return widgetIcon('equalizer', size); }

/**
 * Вставляет кнопку во ВСЕ плееры на странице (идемпотентно). На vk.ru может быть
 * несколько плееров одновременно (мини-плеер в шапке + плеер на странице), поэтому
 * перебираем все группы кнопок, а не только первую. onToggle — клик.
 */
export function injectEqualizerButton(onToggle: () => void): void {
  const groups = new Set(specCandidates(SELECTORS.music.playerButtons).flatMap(selector => queryAll(selector)));
  // VK also renders players with the group on the container itself, or no role.
  for (const container of queryAll('[data-testid="audioplayerplaybackbody-audiobutton"], [class*="vkitAudioPlayerPlaybackBody__audioButtons"]')) {
    groups.add(container.querySelector('[role="group"]') ?? container);
  }
  for (const group of groups) {
    if (group.querySelector(`[${EQ_BTN_ATTR}]`)) continue;

    const sample = group.querySelector('button');
    const btnClass = (sample?.className ?? 'vkuiIconButton__host').trim();

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = btnClass;
    btn.setAttribute(EQ_BTN_ATTR, '');
    btn.setAttribute('aria-label', t('equalizer.aria'));
    if (sample?.getAttribute('style')) btn.setAttribute('style', sample.getAttribute('style')!);
    btn.appendChild(buildEqIcon());

    // Фирменный tooltip VKify — как у кнопки скачивания (единый стиль).
    attachBrandTooltip(btn, t('equalizer.aria'));

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideBrandTooltip();
      onToggle();
    });

    group.appendChild(btn);
  }
}

/** Подсветить кнопку, когда панель открыта. */
export function setEqualizerButtonActive(open: boolean): void {
  document.querySelectorAll(`[${EQ_BTN_ATTR}]`).forEach(el => el.classList.toggle('is-open', open));
}

export function removeEqualizerButton(): void {
  document.querySelectorAll(`[${EQ_BTN_ATTR}]`).forEach(el => el.remove());
}
