import type { FeatureContext } from '@/content/core/feature-context.js';
import { handlerFeature, settingsPlugin } from '@/content/core/features/index.js';
import { getLang } from '@/content/i18n/index.js';
import { parseClockSettings } from '@/shared/clock/settings.js';
import { createClockRenderer } from '@/shared/clock/renderer.js';
import { clockPosition } from '@/shared/clock/style.js';
import { installClockControls } from './controls.js';
import css from './clock.css?inline';

export function createClockFeature(ctx: FeatureContext) {
  let element: HTMLDivElement | null = null;
  let renderer: ReturnType<typeof createClockRenderer> | null = null;
  let controls: (() => void) | null = null;
  let settings = parseClockSettings(null);
  let revision = 0;
  const place = (): void => {
    if (!element) return;
    const pos = clockPosition(settings, innerWidth, innerHeight, element.offsetWidth, element.offsetHeight);
    element.style.left = `${pos.left}px`; element.style.top = `${pos.top}px`;
  };
  const handler = {
    async enable() {
      const request = ++revision;
      const raw = await ctx.getSetting('clock_settings');
      if (request !== revision) return;
      settings = parseClockSettings(raw);
      if (!element) {
        ctx.injectCSS('clock-style', css);
        element = document.createElement('div'); element.id = 'vkify-clock';
        element.setAttribute('role', 'timer'); element.setAttribute('aria-live', 'off');
        renderer = createClockRenderer(element, place);
        controls = installClockControls(element, () => settings, next => {
          settings = next; renderer?.update(settings, getLang());
        }, () => { void ctx.setSetting('clock_settings', JSON.stringify(settings)); });
        window.addEventListener('resize', place);
      }
      // Reattach after a replaced body without allocating another renderer/listener.
      if (!element.isConnected) document.body.append(element);
      renderer?.update(settings, getLang());
    },
    disable() {
      revision++; controls?.(); controls = null;
      renderer?.dispose(); renderer = null;
      element?.remove(); element = null;
      window.removeEventListener('resize', place); ctx.removeCSS('clock-style');
    },
  };
  return handlerFeature({ id: 'clock_enabled', name: 'Clock', category: 'appearance',
    settingsKeys: ['clock_enabled', 'clock_settings'], reapplyOnNavigate: true,
    reapplyOnUpdate: true, reapplyOnLanguageChange: true,
    plugins: [settingsPlugin(['clock_settings'])], handler });
}
