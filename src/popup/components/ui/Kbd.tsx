import React from 'react';
import type { HotkeyCombo } from '../../../types/index.js';

/** Человекочитаемая подпись клавиши по её KeyboardEvent.code. */
export function codeToLabel(code: string): string {
  if (code.startsWith('Key'))    return code.slice(3);
  if (code.startsWith('Digit'))  return code.slice(5);
  if (code.startsWith('Numpad')) return `Num${code.slice(6)}`;
  const map: Record<string, string> = {
    Space: 'Пробел', Backspace: 'Bksp', Delete: 'Del', Insert: 'Ins',
    Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'",
    Comma: ',', Period: '.', Slash: '/', Backslash: '\\',
    Minus: '-', Equal: '=', Backquote: '`',
    Tab: 'Tab', CapsLock: 'Caps', Escape: 'Esc',
  };
  return map[code] ?? code;
}

/**
 * Канонический вид клавиши («капс») — единый по всему попапу. Используется и в
 * `HotkeyPicker` (выбор сочетания), и в подсказках (InfoBlock), чтобы клавиши
 * везде выглядели одинаково.
 */
export function Kbd({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <kbd className="inline-flex items-center justify-center px-1.5 py-0.5 min-w-[22px] text-[10px] font-mono font-semibold bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded shadow-[0_1px_0_var(--border-color)] leading-none">
      {children}
    </kbd>
  );
}

/**
 * Сочетание клавиш (`HotkeyCombo`) в виде капсов с разделителями «+». Порядок и
 * подписи совпадают с `HotkeyPicker` (Ctrl · Alt · Shift · клавиша), поэтому
 * хоткей в подсказке и в пикере выглядят идентично.
 */
export function HotkeyKeys({ combo }: { combo: HotkeyCombo }): React.ReactElement {
  const keys: string[] = [];
  if (combo.ctrlKey)  keys.push('Ctrl');
  if (combo.altKey)   keys.push('Alt');
  if (combo.shiftKey) keys.push('Shift');
  keys.push(codeToLabel(combo.code));

  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((k, i) => (
        <React.Fragment key={`${k}-${i}`}>
          {i > 0 && <span className="text-[10px] text-[var(--text-tertiary)]">+</span>}
          <Kbd>{k}</Kbd>
        </React.Fragment>
      ))}
    </span>
  );
}
