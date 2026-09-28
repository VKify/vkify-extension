import type { FeatureContext } from '@/content/core/feature-context.js';
import type { FeatureHandler } from '@/types/index.js';
import type { FloatingWidgetHandle } from './floating-widget.js';
import { onLanguageChange } from '@/content/i18n/index.js';
import { widgetStorageKeys, widgetDefinition } from '@/shared/widget-stack.js';
import { widgetIsVisible } from '@/shared/widget-visibility.js';

export type WidgetFeatureContext = Pick<FeatureContext, 'getSetting' | 'onStorageChange'>;

interface WidgetFeatureOptions<C extends WidgetFeatureContext> {
  id: string;
  featureKey?: string;
  create: (ctx: C) => FloatingWidgetHandle;
  onMount?: (handle: FloatingWidgetHandle, ctx: C) => void | (() => void);
  onLanguageChange?: (handle: FloatingWidgetHandle, ctx: C) => void;
  onUnmount?: () => void;
  /** Transient visibility, e.g. downloads with active jobs or a player hotkey. */
  isVisible?: () => boolean;
}
/** Reusable window lifecycle; feature-specific rendering remains vanilla DOM. */
export function createWidgetFeature<C extends WidgetFeatureContext>(ctx: C, options: WidgetFeatureOptions<C>): FeatureHandler & { syncVisibility(): void } {
  let handle: FloatingWidgetHandle | null = null;
  let cleanup: (() => void) | void;
  let offStorage: (() => void) | undefined;
  let offLanguage: (() => void) | undefined;
  let revision = 0;
  let active = false;
  const keys = widgetStorageKeys(widgetDefinition(options.id, options.featureKey));
  const sync = async (): Promise<void> => {
    const request = ++revision;
    if (options.isVisible) {
      if (active && handle) { if (options.isVisible()) handle.show(); else handle.hide(); }
      return;
    }
    const values = Object.fromEntries(await Promise.all(keys.map(async key => [key, await ctx.getSetting(key)])));
    if (!active || request !== revision || !handle) return;
    if (widgetIsVisible(options.id, options.featureKey ?? '', values)) handle.show(); else handle.hide();
  };
  const mount = (): void => {
    if (!active) return;
    if (!handle) {
      handle = options.create(ctx);
      handle.mount();
      cleanup = options.onMount?.(handle, ctx);
      offStorage = ctx.onStorageChange(key => { if (keys.includes(key)) void sync().catch(error => console.warn('[VKify] Widget visibility sync failed', error)); });
      offLanguage = onLanguageChange(() => { if (handle) options.onLanguageChange?.(handle, ctx); });
    } else handle.reattach();
    void sync().catch(error => console.warn('[VKify] Widget visibility sync failed', error));
  };
  return {
    syncVisibility: () => { void sync().catch(error => console.warn('[VKify] Widget visibility sync failed', error)); },
    reapplyOnNavigate: true, reapplyOnUpdate: true, reapplyOnLanguageChange: true,
    enable() {
      active = true;
      if (document.body) mount();
      else { document.removeEventListener('DOMContentLoaded', mount); document.addEventListener('DOMContentLoaded', mount, { once: true }); }
    },
    disable() {
      active = false; revision++;
      document.removeEventListener('DOMContentLoaded', mount);
      offStorage?.(); offLanguage?.(); offStorage = offLanguage = undefined;
      cleanup?.(); cleanup = undefined;
      handle?.destroy(); handle = null;
      options.onUnmount?.();
    },
  };
}
