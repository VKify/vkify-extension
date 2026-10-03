import { sendMessage } from '@/shared/messaging.js';
import { changesMusicOffset, withMusicPageOffset, MUSIC_OFFSET_STATE } from '@/shared/music-page-offset.js';
import { t } from './i18n.js';

const FIELDS = [
  { key: 'content_width', enabled: 'content_width_enabled', min: 900, max: 2500, step: 50, fallback: 1100, label: 'layout.width' },
  { key: 'page_offset_value', enabled: 'page_offset_enabled', min: 0, max: 100, step: 1, fallback: 50, label: 'layout.offset' },
] as const;
type ValueKey = typeof FIELDS[number]['key'];
type EnabledKey = typeof FIELDS[number]['enabled'];
type Settings = Record<ValueKey, number> & Record<EnabledKey, boolean>;
const KEYS = FIELDS.flatMap(field => [field.key, field.enabled]);
const EDITOR_CSS = `
  #vkify-layout-editor *, #vkify-layout-editor *::before, #vkify-layout-editor *::after { box-sizing: border-box; }
  #vkify-layout-editor button:disabled { opacity: .5; cursor: default !important; }
  #vkify-layout-editor :is(button, input):focus-visible { outline: 2px solid #0077ff; outline-offset: 3px; }
  #vkify-layout-editor input[type=range] { appearance: none; height: 24px; border: 0; padding: 0; background: transparent; }
  #vkify-layout-editor input[type=range]:disabled { opacity: .45; cursor: default !important; }
  #vkify-layout-editor input[type=range]::-webkit-slider-runnable-track {
    height: 6px; border-radius: 3px;
    background: linear-gradient(to right, #0077ff var(--vkify-range-progress), var(--vkui--color_separator_primary, #dce1e6) var(--vkify-range-progress));
  }
  #vkify-layout-editor input[type=range]::-webkit-slider-thumb {
    appearance: none; width: 20px; height: 20px; margin-top: -7px;
    border: 2px solid var(--vkui--color_background_content, #fff); border-radius: 50%; background: #0077ff; box-shadow: 0 1px 4px #0003;
  }
  #vkify-layout-editor input[type=range]::-moz-range-track { height: 6px; border-radius: 3px; background: var(--vkui--color_separator_primary, #dce1e6); }
  #vkify-layout-editor input[type=range]::-moz-range-progress { height: 6px; border-radius: 3px; background: #0077ff; }
  #vkify-layout-editor input[type=range]::-moz-range-thumb { width: 16px; height: 16px; border: 2px solid var(--vkui--color_background_content, #fff); border-radius: 50%; background: #0077ff; }
`;

/** Fixed controls in the VK document, independent of the moving settings iframe. */
export function installLayoutEditor(iframe: HTMLIFrameElement): () => void {
  const origin = new URL(chrome.runtime.getURL('/')).origin;
  let panel: HTMLDivElement | null = null;
  let opening = 0;
  let disposed = false;
  let state: Settings = { content_width: 1100, content_width_enabled: false, page_offset_value: 50, page_offset_enabled: false };
  let pending: Partial<Settings> = {};
  let inFlight: Partial<Settings> = {};
  let finishing = false;
  let done: HTMLButtonElement | null = null;
  let center: HTMLButtonElement | null = null;
  let hint: HTMLParagraphElement | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let previewTimer: ReturnType<typeof setTimeout> | undefined;
  const previews = new Map<string, number>();
  let error: HTMLParagraphElement | null = null;
  let rows: { field: typeof FIELDS[number]; input: HTMLInputElement; toggle: HTMLInputElement; output: HTMLOutputElement }[] = [];

  const notify = (active: boolean): void => iframe.contentWindow?.postMessage({ type: 'VKIFY_LAYOUT_EDIT_STATE', active }, origin);
  let previewFlight: Promise<void> | null = null;
  const flushPreview = (): Promise<void> => {
    clearTimeout(previewTimer); previewTimer = undefined;
    if (previewFlight) return previewFlight;
    if (!previews.size) return Promise.resolve();
    // Slow IPC gets only the newest queued value, rather than a backlog of
    // intermediate positions. Writes wait for this lane before disabling a feature.
    previewFlight = (async () => {
      while (previews.size) {
        const batch = [...previews]; previews.clear();
        for (const [featureId, value] of batch) {
          if (!state[featureId as EnabledKey]) continue;
          try { await sendMessage({ type: 'ENABLE_FEATURE', featureId, value }); }
          catch { if (error) error.textContent = t('layout.error'); }
        }
      }
    })().finally(() => { previewFlight = null; });
    return previewFlight;
  };
  let saving: Promise<boolean> | null = null;
  const save = (): Promise<boolean> => {
    clearTimeout(saveTimer); saveTimer = undefined;
    if (saving) return saving;
    if (!Object.keys(pending).length) return Promise.resolve(true);
    saving = (async () => {
      while (Object.keys(pending).length) {
        const patch = pending; pending = {}; inFlight = patch;
        try {
          await flushPreview();
          const current = changesMusicOffset(patch) ? await chrome.storage.local.get([
            'music_lyrics', 'music_visualizer', 'music_lyrics_settings', 'music_visualizer_settings',
            'page_offset_enabled', 'page_offset_value', MUSIC_OFFSET_STATE,
          ]) : {};
          await chrome.storage.local.set(withMusicPageOffset(current, patch));
          if (error) error.textContent = '';
        } catch {
          pending = { ...patch, ...pending };
          if (error) error.textContent = t('layout.error');
          return false;
        } finally { inFlight = {}; }
      }
      return true;
    })().finally(() => { saving = null; });
    return saving;
  };
  const render = (): void => {
    const width = state.content_width_enabled ? Math.min(state.content_width, innerWidth)
      : document.getElementById('page_layout')?.offsetWidth ?? 1000;
    const shift = Math.round((state.page_offset_value - 50) / 50 * Math.max(0, innerWidth - width) / 2);
    for (const { field, input, toggle, output } of rows) {
      input.value = String(state[field.key]);
      input.disabled = finishing || !state[field.enabled];
      toggle.checked = state[field.enabled];
      toggle.disabled = finishing;
      input.style.setProperty('--vkify-range-progress', `${(state[field.key] - field.min) / (field.max - field.min) * 100}%`);
      if (field.key === 'content_width') {
        output.textContent = `${state.content_width} px`;
      } else {
        output.textContent = shift === 0 ? t('layout.center') : shift < 0 ? `← ${Math.abs(shift)} px` : `${shift} px →`;
      }
      input.setAttribute('aria-valuetext', output.textContent ?? '');
    }
    if (done) { done.disabled = finishing; done.textContent = t(finishing ? 'layout.saving' : 'layout.done'); }
    if (center) center.disabled = finishing || !state.page_offset_enabled || state.page_offset_value === 50;
    if (hint) hint.textContent = state.page_offset_enabled && width >= innerWidth
      ? t('layout.no_space') : t('layout.hint');
    panel?.setAttribute('aria-busy', String(finishing));
  };
  const update = (key: ValueKey, value: number): void => {
    const field = FIELDS.find(item => item.key === key)!;
    if (finishing || !Number.isFinite(value)) return;
    value = Math.max(field.min, Math.min(field.max, Math.round(value / field.step) * field.step));
    if (state[key] === value) return;
    state[key] = value; pending[key] = value;
    if (state[field.enabled]) {
      previews.set(field.enabled, value);
      previewTimer ??= setTimeout(() => { void flushPreview(); }, 16);
    }
    clearTimeout(saveTimer); saveTimer = setTimeout(() => { void save(); }, 250);
    render();
  };
  const close = (): void => {
    opening++;
    panel?.remove(); panel = null; rows = []; error = null; done = null; center = null; hint = null;
    notify(false);
    iframe.focus({ preventScroll: true });
  };
  const finish = async (): Promise<void> => {
    if (!panel) { opening++; return; }
    if (finishing) return;
    finishing = true; render();
    const success = await save();
    finishing = false;
    if (success && !disposed) close(); else render();
  };
  const open = async (target: ValueKey): Promise<void> => {
    if (panel) {
      const row = rows.find(item => item.field.key === target);
      if (row) (row.input.disabled ? row.toggle : row.input).focus();
      notify(true); return;
    }
    const token = ++opening;
    let stored: Record<string, unknown>;
    try { stored = await chrome.storage.local.get(KEYS); } catch { notify(false); return; }
    if (disposed || token !== opening) return;
    for (const field of FIELDS) {
      const value = stored[field.key];
      state[field.key] = typeof value === 'number' && Number.isFinite(value)
        ? Math.max(field.min, Math.min(field.max, Math.round(value / field.step) * field.step)) : field.fallback;
      state[field.enabled] = stored[field.enabled] === true;
    }
    panel = document.createElement('div');
    panel.id = 'vkify-layout-editor';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', t('layout.title'));
    panel.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:2147483647;width:min(420px,calc(100vw - 24px));max-height:calc(100dvh - 32px);overflow:auto;overscroll-behavior:contain;box-sizing:border-box;padding:16px;border-radius:16px;background:var(--vkui--color_background_content,#fff);color:var(--vkui--color_text_primary,#222);font:14px/1.4 system-ui;box-shadow:0 8px 40px #0005;';
    const style = document.createElement('style'); style.textContent = EDITOR_CSS; panel.append(style);
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;';
    const title = document.createElement('strong'); title.textContent = t('layout.title');
    done = document.createElement('button'); done.type = 'button'; done.textContent = t('layout.done');
    done.style.cssText = 'border:0;border-radius:8px;padding:7px 12px;background:#0077ff;color:#fff;font:inherit;cursor:pointer;';
    done.addEventListener('click', () => { void finish(); });
    header.append(title, done); panel.append(header);
    for (const field of FIELDS) {
      const row = document.createElement('div'); row.style.cssText = 'margin-top:12px;';
      const heading = document.createElement('div'); heading.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;';
      const label = document.createElement('label'); label.style.cssText = 'display:flex;align-items:center;gap:8px;flex:1;cursor:pointer;';
      const toggle = document.createElement('input'); toggle.type = 'checkbox'; toggle.id = `vkify-layout-${field.enabled}`;
      toggle.style.cssText = 'accent-color:#0077ff;width:16px;height:16px;';
      const text = document.createElement('span'); text.textContent = t(field.label);
      label.append(toggle, text);
      const output = document.createElement('output'); output.style.cssText = 'font-size:12px;color:var(--vkui--color_text_secondary,#667);font-variant-numeric:tabular-nums;';
      const input = document.createElement('input'); input.type = 'range'; input.id = `vkify-layout-${field.key}`;
      input.min = String(field.min); input.max = String(field.max); input.step = String(field.step);
      input.setAttribute('aria-label', t(field.label)); output.htmlFor = input.id;
      input.style.cssText = 'display:block;width:100%;margin:0;accent-color:#0077ff;cursor:pointer;';
      input.addEventListener('input', () => update(field.key, input.valueAsNumber));
      input.addEventListener('change', () => { void save(); });
      toggle.addEventListener('change', () => {
        state[field.enabled] = toggle.checked; pending[field.enabled] = toggle.checked;
        // A queued live preview must not re-enable a feature just disabled here.
        previews.delete(field.enabled);
        render(); void save();
      });
      heading.append(label, output); row.append(heading, input); panel.append(row);
      if (field.key === 'page_offset_value') {
        center = document.createElement('button'); center.type = 'button'; center.textContent = t('layout.reset_center');
        center.style.cssText = 'margin-top:8px;border:0;border-radius:6px;padding:5px 10px;color:inherit;background:var(--vkui--color_background_secondary,#eef2f6);font:inherit;font-size:12px;cursor:pointer;';
        center.addEventListener('click', () => { update('page_offset_value', 50); void save(); });
        row.append(center);
      }
      rows.push({ field, toggle, input, output });
    }
    hint = document.createElement('p'); hint.textContent = t('layout.hint');
    hint.style.cssText = 'margin:12px 0 0;font-size:12px;color:var(--vkui--color_text_secondary,#667);';
    error = document.createElement('p'); error.setAttribute('role', 'alert'); error.style.cssText = 'margin:4px 0 0;font-size:12px;color:#e64646;';
    panel.append(hint, error); document.body.append(panel);
    render(); notify(true);
    const row = rows.find(item => item.field.key === target)!;
    (row.input.disabled ? row.toggle : row.input).focus();
  };
  const message = (event: MessageEvent): void => {
    if (event.source !== iframe.contentWindow || event.origin !== origin) return;
    const data = event.data as { type?: string; target?: unknown } | null;
    if (data?.type === 'VKIFY_LAYOUT_EDIT' && (data.target === 'content_width' || data.target === 'page_offset_value')) void open(data.target);
    if (data?.type === 'VKIFY_LAYOUT_EDIT_CLOSE') void finish();
  };
  const key = (event: KeyboardEvent): void => {
    if (panel && event.key === 'Escape') { event.preventDefault(); void finish(); }
  };
  const storage: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, area) => {
    if (area !== 'local' || !panel || !KEYS.some(key => key in changes)) return;
    for (const field of FIELDS) {
      const value = changes[field.key]?.newValue;
      if (!(field.key in pending) && !(field.key in inFlight) && field.key in changes) state[field.key] = typeof value === 'number' && Number.isFinite(value)
        ? Math.max(field.min, Math.min(field.max, Math.round(value / field.step) * field.step)) : field.fallback;
      if (!(field.enabled in pending) && !(field.enabled in inFlight) && field.enabled in changes) state[field.enabled] = changes[field.enabled].newValue === true;
    }
    render();
  };
  const resize = (): void => { if (panel) render(); };
  window.addEventListener('message', message);
  window.addEventListener('resize', resize);
  document.addEventListener('keydown', key);
  chrome.storage.onChanged.addListener(storage);
  return () => {
    disposed = true; opening++;
    clearTimeout(previewTimer); previewTimer = undefined; previews.clear(); void save();
    panel?.remove(); panel = null; rows = []; error = null; done = null; center = null; hint = null;
    window.removeEventListener('message', message);
    window.removeEventListener('resize', resize);
    document.removeEventListener('keydown', key);
    chrome.storage.onChanged.removeListener(storage);
  };
}
