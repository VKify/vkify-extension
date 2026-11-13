import type { SharedContext } from '../shared.js';
import { CALLS_PROMO_SELECTOR } from './calls-selectors.js';
import { createCandidateIndex } from '@/content/core/dom/candidate-index.js';

/** Calls promos are client-built: count only banners actually hidden by our stylesheet. */
export function createCallsPromoStats(shared: SharedContext) {
  const recorded = new WeakSet<Element>();
  const index = createCandidateIndex();
  let stop: (() => void) | undefined;
  let frame = 0;
  return {
    enable() {
      if (stop) return;
      stop = index.add({
        selector: 'section:is(.vkuiInternalTappable, .vkuiBanner__host)',
        context: anchor => anchor.parentElement,
        select: anchor => anchor.matches(CALLS_PROMO_SELECTOR) ? [anchor] : [],
      }, matches => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          for (const element of matches) {
            if (!element.isConnected || recorded.has(element)
              || !document.documentElement.hasAttribute('data-vkify-block_recommendations_calls')
              || getComputedStyle(element).display !== 'none') continue;
            recorded.add(element);
            shared.recordBlock('ad', location.hostname || 'vk.ru',
              (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 240),
              'dom', 'Промобаннер звонков', undefined, 'block_recommendations_calls');
          }
        });
      });
    },
    disable() { stop?.(); stop = undefined; cancelAnimationFrame(frame); },
  };
}
