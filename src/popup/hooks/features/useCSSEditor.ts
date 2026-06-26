import { useState, useEffect, useRef, useCallback } from 'react';
import type { RefObject } from 'react';
import { useVKifyStore } from '../../store/index.js';
import { getStorage } from '../../utils/storageClient.js';
import { formatCSS } from '../../utils/css/formatter.js';
import type { CSSTemplate } from '../../utils/css/templates.js';

const MAX_HISTORY_SIZE = 30;

// Автозакрываемые пары скобок: открывающая → закрывающая.
const BRACKET_PAIRS: Record<string, string> = { '{': '}', '(': ')', '[': ']' };
const CLOSERS = new Set(Object.values(BRACKET_PAIRS));

// Оборачивает фрагмент в блочный комментарий `/* */` или снимает его,
// сохраняя ведущие/замыкающие пробелы (нужно для тоггла по Ctrl+/).
function toggleBlockComment(fragment: string): string {
  const leading = (fragment.match(/^\s*/) ?? [''])[0];
  const trailing = (fragment.match(/\s*$/) ?? [''])[0];
  const core = fragment.slice(leading.length, fragment.length - trailing.length);
  const body = core.startsWith('/*') && core.endsWith('*/')
    ? core.slice(2, -2).trim()
    : `/* ${core} */`;
  return leading + body + trailing;
}

export interface CSSEditorHook {
  code: string;
  isLoading: boolean;
  lineCount: number;
  canUndo: boolean;
  canRedo: boolean;
  textareaRef: RefObject<HTMLTextAreaElement>;
  highlightRef: RefObject<HTMLDivElement>;
  handleCodeChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleBlur: () => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  syncScroll: () => void;
  undo: () => void;
  redo: () => void;
  apply: () => Promise<void>;
  save: () => Promise<void>;
  clear: () => void;
  copy: () => Promise<void>;
  format: () => void;
  insertTemplate: (template: CSSTemplate) => void;
}

export function useCSSEditor(): CSSEditorHook {
  const [code, setCode] = useState('');
  const [history, setHistory] = useState<string[]>(['']);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  // custom_css/_enabled — настройки: пишем через store (SSOT), читаем разово
  // при маунте через storageClient (буфер редактора не должен ре-сетиться на
  // каждое изменение settings).
  const saveMultiple = useVKifyStore((s) => s.saveMultiple);

  useEffect(() => {
    const loadCSS = async (): Promise<void> => {
      try {
        const result = await getStorage(['custom_css']);
        if (result['custom_css']) {
          setCode(result['custom_css'] as string);
          setHistory([result['custom_css'] as string]);
        }
      } catch (e) {
        console.error('Failed to load CSS:', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadCSS();
  }, []);

  const addToHistory = useCallback((newCode: string): void => {
    // Решение об индексе и массиве принимаем по одним и тем же значениям,
    // иначе индекс «уезжает» за пределы истории (например, Save+Apply подряд
    // с неизменным кодом инкрементировали индекс, ничего не добавляя) и undo
    // упирается в undefined.
    const truncated = history.slice(0, historyIndex + 1);
    if (truncated[truncated.length - 1] === newCode) return;

    const next = [...truncated, newCode];
    if (next.length > MAX_HISTORY_SIZE) next.shift();

    setHistory(next);
    setHistoryIndex(next.length - 1);
  }, [history, historyIndex]);

  const syncScroll = useCallback((): void => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setCode(e.target.value);
  }, []);

  const handleBlur = useCallback((): void => {
    if (code !== history[historyIndex]) {
      addToHistory(code);
    }
  }, [code, history, historyIndex, addToHistory]);

  const undo = useCallback((): void => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    const snapshot = history[newIndex];
    if (snapshot === undefined) return;
    setHistoryIndex(newIndex);
    setCode(snapshot);
  }, [historyIndex, history]);

  const redo = useCallback((): void => {
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    const snapshot = history[newIndex];
    if (snapshot === undefined) return;
    setHistoryIndex(newIndex);
    setCode(snapshot);
  }, [historyIndex, history]);

  const apply = useCallback(async (): Promise<void> => {
    await saveMultiple({ custom_css: code, custom_css_enabled: true });
    addToHistory(code);
  }, [code, addToHistory, saveMultiple]);

  const save = useCallback(async (): Promise<void> => {
    await saveMultiple({ custom_css: code });
    addToHistory(code);
  }, [code, addToHistory, saveMultiple]);

  const clear = useCallback((): void => {
    setCode('');
    addToHistory('');
  }, [addToHistory]);

  const copy = useCallback(async (): Promise<void> => {
    await navigator.clipboard.writeText(code);
  }, [code]);

  const format = useCallback((): void => {
    const formatted = formatCSS(code);
    setCode(formatted);
    addToHistory(formatted);
  }, [code, addToHistory]);

  const insertTemplate = useCallback((template: CSSTemplate): void => {
    const newCode = code + (code ? '\n\n' : '') + template.code;
    setCode(newCode);
    addToHistory(newCode);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
      }
    }, 100);
  }, [code, addToHistory]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    const target = e.target as HTMLTextAreaElement;
    const start = target.selectionStart;
    const end = target.selectionEnd;

    // Заменяет текст и восстанавливает выделение после ре-рендера React.
    const applyEdit = (text: string, selStart: number, selEnd: number = selStart): void => {
      setCode(text);
      requestAnimationFrame(() => {
        target.selectionStart = selStart;
        target.selectionEnd = selEnd;
      });
    };

    // Ctrl+/ → переключить блочный комментарий (выделение или текущая строка)
    if (e.ctrlKey && e.key === '/') {
      e.preventDefault();
      let from = start;
      let to = end;
      if (start === end) {
        from = code.lastIndexOf('\n', start - 1) + 1;
        to = code.indexOf('\n', start);
        if (to === -1) to = code.length;
      }
      const replaced = toggleBlockComment(code.slice(from, to));
      applyEdit(code.slice(0, from) + replaced + code.slice(to), from + replaced.length);
      return;
    }

    // Tab → два пробела
    if (e.key === 'Tab') {
      e.preventDefault();
      applyEdit(code.slice(0, start) + '  ' + code.slice(end), start + 2);
      return;
    }

    // Автозакрытие скобок {} () [] — с обёртыванием выделения
    if (BRACKET_PAIRS[e.key]) {
      e.preventDefault();
      const selected = code.slice(start, end);
      applyEdit(
        code.slice(0, start) + e.key + selected + BRACKET_PAIRS[e.key] + code.slice(end),
        start + 1,
        end + 1,
      );
      return;
    }

    // «Перешагнуть» уже стоящую закрывающую скобку вместо вставки новой
    if (CLOSERS.has(e.key) && start === end && code[start] === e.key) {
      e.preventDefault();
      applyEdit(code, start + 1);
      return;
    }

    // Backspace внутри пустой пары → удалить обе скобки сразу
    if (e.key === 'Backspace' && start === end && start > 0 && BRACKET_PAIRS[code[start - 1]] === code[start]) {
      e.preventDefault();
      applyEdit(code.slice(0, start - 1) + code.slice(start + 1), start - 1);
      return;
    }

    // Enter → сохранить отступ строки, раскрыть блок между { и }
    if (e.key === 'Enter' && start === end) {
      e.preventDefault();
      const lineStart = code.lastIndexOf('\n', start - 1) + 1;
      const indent = (code.slice(lineStart, start).match(/^[ \t]*/) ?? [''])[0];
      const before = code[start - 1];

      if (before === '{' && code[start] === '}') {
        const inner = indent + '  ';
        applyEdit(
          code.slice(0, start) + '\n' + inner + '\n' + indent + code.slice(start),
          start + 1 + inner.length,
        );
      } else {
        const extra = before === '{' ? '  ' : '';
        applyEdit(
          code.slice(0, start) + '\n' + indent + extra + code.slice(start),
          start + 1 + indent.length + extra.length,
        );
      }
      return;
    }

    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
      return;
    }

    if ((e.ctrlKey && e.shiftKey && e.key === 'z') || (e.ctrlKey && e.key === 'y')) {
      e.preventDefault();
      redo();
    }
  }, [code, undo, redo]);

  return {
    code,
    isLoading,
    lineCount: code.split('\n').length,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    textareaRef,
    highlightRef,
    handleCodeChange,
    handleBlur,
    handleKeyDown,
    syncScroll,
    undo,
    redo,
    apply,
    save,
    clear,
    copy,
    format,
    insertTemplate,
  };
}