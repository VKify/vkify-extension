import type { FeatureContext } from '@/content/core/feature-context.js';
import { handlerFeature, settingsPlugin } from '@/content/core/features/index.js';
import { isSafeLogoResource } from '@/shared/custom-logo.js';
import css from './custom-logo.css?inline';

const ID = 'custom_logo_enabled';
const SELECTOR = 'a[data-testid="top-logo-link"]';

export function createCustomLogoHandler(ctx: FeatureContext) {
  let revision = 0;
  let source = '';
  let off: (() => void) | null = null;
  const images = new Map<Element, HTMLImageElement>();

  const clear = (): void => {
    images.forEach((image, link) => {
      image.onload = null; image.onerror = null;
      image.remove(); link.removeAttribute('data-vkify-custom-logo');
    });
    images.clear();
  };
  const apply = (): void => {
    images.forEach((image, link) => {
      if (!link.isConnected || image.parentElement !== link) {
        image.onload = null; image.onerror = null;
        image.remove(); link.removeAttribute('data-vkify-custom-logo'); images.delete(link);
      }
    });
    if (!source) return;
    document.querySelectorAll(SELECTOR).forEach(link => {
      if (images.has(link)) return;
      const image = document.createElement('img');
      image.className = 'vkify-custom-logo'; image.alt = ''; image.setAttribute('aria-hidden', 'true');
      image.referrerPolicy = 'no-referrer'; image.draggable = false;
      image.onload = () => {
        if (images.get(link) === image && image.parentElement === link) link.setAttribute('data-vkify-custom-logo', 'true');
      };
      // Retain VK's original SVG if the URL is unavailable or blocked by CSP.
      image.onerror = () => link.removeAttribute('data-vkify-custom-logo');
      images.set(link, image); image.src = source; link.append(image);
    });
  };
  return {
    async enable() {
      const request = ++revision;
      const value = await ctx.getSetting('custom_logo');
      if (request !== revision) return;
      const next = isSafeLogoResource(value) ? value : '';
      if (next !== source) { clear(); source = next; }
      ctx.injectCSS(ID, css);
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
    settingsKeys: [ID, 'custom_logo'], reapplyOnNavigate: true,
    plugins: [settingsPlugin(['custom_logo'])], handler: createCustomLogoHandler(ctx),
  });
}
