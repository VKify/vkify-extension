/**
 * Возвращает отображаемый текст DOM-узла, восстанавливая emoji-подмены VK.
 *
 * VK может рендерить emoji не текстовым узлом, а img/span/svg с исходной
 * Unicode-последовательностью в alt/data-emoji/aria-label. innerText и
 * textContent такие символы теряют. Работаем с клоном, чтобы не менять DOM VK,
 * и не нормализуем строку: variation selectors, skin-tone modifiers и ZWJ
 * sequences должны остаться побайтно теми же UTF-16 code units.
 */

function hasEmojiClass(el: Element): boolean {
  return Array.from(el.classList).some(name => /emoji/i.test(name));
}

function looksLikeEmoji(value: string): boolean {
  return /\p{Extended_Pictographic}/u.test(value);
}

function emojiText(el: Element): string | null {
  const dataEmoji = el.getAttribute('data-emoji');
  if (dataEmoji && looksLikeEmoji(dataEmoji)) return dataEmoji;

  const marked = hasEmojiClass(el) || el.hasAttribute('data-emoji');
  if (el instanceof HTMLImageElement) {
    const alt = el.alt;
    if (alt && (marked || looksLikeEmoji(alt))) return alt;
  }

  if (marked || el.tagName === 'SVG') {
    const label = el.getAttribute('aria-label');
    if (label && looksLikeEmoji(label)) return label;
  }

  return null;
}

function restoreEmojiElements(root: Element): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  const replacements: Array<{ el: Element; text: string }> = [];
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const el = node as Element;
    // Не обрабатываем вложенные части уже найденной emoji-подмены отдельно.
    if (replacements.some(item => item.el.contains(el))) continue;
    const text = emojiText(el);
    if (text !== null) replacements.push({ el, text });
  }

  for (const { el, text } of replacements) {
    el.replaceWith(document.createTextNode(text));
  }
}

export function getRichText(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement;
  restoreEmojiElements(clone);

  // innerText учитывает блочную разметку, но реализация DOM в тестах (и часть
  // старых браузеров) не превращает <br> в перевод строки. Маркер сохраняет
  // это поведение одинаковым, не затрагивая остальные пробельные символы.
  let breakMarker = '\uE000vkify-br\uE001';
  while (clone.textContent?.includes(breakMarker)) breakMarker += '\uE001';
  clone.querySelectorAll('br').forEach(br => br.replaceWith(document.createTextNode(breakMarker)));

  const text = clone.innerText ?? clone.textContent ?? '';
  return text.split(breakMarker).join('\n');
}
