import { createSearchMenu } from './search-menu.js';
import { getSearchPhotoUrl, photoSearchButtons, photoSearchProviders, photoSearchUrl, PHOTO_SEARCH_NAMES } from '@/shared/photo-search.js';
import type { FeatureContext } from '@/content/core/feature-context.js';
import type { FeatureHandler } from '@/types/index.js';
import { SELECTORS } from '@/content/selectors/index.js';
import { getLang } from '@/content/i18n/index.js';
import { GOOGLE_LOGO, YANDEX_LOGO, EXTRA_SEARCH_LOGOS } from './search-logos.js';
import { attachBrandTooltip, hideBrandTooltip } from '../_shared/brand-tooltip.js';
import { isVkHost } from './api.js';

export function createPhotoSearchFeature(ctx: FeatureContext): FeatureHandler {
  const id = 'vkify-photo-search';
  let destroyMenu: (() => void) | null = null;
  let off: (() => void) | null = null;
  let settings: Record<string, unknown> = {};
  let unsubscribe: (() => void) | null = null;
  let generation = 0;
  const providers = () => photoSearchProviders(settings.photo_search_providers, getLang());
  const preferred = () => providers().find(id => id === settings.photo_search_default) || providers()[0];
  function search(image: HTMLImageElement | null | undefined, provider = preferred()): void {
    if (!image || !provider) return;
    const original = document.querySelector<HTMLAnchorElement>('#pv_more_act_download')?.href;
    const source = original && /^https?:[/][/]/.test(original) ? original : getSearchPhotoUrl(image);
    if (!source) {
      window.alert(getLang() === 'ru' ? 'Нет публичной ссылки на фото. Сохраните изображение и загрузите его на сайте поисковика.' : 'No public image URL. Save the image and upload it on the search website.');
      return;
    }
    const url = photoSearchUrl(provider, source);
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  function scan(): void {
    const viewer = document.querySelector(SELECTORS.photo.viewer);
    const actions = viewer?.querySelector(SELECTORS.photo.viewerActions);
    if (!actions || actions.querySelector('#' + id) || !providers().length) return;
    destroyMenu?.(); destroyMenu = null;
    const group = document.createElement('span');
    group.id = id;
    const ru = getLang() === 'ru';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', ru ? 'Найти по фото' : 'Search by image');
    if (!document.getElementById(id + '-style')) {
      const style = document.createElement('style');
      style.id = id + '-style';
      style.textContent = `#${id} { display: inline-flex; align-items: center; gap: 4px; vertical-align: middle; }
        #${id} .vkify-photo-search-primary { appearance: none; border: 0; padding: 0 4px; background: transparent; cursor: pointer; display: inline-flex; align-items: center; }
        #${id} img { width: 16px; height: 16px; vertical-align: middle; object-fit: contain; }
        .vkify-photo-search-toggle { appearance: none; border: 0; padding: 0; margin: 0; background: transparent; font: inherit; color: inherit; cursor: pointer; }
        .vkify-photo-search-card img { flex: 0 0 20px; object-fit: contain; }
        .vkify-photo-search-card .vkify-card__item:focus-visible { outline: 2px solid var(--vkui--color_text_accent, #2688eb); outline-offset: -2px; }`;
      document.head.append(style);
    }
    const primary = preferred()!;
    for (const quickProvider of photoSearchButtons(settings.photo_search_buttons, providers(), primary)) {
      const primaryButton = document.createElement('button');
      primaryButton.type = 'button'; primaryButton.className = 'vkify-photo-search-primary';
      const primaryLabel = (ru ? 'Найти по фото в ' : 'Search image with ') + PHOTO_SEARCH_NAMES[quickProvider];
      primaryButton.setAttribute('aria-label', primaryLabel);
      attachBrandTooltip(primaryButton, primaryLabel);
      const primaryLogo = document.createElement('img');
      primaryLogo.src = quickProvider === 'google' ? GOOGLE_LOGO : quickProvider === 'yandex' ? YANDEX_LOGO : EXTRA_SEARCH_LOGOS[quickProvider];
      primaryLogo.alt = ''; primaryButton.append(primaryLogo);
      primaryButton.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); search(viewer?.querySelector<HTMLImageElement>('#pv_photo img, .pv_photo img'), quickProvider); });
      group.append(primaryButton);
    }
    const menuItems: HTMLButtonElement[] = [];
    for (const provider of [primary!, ...providers().filter(value => value !== primary)]) {
      const label = provider === 'yandex' && ru ? 'Яндекс' : PHOTO_SEARCH_NAMES[provider];
      const button = document.createElement('button');
      button.type = 'button';
      const description = (ru ? 'Найти по фото в ' + label : 'Search image with ' + label) + (provider === 'ozon' || provider === 'wildberries' ? (ru ? ' — через Google Lens' : ' — via Google Lens') : '');
      if (provider === 'ozon' || provider === 'wildberries') button.dataset.searchHint = ru ? 'Через Google Lens' : 'Via Google Lens';
      button.setAttribute('aria-label', description);
      const logo = document.createElement('img');
      logo.src = provider === 'google' ? GOOGLE_LOGO : provider === 'yandex' ? YANDEX_LOGO : EXTRA_SEARCH_LOGOS[provider] || '';
      logo.width = 16; logo.height = 16;
      logo.alt = ''; logo.setAttribute('aria-hidden', 'true');
      if (provider === 'google' || provider === 'yandex' || EXTRA_SEARCH_LOGOS[provider]) button.append(logo);
      else { button.textContent = PHOTO_SEARCH_NAMES[provider]; button.style.width = 'auto'; button.style.font = 'inherit'; }
      button.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation();
        const image = viewer?.querySelector<HTMLImageElement>('#pv_photo img, .pv_photo img');
        search(image, provider);
      });
      const icon = document.createElement('div'); icon.className = 'pv_more_act_item_icon';
      icon.append(...Array.from(button.childNodes));
      button.replaceChildren(icon, document.createTextNode(label));
      if (provider === primary) { button.dataset.default = ''; button.setAttribute('aria-description', ru ? 'По умолчанию' : 'Default search engine'); }
      menuItems.push(button);
    }
    let menuElement: HTMLElement | null = null;
    if (menuItems.length) {
      const menu = createSearchMenu(ru ? 'Найти по фото' : 'Search by image', menuItems);
      menuElement = menu.element;
      destroyMenu = menu.destroy;
    }
    const divider = document.createElement('span');
    divider.id = id + '-divider'; divider.className = 'divider';
    const more = Array.from(actions.querySelectorAll(SELECTORS.photo.viewerMore)).find(element => !group.contains(element));
    const before = more?.previousElementSibling;
    if (before?.classList.contains('divider')) {
      actions.insertBefore(divider, before);
      actions.insertBefore(group, before);
    } else actions.append(divider, group);
    if (menuElement) group.after(menuElement);
  }
  function stop(): void {
    destroyMenu?.(); destroyMenu = null;
    off?.(); off = null;
    generation++; unsubscribe?.(); unsubscribe = null;
    if (document.getElementById(id)) hideBrandTooltip();
    for (const suffix of ['', '-style', '-divider']) document.getElementById(id + suffix)?.remove();
  }
  return {
    reapplyOnNavigate: true, reapplyOnLanguageChange: true,
    enable: async () => {
      stop(); if (!isVkHost()) return;
      const ownGeneration = generation;
      settings = await ctx.getAllSettings();
      if (ownGeneration !== generation) return;
      scan(); off = ctx.observeChanges('photo_search', scan);
      unsubscribe = ctx.onStorageChange((key, value) => {
        if (!key.startsWith('photo_search_')) return;
        settings[key] = value;
        for (const suffix of ['', '-divider']) document.getElementById(id + suffix)?.remove();
        scan();
      });
    },
    disable: stop,
  };
}
