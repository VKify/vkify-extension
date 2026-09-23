import type { FeatureContext } from '@/content/core/feature-context.js';
import { lyricsCoverPlacement, type LyricsSnapshot } from '@/shared/music-lyrics.js';
import type { VisualizerSettings } from '@/shared/music-visualizer.js';

/** Page editing is opt-in; normal lyrics never intercept clicks. */
export function installOverlayControls(canvas: HTMLCanvasElement, ctx: FeatureContext,
  getSettings: () => VisualizerSettings, apply: (value: VisualizerSettings) => void,
  snapshot: () => LyricsSnapshot, restoreLayer: () => void, feature: 'music_lyrics' | 'music_visualizer' = 'music_lyrics') {
  let editing = false;
  let toolbar: HTMLDivElement | null = null;
  let drag: { id: number; x: number; y: number; cover: boolean; settings: VisualizerSettings } | null = null;
  const persist = (): void => { void ctx.setSetting(`${feature}_settings`, JSON.stringify(getSettings())); };
  const finish = (): void => {
    if (drag) { drag = null; persist(); }
    editing = false; toolbar?.remove(); toolbar = null;
    canvas.style.pointerEvents = 'none'; canvas.style.cursor = ''; restoreLayer();
  };
  const begin = (hint?: string, doneLabel?: string): void => {
    if (editing) return;
    editing = true; canvas.style.visibility = 'visible'; canvas.style.pointerEvents = 'auto'; canvas.style.cursor = 'move'; canvas.style.zIndex = '2147483645';
    toolbar = document.createElement('div');
    toolbar.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;padding:12px 18px;border-radius:12px;background:#151923;color:white;font:14px system-ui;box-shadow:0 4px 24px #0008;';
    toolbar.textContent = (hint?.slice(0, 300) || 'Перетащите текст или обложку. Esc — готово.') + ' ';
    const done = document.createElement('button'); done.textContent = doneLabel?.slice(0, 40) || 'Готово';
    done.style.cssText = 'background:#5181b8;color:white;border:0;border-radius:8px;padding:8px 14px;cursor:pointer;';
    done.addEventListener('click', finish); toolbar.append(done); document.body.append(toolbar);
  };
  const down = (event: PointerEvent): void => {
    if (!editing || event.button !== 0) return;
    const settings = getSettings();
    const { x, y, size } = lyricsCoverPlacement(innerWidth, innerHeight, settings);
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, settings: { ...settings },
      cover: feature === 'music_lyrics' && settings.lyricsShowCover && event.clientX >= x && event.clientX <= x + size && event.clientY >= y && event.clientY <= y + size };
    canvas.setPointerCapture(event.pointerId); event.preventDefault();
  };
  const move = (event: PointerEvent): void => {
    if (!drag || event.pointerId !== drag.id) return;
    const { size } = lyricsCoverPlacement(innerWidth, innerHeight, drag.settings);
    const dx = (event.clientX - drag.x) / Math.max(1, innerWidth - (drag.cover ? size : 0)) * 100;
    const dy = (event.clientY - drag.y) / Math.max(1, innerHeight - (drag.cover ? size : 0)) * 100;
    const clamp = (v: number, min: number) => Math.max(min, Math.min(100, Math.round(v)));
    apply({ ...getSettings(), ...(drag.cover ? {
      lyricsCoverX: clamp(drag.settings.lyricsCoverX + dx, 0), lyricsCoverY: clamp(drag.settings.lyricsCoverY + dy, 0),
    } : { offsetX: clamp(drag.settings.offsetX + dx, -100), offsetY: clamp(drag.settings.offsetY + dy, -100) }) });
  };
  const up = (event: PointerEvent): void => {
    if (drag?.id !== event.pointerId) return;
    drag = null; persist();
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  const key = (event: KeyboardEvent): void => { if (editing && event.key === 'Escape') finish(); };
  const listener = (message: { type?: string; hint?: string; doneLabel?: string }, sender: chrome.runtime.MessageSender, respond: (value: unknown) => void): void => {
    if (sender.id !== chrome.runtime.id) return;
    if (feature === 'music_lyrics' && message.type === 'VKIFY_LYRICS_SNAPSHOT') respond(snapshot());
    if (message.type === (feature === 'music_lyrics' ? 'VKIFY_LYRICS_EDIT' : 'VKIFY_VISUALIZER_EDIT')) { begin(message.hint, message.doneLabel); respond({ success: true }); }
  };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  document.addEventListener('keydown', key);
  if (typeof chrome !== 'undefined') chrome.runtime?.onMessage?.addListener(listener);
  return {
    get editing() { return editing; },
    dispose() {
      drag = null; finish();
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up);
      document.removeEventListener('keydown', key);
      if (typeof chrome !== 'undefined') chrome.runtime?.onMessage?.removeListener(listener);
    },
  };
}
