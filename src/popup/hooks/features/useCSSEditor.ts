import { useState, useEffect, useRef, useCallback } from 'react';
import type { RefObject } from 'react';
import { formatCSS } from '../../utils/css/formatter.js';
import type { CSSTemplate } from '../../utils/css/templates.js';

const MAX_HISTORY_SIZE = 30;

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

  useEffect(() => {
    const loadCSS = async (): Promise<void> => {
      try {
        const result = await chrome.storage.local.get(['custom_css']);
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
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      if (newHistory[newHistory.length - 1] !== newCode) {
        newHistory.push(newCode);
        if (newHistory.length > MAX_HISTORY_SIZE) {
          newHistory.shift();
        }
      }
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY_SIZE - 1));
  }, [historyIndex]);

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
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setCode(history[newIndex]);
    }
  }, [historyIndex, history]);

  const redo = useCallback((): void => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setCode(history[newIndex]);
    }
  }, [historyIndex, history]);

  const apply = useCallback(async (): Promise<void> => {
    await chrome.storage.local.set({
      custom_css: code,
      custom_css_enabled: true,
    });
    addToHistory(code);
  }, [code, addToHistory]);

  const save = useCallback(async (): Promise<void> => {
    await chrome.storage.local.set({ custom_css: code });
    addToHistory(code);
  }, [code, addToHistory]);

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
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newCode = code.substring(0, start) + '  ' + code.substring(end);
      setCode(newCode);

      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }

    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
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