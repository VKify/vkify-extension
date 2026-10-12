import type { FeatureContext } from '@/content/core/feature-context.js';
import { handlerFeature, settingsPlugin } from '@/content/core/features/index.js';
import { isSafeLogoResource, parseLogoColorMode, logoTintColor, type LogoColorMode } from '@/shared/custom-logo.js';
import css from './custom-logo.css?inline';

const ID = 'custom_logo_enabled';
const SELECTOR = 'a[data-testid="top-logo-link"]';

export function createCustomLogoHandler(ctx: FeatureContext) {
  let revision = 0;
  let source = '';
  let mode: LogoColorMode = 'original';
  let color: unknown;
  let off: (() => void) | null = null;
  const images = new Map<Element, { image: HTMLImageElement; container: HTMLSpanElement }>();
  const tint = (container: HTMLSpanElement): void => {
    container.dataset.colorMode = mode;
    container.style.setProperty('--vkify-logo-mask', `url(${JSON.stringify(source)})`);
    container.style.setProperty('--vkify-logo-color', logoTintColor(mode, color));
  };

  const clear = (): void => {
    images.forEach(({ image, container }, link) => {
      image.onload = null; image.onerror = null;
      container.remove(); link.removeAttribute('data-vkify-custom-logo');
    });
    images.clear();
  };
  const apply = (): void => {
    images.forEach(({ image, container }, link) => {
      if (!link.isConnected || container.parentElement !== link || image.parentElement !== container) {
        image.onload = null; image.onerror = null;
        container.remove(); link.removeAttribute('data-vkify-custom-logo'); images.delete(link);
      }
    });
    if (!source) return;
    document.querySelectorAll(SELECTOR).forEach(link => {
      if (images.has(link)) return;
      const container = document.createElement('span');
      container.className = 'vkify-custom-logo'; container.setAttribute('aria-hidden', 'true');
      tint(container);
      const image = document.createElement('img');
      image.alt = ''; image.setAttribute('aria-hidden', 'true');
      image.referrerPolicy = 'no-referrer'; image.draggable = false;
      image.onload = () => {
        if (images.get(link)?.image === image && container.parentElement === link) link.setAttribute('data-vkify-custom-logo', 'true');
      };
      // Retain VK's original SVG if the URL is unavailable or blocked by CSP.
      image.onerror = () => link.removeAttribute('data-vkify-custom-logo');
      images.set(link, { image, container }); image.src = source; container.append(image); link.append(container);
    });
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
      if (next !== source) { clear(); source = next; }
      ctx.injectCSS(ID, css);
      images.forEach(({ container }) => tint(container));
      apply();
      off ??= ctx.observeChanges(ID, apply, { schedule: { debounceMs: 50 } });
    },
    disable() {
      revision++; off?.(); off = null; source = ''; clear(); ctx.removeCSS(ID);
    },
  };
}

export function createCustomLogoFeature(ctx: FeatureContext) {
  return handlerFeature({
    id: ID, name: 'Свой логотип', category: 'appearance', requiresDomLayer: true,
    settingsKeys: [ID, 'custom_logo', 'custom_logo_color_mode', 'custom_logo_color'], reapplyOnNavigate: true,
    plugins: [settingsPlugin(['custom_logo', 'custom_logo_color_mode', 'custom_logo_color'])], handler: createCustomLogoHandler(ctx),
  });
}
