import type { FeatureContext } from '@/content/core/feature-context.js';
import type { FeatureHandler } from '@/types/index.js';
import { SELECTORS } from '@/content/selectors/index.js';
import { getLang } from '@/content/i18n/index.js';
import { GOOGLE_LOGO, YANDEX_LOGO } from './search-logos.js';
import { attachBrandTooltip, hideBrandTooltip } from '../_shared/brand-tooltip.js';
import { isVkHost } from './api.js';

export function createPhotoSearchFeature(ctx: FeatureContext): FeatureHandler {
  const id = 'vkify-photo-search';
  let off: (() => void) | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  function scan(): void {
    const viewer = document.querySelector(SELECTORS.photo.viewer);
    const actions = viewer?.querySelector(SELECTORS.photo.viewerActions);
    if (!actions || actions.querySelector('#' + id)) return;
    const group = document.createElement('span');
    group.id = id;
    const ru = getLang() === 'ru';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', ru ? 'Найти по фото' : 'Search by image');
    if (!document.getElementById(id + '-style')) {
      const style = document.createElement('style');
      style.id = id + '-style';
      style.textContent = `#${id} { display: inline-flex; align-items: center; gap: 4px; vertical-align: middle; }
        #${id} button { appearance: none; border: 0; box-shadow: none; margin: 0; padding: 3px 6px; width: 30px; height: 24px; border-radius: 6px; background: transparent; color: inherit; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; transition: background-color .15s ease; }
        #${id} button:hover { background: color-mix(in srgb, var(--vkify-accent, #71aaeb) 12%, transparent); }
        #${id} button:focus-visible { outline: 2px solid var(--vkify-accent, #71aaeb); outline-offset: 2px; }
        #${id} img { display: block; width: 16px; height: 16px; object-fit: contain; pointer-events: none; }`;
      document.head.append(style);
    }
    for (const [provider, label] of [['yandex', ru ? 'Яндекс' : 'Yandex'], ['google', 'Google Lens']]) {
      const button = document.createElement('button');
      button.type = 'button';
      const description = ru ? 'Найти по фото в ' + label : 'Search image with ' + label;
      button.setAttribute('aria-label', description);
      let tooltip = description;
      attachBrandTooltip(button, () => tooltip);
      const logo = document.createElement('img');
      logo.src = provider === 'google' ? GOOGLE_LOGO : YANDEX_LOGO;
      logo.alt = ''; logo.setAttribute('aria-hidden', 'true');
      button.append(logo);
      button.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation();
        const image = viewer?.querySelector<HTMLImageElement>('#pv_photo img, .pv_photo img');
        const source = image?.currentSrc || image?.src;
        if (!source || !(source.startsWith('https://') || source.startsWith('http://'))) {
          tooltip = ru ? 'Фото ещё не загружено' : 'Photo not loaded yet';
          button.setAttribute('aria-label', tooltip);
          return;
        }
        tooltip = description;
        button.setAttribute('aria-label', description);
        const url = new URL(provider === 'google' ? 'https://lens.google.com/uploadbyurl' : 'https://yandex.ru/images/search');
        url.searchParams.set('url', source);
        if (provider === 'yandex') url.searchParams.set('rpt', 'imageview');
        window.open(url.href, '_blank', 'noopener,noreferrer');
      });
      group.append(button);
    }
    const divider = document.createElement('span');
    divider.id = id + '-divider'; divider.className = 'divider';
    const more = actions.querySelector(SELECTORS.photo.viewerMore);
    const before = more?.previousElementSibling;
    if (before?.classList.contains('divider')) {
      actions.insertBefore(divider, before);
      actions.insertBefore(group, before);
    } else actions.append(divider, group);
  }
  function stop(): void {
    off?.(); off = null;
    if (timer !== null) clearInterval(timer);
    timer = null;
    if (document.getElementById(id)) hideBrandTooltip();
    for (const suffix of ['', '-style', '-divider']) document.getElementById(id + suffix)?.remove();
  }
  return {
    reapplyOnNavigate: true, reapplyOnLanguageChange: true,
    enable: () => { stop(); if (!isVkHost()) return; scan(); off = ctx.observeChanges('photo_search', scan); timer = setInterval(scan, 800); },
    disable: stop,
  };
}
