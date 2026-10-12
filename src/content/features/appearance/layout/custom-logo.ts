import type { FeatureContext } from '@/content/core/feature-context.js';
import { handlerFeature, settingsPlugin } from '@/content/core/features/index.js';
import { isSafeLogoResource, parseLogoColorMode, logoTintColor, type LogoColorMode } from '@/shared/custom-logo.js';
import css from './custom-logo.css?inline';
import { applyCustomLogoEarlyState } from './custom-logo-early.js';

const ID = 'custom_logo_enabled';
const SELECTOR = 'a[data-testid="top-logo-link"]';

export function createCustomLogoHandler(ctx: FeatureContext) {
  let revision = 0;
  let source = '';
  let mode: LogoColorMode = 'original';
  let color: unknown;
  let off: (() => void) | null = null;
  let cssInjected = false;
  let mask = '';
  const images = new Map<Element, { image: HTMLImageElement; container: HTMLSpanElement; off: () => void }>();
  const tint = (container: HTMLSpanElement): void => {
    if (container.dataset.colorMode !== mode) container.dataset.colorMode = mode;
    if (container.style.getPropertyValue('--vkify-logo-mask') !== mask) container.style.setProperty('--vkify-logo-mask', mask);
    const nextColor = logoTintColor(mode, color);
    if (container.style.getPropertyValue('--vkify-logo-color') !== nextColor) container.style.setProperty('--vkify-logo-color', nextColor);
  };

  const clear = (): void => {
    images.forEach(({ image, container, off }, link) => {
      off();
      image.onload = null; image.onerror = null;
      container.remove(); link.removeAttribute('data-vkify-custom-logo');
      link.removeAttribute('data-vkify-custom-logo-failed');
    });
    images.clear();
  };
  const prune = (): void => {
    images.forEach(({ image, container, off }, link) => {
      if (!link.isConnected || container.parentElement !== link || image.parentElement !== container) {
        off();
        image.onload = null; image.onerror = null;
        container.remove(); link.removeAttribute('data-vkify-custom-logo'); images.delete(link);
        link.removeAttribute('data-vkify-custom-logo-failed');
      }
    });
  };
  const mount = (link: Element): void => {
      prune();
      if (!source || !link.isConnected || images.has(link)) return;
      const container = document.createElement('span');
      link.removeAttribute('data-vkify-custom-logo-failed');
      container.className = 'vkify-custom-logo'; container.setAttribute('aria-hidden', 'true');
      tint(container);
      const image = document.createElement('img');
      image.alt = ''; image.setAttribute('aria-hidden', 'true');
      image.referrerPolicy = 'no-referrer'; image.draggable = false;
      image.onload = () => {
        if (images.get(link)?.image === image && container.parentElement === link) link.setAttribute('data-vkify-custom-logo', 'true');
      };
      // Retain VK's original SVG if the URL is unavailable or blocked by CSP.
      image.onerror = () => { link.removeAttribute('data-vkify-custom-logo'); link.setAttribute('data-vkify-custom-logo-failed', 'true'); };
      const stop = ctx.observeChanges(ID, () => mount(link), { container: link, schedule: 'frame' });
      images.set(link, { image, container, off: stop }); image.src = source; container.append(image); link.append(container);
  };
  return {
    async enable() {
      const request = ++revision;
      const [value, colorMode, customColor] = await Promise.all([
        ctx.getSetting('custom_logo'), ctx.getSetting('custom_logo_color_mode'), ctx.getSetting('custom_logo_color'),
      ]);
      if (request !== revision) return;
      const next = isSafeLogoResource(value) ? value : '';
      mode = parseLogoColorMode(colorMode); color = customColor;
      if (next !== source) { clear(); source = next; mask = source ? `url(${JSON.stringify(source)})` : ''; }
      applyCustomLogoEarlyState({ custom_logo_enabled: true, custom_logo: source, custom_logo_color_mode: mode, custom_logo_color: color });
      if (!cssInjected) { ctx.injectCSS(ID, css); cssInjected = true; }
      images.forEach(({ container }) => tint(container));
      if (source) {
        if (!off) off = ctx.observeMatches(ID, SELECTOR, mount);
        else document.querySelectorAll(SELECTOR).forEach(mount);
      } else { off?.(); off = null; }
    },
    disable() {
      revision++; off?.(); off = null; source = ''; mask = ''; clear(); ctx.removeCSS(ID); cssInjected = false;
      // Teardown changes presentation only; persistent mirrors follow stored settings.
      applyCustomLogoEarlyState({ custom_logo_enabled: false });
    },
  };
}

export function createCustomLogoFeature(ctx: FeatureContext) {
  return handlerFeature({
    id: ID, name: 'Свой логотип', category: 'appearance', requiresDomLayer: true,
    settingsKeys: [ID, 'custom_logo', 'custom_logo_color_mode', 'custom_logo_color'], reapplyOnUpdate: true,
    plugins: [settingsPlugin(['custom_logo', 'custom_logo_color_mode', 'custom_logo_color'])], handler: createCustomLogoHandler(ctx),
  });
}
