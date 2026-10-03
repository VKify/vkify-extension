import { attachWallpaperToBody } from './layers.js';

const DURATION = 450;
const RESOURCE_IDS = ['vkify-bg-container', 'vkify-image-bg', 'vkify-video-bg', 'vkify-embed-bg', 'vkify-web-bg'];

/** Keep the painted wallpaper (including its media) until its replacement loads. */
export function createWallpaperTransition(onFailure: () => void) {
  let previous: HTMLElement | null = null;
  let disposePrevious: (() => void) | undefined;
  let pending: { container: HTMLElement; loaded: boolean; cancel: () => void } | null = null;
  let finishTimer: ReturnType<typeof setTimeout> | undefined;
  let frame: number | undefined;
  const duration = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : DURATION;
  const stop = () => {
    clearTimeout(finishTimer);
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    pending?.cancel();
  };
  const removePrevious = () => {
    previous?.querySelectorAll('video').forEach(video => {
      video.pause(); video.removeAttribute('src'); video.load();
    });
    previous?.remove(); previous = null;
    disposePrevious?.(); disposePrevious = undefined;
  };

  function begin(disposeCurrent: () => void) {
    attachWallpaperToBody();
    stop();
    const current = document.getElementById('vkify-bg-container');
    if (current && pending?.container === current && !pending.loaded) {
      // Rapid selections discard the unpainted candidate, keeping the visible one.
      current.querySelectorAll('video').forEach(video => video.pause());
      current.remove(); disposeCurrent();
    } else if (current) {
      removePrevious();
      let css = document.getElementById('vkify-custom_background')?.textContent ?? '';
      // The old media and overlays need their own selectors after CSS is replaced.
      for (const id of RESOURCE_IDS) {
        const element = id === current.id ? current : current.querySelector<HTMLElement>(`#${id}`);
        if (element) element.id = `${id}-previous`;
        css = css.split(`#${id}`).join(`#${id}-previous`);
      }
      // Vignette is shared by the page; the new settings own it during the fade.
      css = css.replace(/body::after\s*\{[^}]*\}/g, '');
      const style = document.createElement('style');
      style.textContent = css; current.append(style);
      current.style.transition = 'none'; current.style.opacity = '1';
      previous = current; disposePrevious = disposeCurrent;
    } else {
      disposeCurrent();
    }
    if (previous) { previous.style.transition = 'none'; previous.style.opacity = '1'; }
    const container = document.createElement('div');
    container.id = 'vkify-bg-container';
    container.style.opacity = '0';
    if (previous) previous.after(container); else document.body.prepend(container);
    const state = { container, loaded: false, cancel: () => {} };
    pending = state;

    const ready = () => {
      if (pending !== state || state.loaded) return;
      state.loaded = true; state.cancel();
      const ms = duration();
      if (!ms) { container.style.opacity = '1'; removePrevious(); return; }
      // A style flush establishes the transparent start even for cached media.
      void container.offsetWidth;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        if (pending !== state) return;
        container.style.transition = `opacity ${ms}ms ease-in-out`;
        container.style.opacity = '1';
        if (previous) {
          previous.style.transition = `opacity ${ms}ms ease-in-out`;
          previous.style.opacity = '0';
        }
        finishTimer = setTimeout(removePrevious, ms);
      });
    };
    const failed = () => {
      if (pending !== state) return;
      state.cancel();
      container.querySelectorAll('video').forEach(video => video.pause());
      container.remove(); pending = null;
      onFailure();
    };
    const wait = (target: EventTarget, event: string) => {
      const timer = setTimeout(failed, 15000);
      target.addEventListener(event, ready, { once: true });
      target.addEventListener('error', failed, { once: true });
      state.cancel = () => {
        clearTimeout(timer);
        target.removeEventListener(event, ready);
        target.removeEventListener('error', failed);
      };
    };
    return { container, ready, wait };
  }

  function clear(disposeCurrent: () => void) {
    const swap = begin(disposeCurrent);
    stop(); swap.container.remove(); pending = null;
    if (!previous) return;
    const ms = duration();
    if (!ms) { removePrevious(); return; }
    void previous.offsetWidth;
    previous.style.transition = `opacity ${ms}ms ease-in-out`;
    previous.style.opacity = '0';
    finishTimer = setTimeout(removePrevious, ms);
  }
  return { begin, clear };
}
