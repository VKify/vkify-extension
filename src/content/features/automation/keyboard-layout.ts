import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap, HotkeyCombo } from '@/types/index.js';

/**
 * Конвертирует текст между русской и латинской раскладками клавиатуры.
 * Горячая клавиша: настраивается пользователем.
 *
 * Работает с contentEditable (поля сообщений VK) и обычными input/textarea.
 * Определяет направление конвертации автоматически по составу текста.
 * Если выделен текст — конвертирует только выделение, иначе — весь текст в поле.
 */

const DEFAULT_HOTKEY: HotkeyCombo = {
  ctrlKey: false, shiftKey: true, altKey: true, code: 'KeyQ', label: 'Alt+Shift+Q',
};


const EN = '`qwertyuiop[]asdfghjkl;\'zxcvbnm,./~@#$%^&QWERTYUIOP{}ASDFGHJKL:"|ZXCVBNM<>?';
const RU = 'ёйцукенгшщзхъфывапролджэячсмитьбю.Ё"№;%:?ЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭ/ЯЧСМИТЬБЮ,';

const enToRu: Record<string, string> = {};
const ruToEn: Record<string, string> = {};

for (let i = 0; i < EN.length; i++) {
  enToRu[EN[i]] = RU[i];
  ruToEn[RU[i]] = EN[i];
}


/**
 * Определяет, является ли текст преимущественно латинским.
 * Логика из оригинала: если не-русских символов >= не-латинских → текст латинский.
 */
function isLatin(text: string): boolean {
  const nonRu = text.replace(/[а-я]/gi, '').length;
  const nonEn = text.replace(/[a-z]/gi, '').length;
  return nonRu >= nonEn;
}

/** Конвертирует строку между раскладками. */
function convertText(text: string): string {
  const toRu = isLatin(text);
  return text.replace(/./gs, (ch) =>
    toRu
      ? (enToRu[ch] ?? ruToEn[ch] ?? ch)
      : (ruToEn[ch] ?? enToRu[ch] ?? ch),
  );
}

/** Рекурсивно конвертирует текстовые узлы в DOM-поддереве (сохраняет HTML-разметку). */
function convertTextNodes(node: Node): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      if (child.textContent) child.textContent = convertText(child.textContent);
    } else {
      convertTextNodes(child);
    }
  }
}


function convertContentEditable(el: HTMLElement): void {
  const sel = window.getSelection();
  if (!sel) return;

  if (sel.type === 'Range') {
    // Есть выделение — конвертируем только его
    const range = sel.getRangeAt(0);
    const fragment = range.cloneContents();
    convertTextNodes(fragment);

    const wrapper = document.createElement('span');
    wrapper.appendChild(fragment);
    document.execCommand('insertHTML', false, wrapper.innerHTML);
  } else {
    // Нет выделения — конвертируем весь текст элемента
    const text = el.innerText;
    if (!text.trim()) return;

    // Запоминаем позицию курсора
    const range = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    const endContainer = range?.endContainer ?? null;
    const endOffset = range?.endOffset ?? 0;
    const nodeIndex = endContainer
      ? Array.from(el.childNodes).indexOf(endContainer as ChildNode)
      : -1;

    // Клонируем, конвертируем, вставляем
    const clone = el.cloneNode(true) as HTMLElement;
    convertTextNodes(clone);
    sel.selectAllChildren(el);
    document.execCommand('insertHTML', false, clone.innerHTML);

    // Восстанавливаем позицию курсора
    if (nodeIndex >= 0 && el.childNodes[nodeIndex]) {
      try {
        const newRange = document.createRange();
        const targetNode = el.childNodes[nodeIndex];
        const maxOffset = targetNode.nodeType === Node.TEXT_NODE
          ? (targetNode as Text).length
          : 0;
        newRange.setStart(targetNode, Math.min(endOffset, maxOffset));
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
      } catch {
        // Ignore cursor restore failures — not critical
      }
    }
  }
}

function convertInput(el: HTMLInputElement | HTMLTextAreaElement): void {
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  const hasSelection = start !== end;

  if (hasSelection) {
    // Конвертируем только выделенный текст
    const text = el.value.slice(start, end);
    if (!text) return;
    const converted = convertText(text);
    // Выделение уже активно — execCommand заменит его
    document.execCommand('insertText', false, converted);
    el.setSelectionRange(start, start + converted.length);
  } else {
    // Конвертируем весь текст
    const text = el.value;
    if (!text.trim()) return;
    const cursor = start;
    el.select();
    document.execCommand('insertText', false, convertText(text));
    el.setSelectionRange(cursor, cursor);
  }
}


function matchesHotkey(e: KeyboardEvent, combo: HotkeyCombo): boolean {
  return (
    e.ctrlKey  === combo.ctrlKey  &&
    e.shiftKey === combo.shiftKey &&
    e.altKey   === combo.altKey   &&
    e.code     === combo.code
  );
}


export function createKeyboardLayoutFeature(manager: FeatureManager): FeatureMap {
  let active = false;
  let currentHotkey: HotkeyCombo = DEFAULT_HOTKEY;
  let unsubscribe: (() => void) | null = null;

  const handleKeydown = (e: KeyboardEvent): void => {
    if (!matchesHotkey(e, currentHotkey)) return;

    const el = document.activeElement as HTMLElement | null;
    if (!el) return;

    const isEditable = el.isContentEditable;
    const isInput = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
    if (!isEditable && !isInput) return;

    e.preventDefault();
    e.stopPropagation();

    if (isEditable) {
      convertContentEditable(el);
    } else {
      convertInput(el as HTMLInputElement | HTMLTextAreaElement);
    }
  };

  return {
    keyboard_layout_switch: {
      enable: async () => {
        if (active) return;

        // Загружаем сохранённый хоткей
        const stored = await manager.getSetting<HotkeyCombo>('keyboard_layout_hotkey');
        currentHotkey = stored ?? DEFAULT_HOTKEY;

        // Слушаем изменения хоткея в реальном времени
        unsubscribe = manager.onStorageChange((key, value) => {
          if (key === 'keyboard_layout_hotkey' && value) {
            currentHotkey = value as HotkeyCombo;
          }
        });

        document.addEventListener('keydown', handleKeydown, true);
        active = true;
        console.log(`[VKify] keyboard_layout_switch: включено (${currentHotkey.label})`);
      },
      disable: () => {
        document.removeEventListener('keydown', handleKeydown, true);
        unsubscribe?.();
        unsubscribe = null;
        active = false;
        console.log('[VKify] keyboard_layout_switch: выключено');
      },
    },
  };
}