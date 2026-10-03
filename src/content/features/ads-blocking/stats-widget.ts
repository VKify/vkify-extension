import type { FeatureContext } from '../../core/feature-context.js';
import { createWidgetFeature } from '../../ui/create-widget-feature.js';
import { createFloatingWidget, type FloatingWidgetHandle } from '../../ui/floating-widget.js';
import { getLang, t } from '../../i18n/index.js';

const KEYS = ['stats_ads_blocked', 'stats_trackers_blocked'] as const;
const CSS_ID = 'vkify-ad-stats-css';
const COLLAPSED_KEY = 'vkify:ad-stats:collapsed';
const CSS = `
  .vkify-ad-stats { padding: 14px; }
  .vkify-ad-stats__label { color: var(--vkui--color_text_secondary, #818c99); font-size: 11px; line-height: 1.5; }
  .vkify-ad-stats__total { display: block; margin: 2px 0 12px; font-size: 32px; line-height: 1.2; font-weight: 750; letter-spacing: -1px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .vkify-ad-stats__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .vkify-ad-stats__card { padding: 9px 10px; border-radius: 10px; background: var(--vkui--color_background_secondary, #f2f3f5); min-width: 0; }
  .vkify-ad-stats__value { display: block; font-size: 17px; font-weight: 700; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .vkify-ad-stats__card:first-child .vkify-ad-stats__value { color: var(--vkui--color_text_accent, #2688eb); }
`;
const count = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

/** Reuses batched blocker counters. No polling, DOM scans, or extra storage writes. */
export function createAdStatsWidget(ctx: FeatureContext) {
  let widget: FloatingWidgetHandle | null = null;
  let values: Record<string, unknown> = {};
  let frame = 0;
  let formatter = new Intl.NumberFormat(getLang());
  let refs: { total: HTMLElement; ads: HTMLElement; trackers: HTMLElement } | null = null;

  function render(): void {
    frame = 0;
    if (!refs || document.hidden) return;
    const ads = count(values[KEYS[0]]), trackers = count(values[KEYS[1]]), total = ads + trackers;
    for (const [node, value] of [[refs.total, total], [refs.ads, ads], [refs.trackers, trackers]] as const) {
      const text = formatter.format(value);
      if (node.textContent !== text) node.textContent = text;
    }
  }
  function schedule(): void {
    if (!frame && !document.hidden) frame = requestAnimationFrame(render);
  }
  function buildBody(body: HTMLElement): void {
    formatter = new Intl.NumberFormat(getLang());
    body.classList.add('vkify-ad-stats');
    const element = (tag: string, className: string, text = ''): HTMLElement => {
      const node = document.createElement(tag); node.className = className; node.textContent = text; return node;
    };
    const total = element('strong', 'vkify-ad-stats__total', '—');
    const grid = element('div', 'vkify-ad-stats__grid');
    const card = (key: string): HTMLElement => {
      const node = element('div', 'vkify-ad-stats__card');
      const value = element('strong', 'vkify-ad-stats__value', '—');
      node.append(element('span', 'vkify-ad-stats__label', t(`adStats.${key}`)), value);
      grid.append(node); return value;
    };
    const ads = card('ads'), trackers = card('trackers');
    body.replaceChildren(element('span', 'vkify-ad-stats__label', t('adStats.total')), total, grid);
    refs = { total, ads, trackers };
    schedule();
  }

  return createWidgetFeature(ctx, {
    id: 'ad-stats', featureKey: 'ad_stats_widget',
    create: () => {
      if (!document.getElementById(CSS_ID)) {
        const style = document.createElement('style'); style.id = CSS_ID; style.textContent = CSS; document.head.append(style);
      }
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('viewBox', '0 0 24 24'); icon.setAttribute('width', '16'); icon.setAttribute('height', '16'); icon.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS(icon.namespaceURI, 'path');
      path.setAttribute('d', 'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Zm-4 9 3 3 5-6');
      path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '1.8'); path.setAttribute('stroke-linejoin', 'round');
      icon.append(path); icon.style.color = 'var(--vkui--color_text_accent, #2688eb)';
      let collapsed = false;
      try { collapsed = localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { /* unavailable */ }
      widget = createFloatingWidget({ id: 'ad-stats', title: t('adStats.title'), icon, width: 240,
        initialPosition: { left: 16, top: 340 }, collapsible: true, startCollapsed: collapsed,
        closeTitle: t('adStats.close'), onClose: () => { void ctx.setSetting('ad_stats_widget', false); },
        onToggle: value => { try { localStorage.setItem(COLLAPSED_KEY, value ? '1' : '0'); } catch { /* unavailable */ } },
      });
      buildBody(widget.body); return widget;
    },
    onMount: () => {
      let active = true;
      const changed = new Set<string>();
      const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
        if (area !== 'local') return;
        let dirty = false;
        for (const key of KEYS) if (key in changes) { changed.add(key); values[key] = changes[key].newValue; dirty = true; }
        if (dirty) schedule();
      };
      chrome.storage.onChanged.addListener(listener);
      void chrome.storage.local.get([...KEYS]).then(data => {
        if (!active) return;
        for (const key of KEYS) if (!changed.has(key)) values[key] = data[key];
        schedule();
      }).catch(() => { /* Preserve placeholders if storage is unavailable. */ });
      document.addEventListener('visibilitychange', schedule);
      return () => {
        active = false;
        chrome.storage.onChanged.removeListener(listener);
        document.removeEventListener('visibilitychange', schedule);
        if (frame) cancelAnimationFrame(frame); frame = 0;
      };
    },
    onLanguageChange: handle => {
      const title = handle.head.querySelector('.vkify-fw__title');
      if (title) title.textContent = t('adStats.title');
      const close = handle.head.querySelector<HTMLButtonElement>('[data-fw-close]');
      if (close) close.title = t('adStats.close');
      buildBody(handle.body);
    },
    onUnmount: () => { widget = null; refs = null; values = {}; },
  });
}
