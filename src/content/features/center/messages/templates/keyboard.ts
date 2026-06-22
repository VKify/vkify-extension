/** Клавиатурные триггеры пикера: хоткей, слэш, автоподсказка, навигация. */

import type { HotkeyCombo } from '@/types/index.js';
import { getInputText } from './input.js';
import { openPicker, closePicker, selectCurrent } from './picker.js';
import { applySelectionClasses } from './render.js';
import type { TemplatesState } from './state.js';

/** Пикер работает только над инпутом мессенджера ВК (/im). */
function isImContext(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (!location.pathname.startsWith('/im')) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'textarea' || tag === 'input' || el.isContentEditable;
}

function matchesHotkey(e: KeyboardEvent, combo: HotkeyCombo): boolean {
  return e.code === combo.code
      && (e.ctrlKey || e.metaKey) === combo.ctrlKey
      && e.shiftKey === combo.shiftKey
      && e.altKey   === combo.altKey;
}

export function onKeyDown(state: TemplatesState, e: KeyboardEvent): void {
  const target = e.target as HTMLElement | null;
  if (!isImContext(target)) return;

  // Настраиваемый хоткей — открыть/закрыть пикер.
  if (state.triggerHotkey && matchesHotkey(e, state.hotkey)) {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (state.pickerOpen) closePicker(state); else openPicker(state, target);
    return;
  }

  if (state.pickerOpen) {
    if (e.key === 'ArrowDown') {
      e.preventDefault(); e.stopImmediatePropagation();
      state.selectedIdx = Math.min(state.selectedIdx + 1, state.filtered.length - 1);
      applySelectionClasses(state);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault(); e.stopImmediatePropagation();
      state.selectedIdx = Math.max(state.selectedIdx - 1, 0);
      applySelectionClasses(state);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && state.filtered.length > 0) {
      e.preventDefault();
      e.stopImmediatePropagation();
      void selectCurrent(state);
      return;
    }
    return;
  }

  // Слэш в начале строки — открывает пикер (без префикса).
  if (state.triggerSlash && e.key === '/' && getInputText(target).trim() === '') {
    // Не предотвращаем дефолт — пользователь видит '/' в поле, затем пикер
    // (selectCurrent сам сотрёт '/' заменой полного текста).
    setTimeout(() => openPicker(state, target, ''), 0);
    return;
  }

  // Автоподсказка по префиксу — деферим, чтобы прочитать новое значение поля.
  if (state.triggerAutocomplete) {
    setTimeout(() => {
      const text = getInputText(target).trim();
      if (!text) { if (state.pickerOpen) closePicker(state); return; }
      const q = text.toLowerCase();
      const matches = state.templates.filter(t =>
        t.name.toLowerCase().startsWith(q) || t.text.toLowerCase().startsWith(q));
      if (matches.length > 0) openPicker(state, target, text);
      else if (state.pickerOpen) closePicker(state);
    }, 0);
  }
}
