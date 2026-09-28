import type { FeatureContext } from '@/content/core/feature-context.js';
import { handlerFeature, settingsPlugin } from '@/content/core/features/index.js';
import { createFloatingWidget, type FloatingWidgetHandle } from '@/content/ui/floating-widget.js';
import { getLang, t } from '@/content/i18n/index.js';
import { parseClockSettings } from '@/shared/clock/settings.js';
import { createClockRenderer } from '@/shared/clock/renderer.js';
import { clockPosition } from '@/shared/clock/style.js';
import { installClockControls } from './controls.js';
import css from './clock.css?inline';

export function createClockFeature(ctx: FeatureContext) {
  let widget: FloatingWidgetHandle | null = null;
  let output = '';
  let element: HTMLDivElement | null = null;
  let renderer: ReturnType<typeof createClockRenderer> | null = null;
  let controls: (() => void) | null = null;
  let settings = parseClockSettings(null);
  let revision = 0;
  const place = (): void => {
    if (!element || widget) return;
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
        window.addEventListener('resize', place);
      }
      if (output !== settings.output) {
        controls?.(); controls = null;
        widget?.destroy(); widget = null;
        output = settings.output;
        element.style.cssText = '';
        element.dataset.output = output;
        if (output === 'widget') {
          let geometry: Record<string, number> = {};
          try { geometry = JSON.parse(localStorage.getItem('vkify-clock-widget') || '{}') || {}; } catch { /* defaults */ }
          widget = createFloatingWidget({
            id: 'clock', title: t('widget.clock'), titleKey: 'widget.clock',
            width: Number.isFinite(geometry.width) ? Math.max(220, geometry.width) : 280,
            height: Number.isFinite(geometry.height) ? Math.max(100, geometry.height) : 140,
            minWidth: 220, minHeight: 100, resizable: true, collapsible: true,
            initialPosition: 'bottom-left',
            onSizeChange: size => {
              try { localStorage.setItem('vkify-clock-widget', JSON.stringify(size)); } catch { /* storage unavailable */ }
            },
            onClose: () => { void ctx.setSetting('clock_enabled', false); },
          });
          widget.body.classList.add('vkify-clock-widget-body');
          widget.body.append(element); widget.mount();
        } else {
          controls = installClockControls(element, () => settings, next => {
            settings = next; renderer?.update(settings, getLang());
          }, () => { void ctx.setSetting('clock_settings', JSON.stringify(settings)); });
        }
      }
      if (widget) {
        if (element.parentElement !== widget.body) widget.body.append(element);
        widget.reattach();
      } else if (!element.isConnected) document.body.append(element);
      renderer?.update(settings, getLang());
    },
    disable() {
      revision++; controls?.(); controls = null;
      renderer?.dispose(); renderer = null;
      widget?.destroy(); widget = null; output = '';
      element?.remove(); element = null;
      window.removeEventListener('resize', place); ctx.removeCSS('clock-style');
    },
  };
  return handlerFeature({ id: 'clock_enabled', name: 'Clock', category: 'appearance',
    settingsKeys: ['clock_enabled', 'clock_settings'], reapplyOnNavigate: true,
    reapplyOnUpdate: true, reapplyOnLanguageChange: true,
    plugins: [settingsPlugin(['clock_settings'])], handler });
}
