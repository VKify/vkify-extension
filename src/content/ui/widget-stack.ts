import { widgetIcon } from './widget-icons.js';
import { storage } from '@/content/core/storage.js';
import { t, onLanguageChange } from '@/content/i18n/index.js';
import { isVkVideoHost } from '@/content/features/center/music/host.js';
import { STACK_KEY, WIDGET_CATALOG, definitionKey, isWidgetKey, widgetKey, parseStack, parseWidget, orderedWidgets, reorderWidgets, type WidgetPosition } from '@/shared/widget-stack.js';

export interface StackMember {
  id: string; title: string; root: HTMLElement; head: HTMLElement;
  setPosition(position: WidgetPosition | null): void;
  cancelDrag(): void;
  restorePosition(): void;
  dispose(): void;
}
const relevant = isWidgetKey;
const CSS = `
.vkify-stack { position:fixed; z-index:110; display:flex; flex-direction:column; gap:8px; box-sizing:border-box;
 color:var(--vkui--color_text_primary,#19191a); font:13px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
.vkify-stack[hidden] { display:none; }
.vkify-stack__bar { flex-shrink:0; display:flex; gap:6px; align-items:center; padding:8px; border-radius:20px;
 background:color-mix(in srgb,var(--vkui--color_background_modal,#fff) 88%,transparent); backdrop-filter:blur(18px);
 box-shadow:0 4px 20px #0002; cursor:move; touch-action:none; }
.vkify-stack button { display:inline-flex; align-items:center; justify-content:center; gap:6px; font:inherit; border:0; border-radius:12px; padding:6px 8px; cursor:pointer;
 color:inherit; background:color-mix(in srgb,var(--vkui--color_background_modal,#fff) 80%,transparent); }
.vkify-stack button:focus-visible,.vkify-fw button:focus-visible,.vkify-fw__head:focus-visible { outline:2px solid var(--vkui--color_stroke_accent,#2688eb); outline-offset:-2px; }
.vkify-stack__items { display:flex; flex-direction:column; gap:10px; overflow:auto; min-height:0; padding:2px; overscroll-behavior:contain; }
.vkify-stack__items[hidden] { display:none; }
.vkify-fw.is-stacked { position:relative!important; inset:auto!important; width:100%!important; min-width:0!important;
 max-width:100%!important; flex-shrink:0; resize:none!important; z-index:auto!important; box-sizing:border-box; box-shadow:0 4px 14px #0002; }
.vkify-fw.is-stack-hidden { display:none!important; }
.vkify-stack[data-animation="false"] * { animation:none!important; transition:none!important; }
@media(prefers-reduced-motion:reduce) { .vkify-stack *, .vkify-fw { animation:none!important; transition:none!important; } }
`;

/** One manager per content realm. It owns no feature content and survives SPA remounts. */
export class WidgetStackManager {
  private members = new Map<string, StackMember>();
  private values: Record<string, unknown> = {};
  private root: HTMLElement | null = null;
  private items: HTMLElement | null = null;
  private toggle: HTMLButtonElement | null = null;
  private off: (() => void) | null = null;
  private offLanguage: (() => void) | null = null;
  private observer: ResizeObserver | null = null;
  private reconnect: MutationObserver | null = null;
  private abort: AbortController | null = null;
  private stopPointer: (() => void) | null = null;
  private generation = 0;
  private destroying = false;

  register(member: StackMember): () => void {
    if (!this.root) this.start();
    this.members.set(member.id, member);
    if (!WIDGET_CATALOG.some(w => w.id === member.id)) {
      void storage.set(definitionKey(member.id), { title: member.title }).catch(() => {});
    }
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'vkify-fw__btn'; button.dataset.stackToggle = ''; button.append(widgetIcon('stack'));
    const toggle = (): void => {
      const state = parseWidget(this.values[widgetKey(member.id)]);
      this.write({ [widgetKey(member.id)]: { ...state, mode: state.mode === 'free' ? 'stacked' : 'free' } });
    };
    button.addEventListener('click', toggle);
    member.head.append(button);
    const pointer = (event: PointerEvent): void => this.reorderPointer(member, event);
    const keyboard = (event: KeyboardEvent): void => {
      if (!this.isStacked(member.id) || event.target !== member.head || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const ids = this.stackIds(); const index = ids.indexOf(member.id);
      const target = ids[index + (event.key === 'ArrowUp' ? -1 : 1)];
      if (target) this.write(reorderWidgets(ids, member.id, target, this.values));
      member.head.focus();
    };
    member.head.addEventListener('pointerdown', pointer);
    member.head.addEventListener('keydown', keyboard);
    this.observer?.observe(member.root);
    this.apply();
    return () => {
      this.stopPointer?.();
      button.remove(); member.head.removeEventListener('pointerdown', pointer); member.head.removeEventListener('keydown', keyboard);
      this.observer?.unobserve(member.root); this.members.delete(member.id);
      if (!this.members.size) this.destroy(); else this.apply();
    };
  }

  isStacked(id: string): boolean { return parseWidget(this.values[widgetKey(id)]).mode === 'stacked'; }
  refresh(): void { if (this.root) this.apply(); }
  private stackIds(): string[] {
    const ids = new Set([...this.members.keys(), ...Object.keys(this.values).filter(k => k.startsWith('widget:')).map(k => k.slice(7))]);
    return orderedWidgets([...ids].filter(id => this.isStacked(id)), this.values);
  }
  private write(patch: Record<string, unknown>): void {
    Object.assign(this.values, patch); this.apply();
    void storage.setMultiple(patch).catch(error => console.warn('[VKify] Widget stack save failed', error));
  }
  private start(): void {
    const generation = ++this.generation;
    this.abort = new AbortController(); const signal = this.abort.signal;
    const style = document.createElement('style'); style.id = 'vkify-widget-stack-css'; style.textContent = CSS; document.head.append(style);
    this.root = document.createElement('aside'); this.root.className = 'vkify-stack';
    const bar = document.createElement('div'); bar.className = 'vkify-stack__bar';
    this.toggle = document.createElement('button'); this.toggle.type = 'button';
    this.toggle.addEventListener('click', () => this.write({ [STACK_KEY]: { ...parseStack(this.values[STACK_KEY]), collapsed: !parseStack(this.values[STACK_KEY]).collapsed } }), { signal });
    const grip = widgetIcon('grip'); bar.append(grip, this.toggle);
    for (const side of ['left', 'right', 'free'] as const) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.side = side;
      button.append(widgetIcon(side));
      button.addEventListener('click', () => this.write({ [STACK_KEY]: { ...parseStack(this.values[STACK_KEY]), side } }), { signal }); bar.append(button);
    }
    bar.addEventListener('pointerdown', event => this.moveStack(event), { signal });
    this.items = document.createElement('div'); this.items.className = 'vkify-stack__items'; this.items.id = 'vkify-stack-items';
    this.toggle.setAttribute('aria-controls', this.items.id);
    this.root.append(bar, this.items); document.body.append(this.root);
    this.observer = new ResizeObserver(() => this.layout()); this.observer.observe(this.root);
    window.addEventListener('resize', () => this.layout(), { signal });
    this.reconnect = new MutationObserver(() => {
      if (this.root && !this.root.isConnected && document.body) this.apply();
    });
    this.reconnect.observe(document.documentElement, { childList: true });
    this.reconnect.observe(document.body, { childList: true });
    const changed = new Set<string>();
    this.off = storage.onChange((key, value) => {
      if (!relevant(key)) return;
      changed.add(key); this.values[key] = value;
      if (key === STACK_KEY || key.startsWith('widget:')) this.apply();
    });
    this.offLanguage = onLanguageChange(() => this.apply());
    void storage.getAll().then(values => {
      if (generation !== this.generation) return;
      for (const [key, value] of Object.entries(values)) if (relevant(key) && !changed.has(key)) this.values[key] = value;
      this.apply();
    }).catch(error => console.warn('[VKify] Widget stack load failed', error));
  }
  private apply(): void {
    if (!this.root || !this.items || !this.toggle) return;
    const config = parseStack(this.values[STACK_KEY]);
    const siteHidden = isVkVideoHost() && !config.showOnVkVideo;
    const oldRects = new Map([...this.members].map(([id, m]) => [id, m.root.getBoundingClientRect()]));
    const focus = document.activeElement as HTMLElement | null;
    if (!this.root.isConnected) {
      document.body.append(this.root);
      this.reconnect?.observe(document.body, { childList: true });
    }
    const ids = this.stackIds();
    for (const member of this.members.values()) {
      const state = parseWidget(this.values[widgetKey(member.id)]);
      const stacked = state.mode === 'stacked';
      const wasStacked = member.root.classList.contains('is-stacked');
      if (wasStacked !== stacked) member.cancelDrag();
      member.root.classList.toggle('is-stacked', stacked);
      member.root.classList.toggle('is-stack-hidden', !state.visible || siteHidden);
      member.head.tabIndex = stacked ? 0 : -1;
      if (stacked) member.head.setAttribute('aria-label', t('stack.reorder')); else member.head.removeAttribute('aria-label');
      const button = member.head.querySelector<HTMLButtonElement>('[data-stack-toggle]');
      if (button) { button.replaceChildren(widgetIcon(stacked ? 'free' : 'stack')); button.title = t(stacked ? 'stack.detach' : 'stack.attach'); button.setAttribute('aria-label', button.title); button.setAttribute('aria-pressed', String(stacked)); }
      const parent = stacked ? this.items : document.body;
      if (member.root.parentElement !== parent) parent.append(member.root);
      if (wasStacked && !stacked) member.restorePosition();
    }
    let previous: HTMLElement | null = null;
    for (const id of ids) {
      const node = this.members.get(id)?.root; if (!node) continue;
      const expected: Element | null = previous ? previous.nextElementSibling : this.items.firstElementChild;
      if (expected !== node) this.items.insertBefore(node, expected);
      previous = node;
    }
    const count = ids.filter(id => { const m = this.members.get(id); return m && !m.root.classList.contains('is-hidden') && parseWidget(this.values[widgetKey(id)]).visible; }).length;
    this.root.hidden = count === 0 || siteHidden;
    this.root.setAttribute('aria-label', t('stack.title'));
    this.root.dataset.animation = String(config.animation);
    this.root.style.opacity = String(config.opacity);
    if (config.collapsed && focus && this.items.contains(focus)) this.toggle.focus();
    const collapsedChanged = this.items.hidden !== config.collapsed;
    this.items.hidden = config.collapsed;
    this.toggle.replaceChildren(widgetIcon(config.collapsed ? 'stack' : 'collapse'), document.createTextNode(config.collapsed ? String(count) : `${t('stack.title')} · ${count}`));
    this.toggle.setAttribute('aria-label', `${t('stack.title')} · ${count}`);
    this.toggle.setAttribute('aria-expanded', String(!config.collapsed));
    this.root.querySelectorAll<HTMLButtonElement>('[data-side]').forEach(button => {
      button.title = t(`stack.${button.dataset.side}`); button.setAttribute('aria-label', button.title);
      button.setAttribute('aria-pressed', String(button.dataset.side === config.side));
    });
    this.layout();
    if (collapsedChanged && config.animation && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.root.animate?.([{ opacity: .5, transform: 'translateY(4px)' }, { opacity: config.opacity, transform: 'none' }], { duration: 180, easing: 'ease-out' });
    }
    if (focus && document.activeElement !== focus && focus.isConnected && !focus.closest('[hidden],.is-stack-hidden')) focus.focus({ preventScroll: true });
    if (config.animation && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (const [id, member] of this.members) {
        const old = oldRects.get(id)!; const next = member.root.getBoundingClientRect();
        if (old.width && next.width && (old.top !== next.top || old.left !== next.left)) member.root.animate?.([
          { transform: `translate(${old.left - next.left}px,${old.top - next.top}px)` }, { transform: 'none' },
        ], { duration: 180, easing: 'ease-out' });
      }
    }
  }
  private layout(): void {
    if (!this.root) return;
    const c = parseStack(this.values[STACK_KEY]);
    // Reserve VK's top navigation; keep the stack below dialogs, unlike legacy free panels.
    const top = Math.min(64, innerHeight / 4), gap = Math.min(c.gap, innerWidth / 4);
    this.root.style.width = `${Math.min(c.collapsed ? 210 : c.width, Math.max(0, innerWidth - gap * 2))}px`;
    this.root.style.maxHeight = `${Math.max(0, innerHeight - top - gap)}px`;
    const w = this.root.offsetWidth, h = this.root.offsetHeight;
    const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(Math.max(lo, hi), n));
    const x = c.side === 'left' ? gap : c.side === 'right' ? innerWidth - w - gap : c.position?.left ?? gap;
    const y = c.side === 'free' && c.position ? c.position.top : c.vertical === 'top' ? top : c.vertical === 'bottom' ? innerHeight - h - gap : (innerHeight + top - gap - h) / 2;
    this.root.style.left = `${clamp(x, 0, innerWidth - w)}px`;
    this.root.style.top = `${clamp(y, top, innerHeight - h - gap)}px`;
  }
  private reorderPointer(member: StackMember, event: PointerEvent): void {
    if (!this.isStacked(member.id) || event.button !== 0 || (event.target as Element).closest('button,input,select,a')) return;
    event.preventDefault();
    this.stopPointer?.();
    let target = member.id;
    const move = (e: PointerEvent): void => {
      if (Math.abs(e.clientY - event.clientY) < 5) return;
      for (const id of this.stackIds()) {
        const root = this.members.get(id)?.root; if (!root || !root.offsetHeight) continue;
        const rect = root.getBoundingClientRect(); if (e.clientY >= rect.top && e.clientY <= rect.bottom) target = id;
      }
    };
    this.trackPointer(move, () => { if (target !== member.id) this.write(reorderWidgets(this.stackIds(), member.id, target, this.values)); });
  }
  private moveStack(event: PointerEvent): void {
    if (!this.root || event.button !== 0 || (event.target as Element).closest('button')) return;
    event.preventDefault(); this.stopPointer?.();
    const original = parseStack(this.values[STACK_KEY]);
    const rect = this.root.getBoundingClientRect(); let position: WidgetPosition | null = null;
    this.trackPointer(e => {
      position = { left: e.clientX - event.clientX + rect.left, top: e.clientY - event.clientY + rect.top };
      this.values[STACK_KEY] = { ...parseStack(this.values[STACK_KEY]), side: 'free', position }; this.layout();
    }, () => { if (position) this.write({ [STACK_KEY]: parseStack(this.values[STACK_KEY]) }); }, () => { this.values[STACK_KEY] = original; this.layout(); });
  }
  private trackPointer(move: (e: PointerEvent) => void, commit: () => void, onCancel?: () => void): void {
    const cleanup = (): void => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', cancel); this.stopPointer = null; };
    const up = (): void => { cleanup(); commit(); };
    const cancel = (): void => { cleanup(); onCancel?.(); this.layout(); };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', cancel);
    this.stopPointer = cleanup;
  }
  destroy(): void {
    if (this.destroying) return;
    this.destroying = true;
    for (const member of [...this.members.values()]) member.dispose();
    this.members.clear();
    this.generation++; this.stopPointer?.(); this.abort?.abort(); this.off?.(); this.offLanguage?.();
    this.observer?.disconnect(); this.reconnect?.disconnect(); this.root?.remove();
    document.getElementById('vkify-widget-stack-css')?.remove();
    this.root = null; this.items = null; this.toggle = null; this.values = {};
    this.off = null; this.offLanguage = null; this.observer = null; this.reconnect = null; this.abort = null;
    this.destroying = false;
  }
}
export const widgetStack = new WidgetStackManager();
