import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Kbd, codeToLabel } from './Kbd.js';
import type { HotkeyCombo } from '@/types/index.js';


const MODIFIER_CODES = new Set(['ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight']);

export function buildCombo(e: KeyboardEvent): HotkeyCombo {
  const parts: string[] = [];
  if (e.ctrlKey)  parts.push('Ctrl');
  if (e.altKey)   parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  parts.push(codeToLabel(e.code));

  return {
    ctrlKey:  e.ctrlKey,
    shiftKey: e.shiftKey,
    altKey:   e.altKey,
    code:     e.code,
    label:    parts.join('+'),
  };
}

export function matchesHotkey(e: KeyboardEvent, combo: HotkeyCombo): boolean {
  return (
    e.ctrlKey  === combo.ctrlKey  &&
    e.shiftKey === combo.shiftKey &&
    e.altKey   === combo.altKey   &&
    e.code     === combo.code
  );
}


interface HotkeyPickerProps {
  /** Текущая комбинация (из settings) */
  value: HotkeyCombo;
  /** Дефолтная комбинация для кнопки сброса */
  defaultValue: HotkeyCombo;
  /** Вызывается при выборе новой комбинации */
  onChange: (combo: HotkeyCombo) => void;
}

export default function HotkeyPicker({ value, defaultValue, onChange }: HotkeyPickerProps) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const stopRecording = useCallback(() => {
    setRecording(false);
    setError('');
  }, []);

  // Записываем нажатие клавиши
  useEffect(() => {
    if (!recording) return;

    const handleKeydown = (e: KeyboardEvent): void => {
      e.preventDefault();
      e.stopPropagation();

      if (e.code === 'Escape') {
        stopRecording();
        return;
      }

      // Игнорируем нажатия только-модификаторов
      if (MODIFIER_CODES.has(e.code)) return;

      // Требуем хотя бы один модификатор
      if (!e.ctrlKey && !e.shiftKey && !e.altKey) {
        setError('Нужен хотя бы один модификатор (Ctrl, Alt или Shift)');
        return;
      }

      onChange(buildCombo(e));
      stopRecording();
    };

    window.addEventListener('keydown', handleKeydown, true);
    return () => window.removeEventListener('keydown', handleKeydown, true);
  }, [recording, onChange, stopRecording]);

  // Закрываем при клике вне компонента
  useEffect(() => {
    if (!recording) return;
    const handleClick = (e: MouseEvent): void => {
      if (!containerRef.current?.contains(e.target as Node)) stopRecording();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [recording, stopRecording]);

  const isDefault = value.label === defaultValue.label;

  return (
    <div ref={containerRef} className="flex items-center gap-2">
      {recording ? (
        // Режим записи
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 border border-primary/30 rounded-xl animate-pulse">
          <span className="text-xs text-primary font-medium">Нажмите комбинацию...</span>
          <button
            onClick={stopRecording}
            className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Esc — отмена
          </button>
        </div>
      ) : (
        // Отображение текущей комбинации
        <div className="flex items-center gap-1">
          {value.ctrlKey  && <><Kbd>Ctrl</Kbd><span className="text-[10px] text-[var(--text-tertiary)]">+</span></>}
          {value.altKey   && <><Kbd>Alt</Kbd><span className="text-[10px] text-[var(--text-tertiary)]">+</span></>}
          {value.shiftKey && <><Kbd>Shift</Kbd><span className="text-[10px] text-[var(--text-tertiary)]">+</span></>}
          <Kbd>{codeToLabel(value.code)}</Kbd>
        </div>
      )}

      {!recording && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setError(''); setRecording(true); }}
            className="px-2 py-1 text-[10px] font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors active:scale-95"
          >
            Изменить
          </button>
          {!isDefault && (
            <button
              onClick={() => onChange(defaultValue)}
              className="px-2 py-1 text-[10px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
              title="Сбросить к умолчанию"
            >
              ↺
            </button>
          )}
        </div>
      )}

      {error && !recording && (
        <span className="text-[10px] text-error">{error}</span>
      )}
    </div>
  );
}