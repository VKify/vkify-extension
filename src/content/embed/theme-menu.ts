import { domObserver } from '@/content/core/dom/dom-observer.js';
import { THEMES } from '@/shared/theme-presets.js';
import { APPEARANCE_KEYS, buildApplyPatch, matchesProfile, type AppearanceProfile } from '@/shared/appearance-profile.js';
import { DEFAULT_BLOCK_RADIUS } from '@/shared/constants/theme-radius.js';
import { isSafeCssColor } from '@/shared/constants/settings-schema.js';
import { getLang } from '@/content/i18n/lang.js';
import { EMBED_PATH } from './constants.js';
import { PROFILE_MENU_SELECTOR } from './profile-menu-dom.js';

const SELECTOR = '[role="dialog"] > div';
const PROFILE_KEY = 'appearance_profiles';
const STYLE_ID = 'vkify-theme-menu-style';
const NATIVE_PATCH = { custom_theme_id: '', custom_theme: '', custom_accent: '', block_opacity: 1,
  glass_blur: 0, block_depth: false, theme_radius: DEFAULT_BLOCK_RADIUS, custom_css_enabled: false };
const css = `
  [data-vkify-theme-closing] { visibility:hidden !important; pointer-events:none !important; }
  [data-vkify-theme-extended] { max-height:min(520px,calc(100dvh - 96px)); overflow-y:auto; overscroll-behavior:contain; scrollbar-width:thin; }
  [data-vkify-theme-menu] { border:0; margin:0; padding:0; }
  [data-vkify-theme-separator] { height:1px; margin:6px 8px; background:var(--vkui--color_separator_primary,rgba(128,128,128,.18)); }
  .vkify-theme-menu-item { width:100%; box-sizing:border-box; border:0; background:transparent; color:inherit; font:inherit; text-align:left; cursor:pointer; }
  .vkify-theme-menu-item:is(:hover,:focus-visible) { background:var(--vkui--vkontakte_background_hover_alpha,rgba(128,128,128,.1)); }
  .vkify-theme-menu-item:focus-visible { outline:2px solid var(--vkui--color_stroke_accent,#0077ff); outline-offset:-2px; }
  .vkify-theme-menu-item:disabled { opacity:.5; cursor:wait; }
  .vkify-theme-menu-check { margin-left:auto; display:flex; color:var(--vkui--color_text_accent,#0077ff); }
  .vkify-theme-menu-swatch { display:inline-block; width:14px; height:14px; flex:0 0 14px; border-radius:50%; box-shadow:inset 0 0 0 1px var(--vkui--color_separator_primary,rgba(128,128,128,.3)); }
  [data-vkify-custom-theme-active] > :is([role="button"],button) svg[class*="check_alt"] { visibility:hidden; }
`;

/** A fixed VK dropdown can lose its transformed containing block during the
 * parent popover's exit animation. Hide before that layout change, not after
 * the asynchronous DOM cleanup, so it cannot flash at viewport coordinates. */
function guardThemeMenuClose(menu: HTMLElement): () => void {
  const sheet = menu.closest<HTMLElement>('[role="dialog"]');
  const shell = sheet?.parentElement ?? menu;
  const targets = new Set([menu, shell]);
  const hide = (): void => { targets.forEach(el => el.setAttribute('data-vkify-theme-closing', '')); };
  const outside = (event: Event): void => {
    if (event.target instanceof Node && !shell.contains(event.target)) hide();
  };
  const escape = (event: KeyboardEvent): void => { if (event.key === 'Escape') hide(); };
  document.addEventListener('pointerdown', outside, true);
  document.addEventListener('mousedown', outside, true);
  document.addEventListener('keydown', escape, true);
  window.addEventListener('popstate', hide);
  return () => {
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('mousedown', outside, true);
    document.removeEventListener('keydown', escape, true);
    window.removeEventListener('popstate', hide);
    targets.forEach(el => el.removeAttribute('data-vkify-theme-closing'));
  };
}

/** Reuse VK's actual cell markup and typography instead of drawing another UI. */
function nativeButton(rows: HTMLElement[], name: string, active = false, color?: unknown, accent?: unknown): HTMLButtonElement {
  const template = rows.find(row => !row.querySelector('svg[class*="check_alt"]')) ?? rows[0];
  const button = document.createElement('button');
  button.type = 'button'; button.className = `${template.className} vkify-theme-menu-item`;
  button.title = name;
  template.childNodes.forEach(node => button.append(node.cloneNode(true)));
  button.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
  const nativeText = template.textContent?.replace(/\s+/g, ' ').trim();
  const label = [...button.querySelectorAll<HTMLElement>('span,div')].reverse().find(el =>
    !el.children.length && el.textContent?.replace(/\s+/g, ' ').trim() === nativeText);
  if (label) label.textContent = name; else button.textContent = name;
  const safeColor = typeof color === 'string' && isSafeCssColor(color) ? color : null;
  const safeAccent = typeof accent === 'string' && isSafeCssColor(accent) ? accent : null;
  if (safeColor || safeAccent) {
    const swatch = document.createElement('span'); swatch.className = 'vkify-theme-menu-swatch'; swatch.setAttribute('aria-hidden', 'true');
    swatch.style.background = safeColor && safeAccent
      ? `linear-gradient(135deg, ${safeColor} 65%, ${safeAccent} 65%)` : (safeColor ?? safeAccent)!;
    const before = button.firstElementChild;
    // VK's empty before-slot supplies the same spacing as other menu icons.
    if (before?.tagName === 'DIV' && !before.childNodes.length) before.append(swatch);
    else button.prepend(swatch);
  }
  if (active) {
    const source = rows.find(row => row.querySelector('svg[class*="check_alt"]'));
    let check = source?.querySelector<Element>('svg[class*="check_alt"]');
    while (check?.parentElement && check.parentElement !== source) check = check.parentElement;
    if (check) button.append(check.cloneNode(true));
    else {
      const wrap = document.createElement('span'); wrap.className = 'vkify-theme-menu-check'; wrap.setAttribute('aria-hidden', 'true');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '20'); svg.setAttribute('height', '20'); svg.setAttribute('viewBox', '0 0 20 20'); svg.setAttribute('fill', 'currentColor');
      const path = document.createElementNS(svg.namespaceURI, 'path');
      path.setAttribute('d', 'M16.66 5.34a1.16 1.16 0 0 1 0 1.65l-7.84 7.82a1.17 1.17 0 0 1-1.65 0L3.34 11a1.16 1.16 0 0 1 1.65-1.65L8 12.35l7.01-7.01a1.17 1.17 0 0 1 1.65 0Z');
      svg.append(path); wrap.append(svg); button.append(wrap);
    }
  }
  return button;
}

function nativeItems(menu: Element): HTMLElement[] {
  const rows = [...menu.querySelectorAll<HTMLElement>(':scope > [role="button"], :scope > button')];
  const text = rows.map(row => row.textContent?.replace(/\s+/g, ' ').trim().toLowerCase());
  return rows.length === 3 && (text.join('|') === 'светлая|тёмная|системная' || text.join('|') === 'light|dark|system') ? rows : [];
}

function profiles(raw: unknown): AppearanceProfile[] {
  return Array.isArray(raw) ? raw.filter((p): p is AppearanceProfile => !!p && typeof p.id === 'string'
    && typeof p.name === 'string' && !!p.settings && typeof p.settings === 'object' && !Array.isArray(p.settings)).slice(0, 30) : [];
}

/** Called only for an opened theme popover. No background polling or page scans. */
export function mountThemeMenu(menu: HTMLElement): () => void {
  let alive = true, busy = false, revision = 0;
  let section: HTMLElement | null = null;
  const stopClosingGuard = guardThemeMenuClose(menu);
  const ru = () => getLang() === 'ru';
  const showError = (): void => {
    let error = section?.querySelector<HTMLElement>('[role="alert"]');
    if (!error && section) { error = document.createElement('p'); error.setAttribute('role', 'alert'); section.append(error); }
    if (error) { error.textContent = ru() ? 'Не удалось применить тему. Попробуйте ещё раз.' : 'Could not apply theme. Please try again.'; error.style.cssText = 'padding:8px 12px;font-size:12px;color:var(--vkui--color_text_negative,#e64646)'; }
  };
  async function apply(patch: Record<string, unknown>): Promise<void> {
    if (busy) return;
    const focusedTitle = section?.contains(document.activeElement) ? (document.activeElement as HTMLElement).title : '';
    busy = true;
    section?.querySelectorAll('button').forEach(button => { button.disabled = true; });
    try {
      await chrome.storage.local.set(patch);
      await render();
    }
    catch { showError(); }
    finally {
      busy = false; section?.querySelectorAll('button').forEach(button => { button.disabled = false; });
      if (alive && menu.isConnected && focusedTitle) [...(section?.querySelectorAll('button') ?? [])]
        .find(button => button.title === focusedTitle)?.focus({ preventScroll: true });
    }
  }
  async function render(): Promise<void> {
    const rows = nativeItems(menu);
    if (!alive || !menu.isConnected || !rows.length) return;
    const ticket = ++revision;
    let settings: Record<string, unknown>;
    try { settings = await chrome.storage.local.get([...APPEARANCE_KEYS, PROFILE_KEY]); } catch { showError(); return; }
    if (!alive || !menu.isConnected || ticket !== revision) return;
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style'); style.id = STYLE_ID; style.textContent = css; document.head.append(style);
    }
    const next = document.createElement('section'); next.dataset.vkifyThemeMenu = '';
    const list = document.createElement('div'); list.dataset.vkifyThemeList = '';
    const divider = (parent: HTMLElement): void => { const el = document.createElement('div'); el.dataset.vkifyThemeSeparator = ''; el.setAttribute('role', 'separator'); parent.append(el); };
    divider(next);
    let selected = false;
    function add(name: string, active: boolean, patch: Record<string, unknown>, color?: unknown, accent?: unknown): void {
      selected ||= active;
      const button = nativeButton(rows, name, active, color, accent);
      button.setAttribute('aria-pressed', String(active));
      button.addEventListener('click', event => { event.stopPropagation(); void apply(patch); }); list.append(button);
    }
    const saved = profiles(settings[PROFILE_KEY]);
    if (saved.length) {
      for (const profile of saved) add(profile.name, matchesProfile(settings, profile), buildApplyPatch(profile.settings), profile.settings.custom_theme, profile.settings.custom_accent);
      divider(list);
    }
    for (const theme of THEMES) {
      if (theme.id === 'default') continue;
      const active = !selected && settings.custom_theme === theme.color && settings.custom_accent === theme.accent;
      add(theme.name, active, { custom_theme_id: theme.id, custom_theme: theme.color, custom_accent: theme.accent }, theme.color, theme.accent);
    }
    next.append(list);
    divider(next);
    const manage = nativeButton(rows, ru() ? 'Настройки VKify' : 'VKify settings');
    manage.addEventListener('click', () => { history.pushState({}, '', EMBED_PATH); window.dispatchEvent(new PopStateEvent('popstate')); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    next.append(manage);
    const scrollTop = menu.scrollTop;
    const focusedTitle = section?.contains(document.activeElement) ? (document.activeElement as HTMLElement).title : '';
    if (section?.parentElement === menu) section.replaceWith(next); else menu.append(next);
    menu.scrollTop = scrollTop;
    if (focusedTitle) [...next.querySelectorAll('button')].find(button => button.title === focusedTitle)?.focus({ preventScroll: true });
    section = next;
    menu.setAttribute('data-vkify-theme-extended', '');
    menu.toggleAttribute('data-vkify-custom-theme-active', !!settings.custom_theme || !!settings.custom_accent || selected);
  }
  const nativeClick = (event: Event): void => {
    if (event.target instanceof Node && nativeItems(menu).some(row => row.contains(event.target as Node))) void apply(NATIVE_PATCH);
  };
  menu.addEventListener('click', nativeClick, true);
  const navigate = (event: KeyboardEvent): void => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = [...nativeItems(menu), ...menu.querySelectorAll<HTMLButtonElement>('.vkify-theme-menu-item:not(:disabled)')];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    event.preventDefault(); event.stopPropagation();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  };
  menu.addEventListener('keydown', navigate, true);
  // Read fresh values on open; only listen while the dropdown is present.
  const changed = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
    if (area === 'local' && menu.isConnected && !busy && Object.keys(changes).some(key => key === PROFILE_KEY || APPEARANCE_KEYS.includes(key))) void render();
  };
  chrome.storage.onChanged.addListener(changed);
  void render();
  return () => { alive = false; revision++; stopClosingGuard(); section?.remove(); menu.removeAttribute('data-vkify-theme-extended'); menu.removeAttribute('data-vkify-custom-theme-active'); menu.removeEventListener('click', nativeClick, true); menu.removeEventListener('keydown', navigate, true); chrome.storage.onChanged.removeListener(changed); };
}

export function startThemeMenuObserver(): void {
  const mounted = new Map<HTMLElement, () => void>();
  const labels = new Map<HTMLElement, () => void>();
  domObserver.observeMatches(PROFILE_MENU_SELECTOR, element => {
    if (element instanceof HTMLElement && !labels.has(element)) labels.set(element, mountThemeLabel(element));
  });
  domObserver.observeMatches(SELECTOR, element => {
    mounted.forEach((cleanup, menu) => { if (!menu.isConnected) { cleanup(); mounted.delete(menu); } });
    if (!(element instanceof HTMLElement) || mounted.has(element)) return;
    let cleanup: (() => void) | null = null;
    const tryMount = (): void => {
      if (cleanup && !element.querySelector('[data-vkify-theme-menu]')) { cleanup(); cleanup = null; }
      if (!cleanup && nativeItems(element).length) cleanup = mountThemeMenu(element);
    };
    tryMount();
    const stop = domObserver.observeChanges(() => {
      if (!element.isConnected) { stop(); cleanup?.(); mounted.delete(element); return; }
      tryMount();
    }, { container: element, schedule: 'frame' });
    mounted.set(element, () => { stop(); cleanup?.(); });
  });
  domObserver.observeChanges(() => {
    mounted.forEach((cleanup, menu) => { if (!menu.isConnected) { cleanup(); mounted.delete(menu); } });
    labels.forEach((cleanup, root) => { if (!root.isConnected) { cleanup(); labels.delete(root); } });
  });
}

/** Keep VK's native mode untouched; only the visible theme name is mirrored.
 * This lives with the profile popover, so the name is also right before the
 * nested theme list is opened or when settings change in another VKify UI. */
function mountThemeLabel(root: HTMLElement): () => void {
  let alive = true, reading = false, revision = 0;
  let settings: Record<string, unknown> | null = null;
  const fields = new Map<HTMLElement, { native: string; applied: string | null }>();
  const nativeNames = new Set(['Светлая', 'Тёмная', 'Системная', 'Light', 'Dark', 'System']);
  const setText = (field: HTMLElement, text: string): void => {
    // Keep the Text node owned by React so later native mode updates still work.
    if (field.childNodes.length === 1 && field.firstChild instanceof Text) field.firstChild.data = text;
    else field.textContent = text;
  };
  const findField = (): HTMLElement | undefined => {
    const trigger = [...root.querySelectorAll<HTMLElement>('button,[role="button"]')].find(el =>
      !el.closest('[data-vkify-theme-extended]') && /^(?:Тема|Theme)\s*:/.test(el.textContent?.trim() ?? ''));
    return trigger && [...trigger.querySelectorAll<HTMLElement>('span,div')].reverse().find(el =>
      !el.children.length && (fields.has(el) || nativeNames.has(el.textContent?.trim() ?? '')));
  };
  const sync = (): void => {
    if (!alive || !root.isConnected) return;
    const field = findField();
    if (!field) return;
    if (!settings) { if (!reading) void read(); return; }
    const current = field.textContent?.trim() ?? '';
    let state = fields.get(field);
    if (!state) { state = { native: current, applied: null }; fields.set(field, state); }
    if (current !== state.applied && nativeNames.has(current)) state.native = current;
    const saved = profiles(settings[PROFILE_KEY]).find(profile => matchesProfile(settings!, profile));
    const palette = THEMES.find(theme => theme.id !== 'default' && theme.color === settings!.custom_theme && theme.accent === settings!.custom_accent);
    const name = saved?.name ?? palette?.name ?? (settings.custom_theme || settings.custom_accent ? (getLang() === 'ru' ? 'Своя тема' : 'Custom theme') : null);
    const next = name ?? state.native;
    state.applied = name;
    if (field.textContent !== next) setText(field, next);
    fields.forEach((_state, el) => { if (!root.contains(el)) fields.delete(el); });
  };
  async function read(): Promise<void> {
    const ticket = ++revision;
    reading = true;
    try {
      const snapshot = await chrome.storage.local.get([...APPEARANCE_KEYS, PROFILE_KEY]);
      if (alive && ticket === revision) { settings = snapshot; sync(); }
    } catch { /* A missing extension context must not break VK's menu. */ }
    finally { if (ticket === revision) reading = false; }
  }
  const changed = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
    if (area === 'local' && Object.keys(changes).some(key => key === PROFILE_KEY || APPEARANCE_KEYS.includes(key)) && findField()) void read();
  };
  const observer = new MutationObserver(sync);
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  chrome.storage.onChanged.addListener(changed);
  sync();
  return () => {
    alive = false; revision++; observer.disconnect(); chrome.storage.onChanged.removeListener(changed);
    fields.forEach((state, field) => { if (state.applied && field.textContent === state.applied) setText(field, state.native); });
    fields.clear();
  };
}
