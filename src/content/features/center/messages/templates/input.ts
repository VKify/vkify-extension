/**
 * Работа с VK-инпутом чата (textarea / input / contenteditable),
 * совместимая с React-controlled полями.
 */

export function getInputText(el: HTMLElement): string {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return el.value;
  return el.textContent ?? '';
}

/**
 * Программная установка значения React-controlled `<textarea>` /`<input>`
 * требует вызова native value-setter и диспетча InputEvent — иначе React не
 * увидит изменение и при следующем рендере перетрёт его старым state.
 */
function setValueWithNativeSetter(el: HTMLTextAreaElement | HTMLInputElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

export function insertAtCursor(el: HTMLElement, text: string): void {
  el.focus();
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    const start = el.selectionStart ?? el.value.length;
    const end   = el.selectionEnd   ?? el.value.length;
    const next  = el.value.slice(0, start) + text + el.value.slice(end);
    setValueWithNativeSetter(el, next);
    const caret = start + text.length;
    el.setSelectionRange(caret, caret);
    return;
  }
  // contenteditable: execCommand формально deprecated, но в Chromium работает
  // и аккуратно стыкуется с React-Slate-обёртками, поднимая нужные события.
  document.execCommand('insertText', false, text);
}

export function replaceFullText(el: HTMLElement, text: string): void {
  el.focus();
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    setValueWithNativeSetter(el, text);
    el.setSelectionRange(text.length, text.length);
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  document.execCommand('insertText', false, text);
}
