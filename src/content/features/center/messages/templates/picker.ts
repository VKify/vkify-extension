/** Логика пикера: открыть/закрыть и применить шаблон (вставка или авто-отправка). */

import { getService, SERVICES } from '@/content/core/services/index.js';
import { detectPeer } from './peer.js';
import { applyVariables } from './variables.js';
import { getInputText, insertAtCursor, replaceFullText } from './input.js';
import { attachFilesToInput } from './attachments.js';
import { ensureOverlay, type OverlayHandlers } from './overlay.js';
import { applySelectionClasses, renderList, positionOverlay } from './render.js';
import type { TemplatesState } from './state.js';

/** Колбэки оверлея, замкнутые на текущий state и логику пикера. */
function overlayHandlers(state: TemplatesState): OverlayHandlers {
  return {
    onClose: () => closePicker(state),
    onSelect: () => void selectCurrent(state),
    onHover: (idx) => { state.selectedIdx = idx; applySelectionClasses(state); },
  };
}

export function openPicker(state: TemplatesState, target: HTMLElement, prefix = ''): void {
  if (state.templates.length === 0) return;
  ensureOverlay(state, overlayHandlers(state));
  state.targetEl = target;
  state.pickerOpen = true;
  const q = prefix.toLowerCase();
  state.filtered = q
    ? state.templates.filter(t => t.name.toLowerCase().includes(q) || t.text.toLowerCase().includes(q))
    : state.templates;
  state.selectedIdx = 0;
  renderList(state);
  positionOverlay(state, target);
}

export function closePicker(state: TemplatesState): void {
  state.pickerOpen = false;
  state.targetEl = null;
  if (state.overlay) state.overlay.style.display = 'none';
}

export async function selectCurrent(state: TemplatesState): Promise<void> {
  if (!state.pickerOpen) return;
  const tpl = state.filtered[state.selectedIdx];
  const target = state.targetEl;
  closePicker(state);
  if (!tpl || !target) return;

  const text = await applyVariables(tpl.text, state.myUserId);
  const attachments = tpl.attachments ?? [];

  // Авто-отправка: текст уходит в VK через messages.send, поле очищается.
  // Если peer_id не резолвлен или API упал — мягкий fallback на вставку,
  // чтобы пользователь не остался без своего шаблона.
  // Шаблоны с файлами не авто-отправляются: вложения идут через нативный
  // механизм загрузки композера (см. attachFilesToInput), и пользователь
  // подтверждает отправку сам.
  if (state.autoSend && attachments.length === 0) {
    const peer = await detectPeer();
    if (peer.peerId !== null) {
      // random_id обязателен с API v5.90+ и гарантирует идемпотентность.
      try {
        await getService(SERVICES.vkApi).sendMessage(peer.peerId, text);
        // VK не очищает inputs за нас, очищаем сами (там сейчас «/» или префикс).
        replaceFullText(target, '');
        return;
      } catch (err) {
        console.warn('[VKify] Templates auto-send failed, inserting instead:', err);
      }
    }
  }

  // Стандартное поведение: просто вставить текст, дальше пользователь сам.
  const current = getInputText(target);
  if (current === '/' || current.trim() === '') {
    replaceFullText(target, text);
  } else {
    insertAtCursor(target, text);
  }

  if (attachments.length > 0) {
    attachFilesToInput(target, attachments);
  }
}
