import type { FeatureDefinition } from '@/content/core/features/index.js';
import { getService, SERVICES } from '@/content/core/services/index.js';
import { t } from '@/content/i18n/index.js';
import { extractCmid } from './_shared/message-dom.js';
import { detectConversationContext } from './dialog-export/peer.js';
import type { VKMessage } from './dialog-export/types.js';
import { videoMessageFiles } from './video-message-download.js';
import { attachBrandTooltip, hideBrandTooltip } from '../_shared/brand-tooltip.js';

const BUTTON = 'vkify-circle-expand';
const cleanup = new WeakMap<object, () => void>();
const safeSource = (raw: string): string | null => {
  try { const url = new URL(raw); return url.protocol === 'https:' || (url.protocol === 'blob:' && url.origin === location.origin) ? url.href : null; }
  catch { return null; }
};

/** Separate player: never move VK's React-owned video out of its original container. */
export function openVideoMessageViewer(source: HTMLVideoElement | null, trigger: HTMLElement,
  resolveSource: () => Promise<string | null>): () => void {
  const dialog = document.createElement('dialog'); dialog.className = 'vkify-circle-viewer';
  dialog.setAttribute('aria-label', t('messages.circle_viewer.title'));
  const stage = document.createElement('div'); stage.className = 'vkify-circle-stage';
  const toolbar = document.createElement('div'); toolbar.className = 'vkify-circle-toolbar';
  const title = document.createElement('strong'); title.textContent = t('messages.circle_viewer.title');
  const status = document.createElement('p'); status.role = 'status'; status.textContent = t('messages.circle_viewer.loading');
  const video = document.createElement('video'); video.controls = true; video.playsInline = true; video.preload = 'metadata';
  video.setAttribute('aria-label', t('messages.circle_viewer.title'));
  video.volume = source?.volume || 1;
  const originalTime = source?.currentTime ?? 0;
  const originalSrc = source?.currentSrc || source?.src;
  const wasPlaying = source ? !source.paused : false;
  source?.pause();
  const previousOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';
  let disposed = false;
  const play = () => { void video.play().catch(() => { /* Native play control remains available if autoplay is blocked. */ }); };
  const seek = (seconds: number) => {
    if (Number.isFinite(video.duration)) video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
  };
  const fullscreen = () => {
    if (document.fullscreenElement && stage.contains(document.fullscreenElement)) void document.exitFullscreen().catch(() => {});
    else if (stage.requestFullscreen) void stage.requestFullscreen().catch(() => { status.textContent = t('messages.circle_viewer.fullscreen_error'); });
  };
  const close = () => {
    if (disposed) return;
    disposed = true;
    if (document.fullscreenElement && stage.contains(document.fullscreenElement)) void document.exitFullscreen().catch(() => {});
    video.pause();
    if (source?.isConnected && (source.currentSrc || source.src) === originalSrc) {
      if (video.readyState >= 1 && Number.isFinite(video.currentTime)) {
        try { source.currentTime = video.currentTime; } catch { /* Source may have been unloaded by VK. */ }
      }
      if (wasPlaying) void source.play().catch(() => {});
    }
    video.removeAttribute('src'); video.load(); dialog.remove();
    if (document.documentElement.style.overflow === 'hidden') document.documentElement.style.overflow = previousOverflow;
    if (trigger.isConnected) trigger.focus({ preventScroll: true });
  };
  const button = (label: string, action: () => void) => {
    const el = document.createElement('button'); el.type = 'button'; el.textContent = label;
    el.addEventListener('click', action); return el;
  };
  const closeButton = button(t('messages.circle_viewer.close'), close);
  const fullButton = button(t('messages.circle_viewer.fullscreen'), fullscreen);
  fullButton.disabled = !stage.requestFullscreen;
  toolbar.append(title, button('−5 ' + t('messages.circle_viewer.seconds'), () => seek(-5)), button('+5 ' + t('messages.circle_viewer.seconds'), () => seek(5)), fullButton, closeButton);
  stage.append(toolbar, video, status); dialog.append(stage); document.body.append(dialog);
  dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', close);
  dialog.addEventListener('keydown', event => {
    if ((event.target as Element).closest('button, input, select, textarea')) return;
    if (event.code === 'Space') { event.preventDefault(); if (video.paused) play(); else video.pause(); }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); seek(event.key === 'ArrowLeft' ? -5 : 5); }
    if (event.code === 'KeyF') { event.preventDefault(); fullscreen(); }
  });
  video.addEventListener('loadedmetadata', () => {
    if (disposed) return;
    if (Number.isFinite(video.duration)) video.currentTime = Math.min(originalTime, Math.max(0, video.duration - 0.05));
    status.textContent = ''; play();
  }, { once: true });
  video.addEventListener('error', () => { if (!disposed) status.textContent = t('messages.circle_viewer.error'); });
  dialog.showModal(); closeButton.focus();
  void resolveSource().then(url => {
    if (disposed) return;
    const safe = url ? safeSource(url) : null;
    if (!safe) { status.textContent = t('messages.circle_viewer.error'); return; }
    video.src = safe;
  }).catch(() => { if (!disposed) status.textContent = t('messages.circle_viewer.error'); });
  return close;
}

export const videoMessageViewerFeature: FeatureDefinition = {
  id: 'video_message_viewer', name: 'Увеличение кружочков', category: 'messages', impact: 'light',
  reapplyOnNavigate: true, reapplyOnLanguageChange: true, requiresDomLayer: true, tags: ['im', 'video', 'viewer'],
  init(ctx) {
    let active = true, closeViewer: (() => void) | undefined;
    const buttons = new Set<HTMLButtonElement>();
    ctx.addCSS(`
      .${BUTTON}{position:absolute;right:0;bottom:0;z-index:2;width:34px;height:24px;border:0;border-radius:6px;background:#0009;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center}
      .${BUTTON}:hover{background:#000c}.${BUTTON}:focus-visible{outline:2px solid #fff;outline-offset:2px}
      .vkify-circle-viewer{border:0;padding:0;border-radius:14px;background:#151515;color:#fff;width:min(900px,calc(100vw - 32px));max-width:none;max-height:calc(100dvh - 32px);overflow:auto;box-shadow:0 20px 80px #0008}
      .vkify-circle-viewer::backdrop{background:#000c}.vkify-circle-stage{display:flex;flex-direction:column;align-items:center;background:#151515;min-height:120px;overscroll-behavior:contain}
      .vkify-circle-stage video{display:block;width:100%;height:min(70dvh,720px);object-fit:contain;background:#000;border-radius:0;clip-path:none}
      .vkify-circle-toolbar{display:flex;align-items:center;gap:8px;padding:12px;box-sizing:border-box;width:100%;flex-wrap:wrap;font:14px/1.3 system-ui,sans-serif}.vkify-circle-toolbar strong{flex:1;margin-right:8px}
      .vkify-circle-toolbar button{border:0;border-radius:7px;padding:8px 10px;background:#ffffff20;color:#fff;cursor:pointer;font:inherit}.vkify-circle-toolbar button:hover{background:#ffffff35}.vkify-circle-toolbar button:focus-visible{outline:2px solid white}.vkify-circle-toolbar button:disabled{opacity:.4;cursor:default}
      .vkify-circle-stage [role=status]{padding:0 12px;margin:8px;font:14px/1.4 system-ui,sans-serif}.vkify-circle-stage [role=status]:empty{display:none}
      .vkify-circle-stage:fullscreen{width:100%;height:100%;justify-content:center}.vkify-circle-stage:fullscreen video{height:calc(100dvh - 90px);flex:1;min-height:0}.vkify-circle-stage:fullscreen .vkify-circle-toolbar{flex-shrink:0}
    `);
    ctx.registerMutationObserver(ctx.selectors.messages.videoMessageDownloadAnchors, anchor => {
      const player = anchor.closest(ctx.selectors.messages.videoMessage);
      if (!player || player.querySelector(`.${BUTTON}`)) return;
      const button = document.createElement('button'); button.type = 'button'; button.className = BUTTON;
      button.setAttribute('aria-label', t('messages.circle_viewer.expand'));
      attachBrandTooltip(button, () => t('messages.circle_viewer.expand'));
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '20'); svg.setAttribute('height', '20'); svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5'); path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '2'); path.setAttribute('stroke-linecap', 'round'); svg.append(path); button.append(svg);
      button.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation();
        hideBrandTooltip();
        if (!active) return;
        closeViewer?.();
        const source = player.querySelector('video');
        const fallback = source ? safeSource(source.currentSrc || source.src || source.querySelector('source')?.src || '') : null;
        const block = player.closest(ctx.selectors.messages.block);
        const cmid = block ? extractCmid(block) : null;
        const context = detectConversationContext();
        const players = block ? Array.from(block.querySelectorAll(ctx.selectors.messages.videoMessage)) : [];
        const index = players.indexOf(player);
        closeViewer = openVideoMessageViewer(source, button, async () => {
          // Native source also identifies media inside forwarded/replied-to messages correctly.
          if (fallback) return fallback;
          if (!context || cmid === null || index < 0) return null;
          const response = await getService(SERVICES.vkApi).call('messages.getByConversationMessageId', {
            peer_id: context.peerId, conversation_message_ids: cmid,
            ...(context.groupId !== null ? { group_id: context.groupId } : {}),
          }) as { items?: VKMessage[] } | null;
          const message = response?.items?.find(item => item.conversation_message_id === cmid);
          if (!message || message.fwd_messages?.length || message.reply_message) return null;
          const files = videoMessageFiles(message);
          return files.length === players.length ? files[index]?.url ?? null : null;
        });
      });
      player.append(button); buttons.add(button);
    });
    cleanup.set(ctx, () => { active = false; hideBrandTooltip(); closeViewer?.(); buttons.forEach(button => button.remove()); });
  },
  destroy(ctx) { cleanup.get(ctx)?.(); cleanup.delete(ctx); },
};
