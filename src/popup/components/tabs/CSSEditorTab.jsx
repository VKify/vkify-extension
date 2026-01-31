import React, { useState, useEffect, useRef, useCallback } from 'react';
import SettingRow from '../ui/SettingRow';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';

// Иконки
const CodeIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="16 18 22 12 16 6"/>
    <polyline points="8 6 2 12 8 18"/>
  </svg>
);

const PlayIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);

const SaveIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
  </svg>
);

const TrashIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);

const CopyIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

const UndoIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 7v6h6"/>
    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
  </svg>
);

const RedoIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 7v6h-6"/>
    <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>
  </svg>
);

const FormatIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="21" y1="10" x2="3" y2="10"/>
    <line x1="21" y1="6" x2="3" y2="6"/>
    <line x1="21" y1="14" x2="3" y2="14"/>
    <line x1="21" y1="18" x2="3" y2="18"/>
  </svg>
);

// CSS шаблоны
// CSS шаблоны
const CSS_TEMPLATES = [
  {
    name: 'Скрыть элемент',
    code: `.element-class {\n  display: none !important;\n}`
  },
  {
    name: 'Изменить цвет',
    code: `.element-class {\n  color: #ff0000 !important;\n  background-color: #000000 !important;\n}`
  },
  {
    name: 'Скруглить углы',
    code: `.element-class {\n  border-radius: 16px !important;\n}`
  },
  {
    name: 'Тень блока',
    code: `.element-class {\n  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15) !important;\n}`
  },
  {
    name: 'Hover эффект',
    code: `.element-class {\n  transition: all 0.3s ease !important;\n}\n\n.element-class:hover {\n  transform: scale(1.02) !important;\n  box-shadow: 0 6px 25px rgba(0, 0, 0, 0.2) !important;\n}`
  },
  {
    name: 'Центрирование (Flex)',
    code: `.element-class {\n  display: flex !important;\n  justify-content: center !important;\n  align-items: center !important;\n}`
  },
  {
    name: 'Обрезать текст',
    code: `.element-class {\n  white-space: nowrap !important;\n  overflow: hidden !important;\n  text-overflow: ellipsis !important;\n  max-width: 100% !important;\n}`
  },
  {
    name: 'Плавная прокрутка',
    code: `html {\n  scroll-behavior: smooth !important;\n}`
  },
  {
    name: 'Убрать скроллбар',
    code: `/* Для Chrome/Safari */\n.element-class::-webkit-scrollbar {\n  display: none !important;\n}\n\n/* Для Firefox */\n.element-class {\n  scrollbar-width: none !important;\n}\n\n/* Универсально */\n.element-class {\n  -ms-overflow-style: none !important;\n}`
  },
  {
    name: 'Фиксированная шапка',
    code: `.header-class {\n  position: fixed !important;\n  top: 0 !important;\n  left: 0 !important;\n  width: 100% !important;\n  z-index: 9999 !important;\n  box-shadow: 0 2px 10px rgba(0,0,0,0.1) !important;\n}`
  },
  {
    name: 'Градиентный фон',
    code: `.element-class {\n  background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%) !important;\n  color: white !important;\n}`
  },
  {
    name: 'Затемнение фона',
    code: `.overlay-class {\n  position: fixed !important;\n  top: 0 !important;\n  left: 0 !important;\n  width: 100% !important;\n  height: 100% !important;\n  background: rgba(0, 0, 0, 0.7) !important;\n  z-index: 10000 !important;\n}`
  },
  {
    name: 'Сброс отступов',
    code: `.element-class {\n  margin: 0 !important;\n  padding: 0 !important;\n  border: none !important;\n}`
  },
  {
    name: 'Повернуть элемент',
    code: `.element-class {\n  transform: rotate(45deg) !important;\n  transform-origin: center !important;\n}`
  }
];

// Мягкая подсветка синтаксиса CSS
function highlightCSS(code) {
  if (!code) return '';
  
  let highlighted = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Комментарии
  highlighted = highlighted.replace(
    /(\/\*[\s\S]*?\*\/)/g,
    '<span class="css-comment">$1</span>'
  );
  
  // Селекторы
  highlighted = highlighted.replace(
    /^([^{}\/]+?)(\s*\{)/gm,
    '<span class="css-selector">$1</span>$2'
  );
  
  // Свойства
  highlighted = highlighted.replace(
    /(\s*)([\w-]+)(\s*:)/g,
    '$1<span class="css-property">$2</span>$3'
  );
  
  // !important
  highlighted = highlighted.replace(
    /(!important)/gi,
    '<span class="css-important">$1</span>'
  );
  
  // Цвета hex
  highlighted = highlighted.replace(
    /(#[0-9a-fA-F]{3,8})/g,
    '<span class="css-color">$1</span>'
  );
  
  // Числа с единицами
  highlighted = highlighted.replace(
    /(\d+\.?\d*)(px|em|rem|%|vh|vw|deg|s|ms)/g,
    '<span class="css-number">$1$2</span>'
  );
  
  return highlighted;
}

// Форматирование CSS
function formatCSS(code) {
  if (!code.trim()) return '';
  
  return code
    .replace(/\s+/g, ' ')
    .replace(/\{\s*/g, ' {\n  ')
    .replace(/;\s*/g, ';\n  ')
    .replace(/\s*\}/g, '\n}')
    .replace(/\}\s*/g, '}\n\n')
    .replace(/  \n/g, '\n')
    .replace(/\n\n\n+/g, '\n\n')
    .trim();
}

export default function CSSEditorTab() {
  const { settings } = useSettings();
  const { showToast } = useToast();
  
  const [code, setCode] = useState('');
  const [history, setHistory] = useState(['']);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [showTemplates, setShowTemplates] = useState(false);
  const [lineCount, setLineCount] = useState(1);
  
  const textareaRef = useRef(null);
  const highlightRef = useRef(null);

  // Загрузка сохранённого CSS из storage
  useEffect(() => {
    const loadCSS = async () => {
      try {
        const result = await chrome.storage.local.get(['custom_css']);
        if (result.custom_css) {
          setCode(result.custom_css);
          setHistory([result.custom_css]);
        }
      } catch (e) {}
    };
    
    loadCSS();
  }, []);

  // Обновление номеров строк
  useEffect(() => {
    const lines = code.split('\n').length;
    setLineCount(lines);
  }, [code]);

  // Синхронизация скролла
  const syncScroll = () => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  // Добавление в историю
  const addToHistory = useCallback((newCode) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      if (newHistory[newHistory.length - 1] !== newCode) {
        newHistory.push(newCode);
        if (newHistory.length > 30) newHistory.shift();
      }
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 29));
  }, [historyIndex]);

  // Обработка изменения кода
  const handleCodeChange = (e) => {
    setCode(e.target.value);
  };

  // Сохранение в историю при потере фокуса
  const handleBlur = () => {
    if (code !== history[historyIndex]) {
      addToHistory(code);
    }
  };

  // Отмена
  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setCode(history[newIndex]);
    }
  };

  // Повтор
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setCode(history[newIndex]);
    }
  };

  // Применить CSS (сохранить + включить)
  const handleApply = async () => {
    try {
      await chrome.storage.local.set({ 
        custom_css: code,
        custom_css_enabled: true 
      });
      addToHistory(code);
      showToast('CSS применён!', 'success');
    } catch (e) {
      showToast('Ошибка применения', 'error');
    }
  };

  // Сохранить без применения
  const handleSave = async () => {
    try {
      await chrome.storage.local.set({ custom_css: code });
      addToHistory(code);
      showToast('CSS сохранён', 'success');
    } catch (e) {
      showToast('Ошибка сохранения', 'error');
    }
  };

  // Очистить
  const handleClear = () => {
    if (code && !confirm('Очистить весь CSS код?')) return;
    setCode('');
    addToHistory('');
  };

  // Копировать
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      showToast('Скопировано!', 'success');
    } catch (e) {
      showToast('Не удалось скопировать', 'error');
    }
  };

  // Форматировать
  const handleFormat = () => {
    const formatted = formatCSS(code);
    setCode(formatted);
    addToHistory(formatted);
    showToast('Отформатировано', 'success');
  };

  // Вставить шаблон
  const insertTemplate = (template) => {
    const newCode = code + (code ? '\n\n' : '') + template.code;
    setCode(newCode);
    addToHistory(newCode);
    setShowTemplates(false);
    
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
      }
    }, 100);
  };

  // Обработка Tab и Ctrl+Z/Y
  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const newCode = code.substring(0, start) + '  ' + code.substring(end);
      setCode(newCode);
      
      setTimeout(() => {
        e.target.selectionStart = e.target.selectionEnd = start + 2;
      }, 0);
    }
    
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      handleUndo();
    }
    
    if ((e.ctrlKey && e.shiftKey && e.key === 'z') || (e.ctrlKey && e.key === 'y')) {
      e.preventDefault();
      handleRedo();
    }
  };

  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);
  const isEnabled = settings.custom_css_enabled;

  return (
    <div className="space-y-4">
      
      {/* Переключатель через SettingRow */}
      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <span className="text-lg">🎨</span>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Пользовательский CSS</h3>
        </div>

        <SettingRow
          id="custom_css_enabled"
          title="Включить свой CSS"
          description={isEnabled ? 'Стили применяются к странице' : 'Стили отключены'}
          icon={<CodeIcon className="w-5 h-5" />}
          iconColor="purple"
        />
      </section>

      {/* Панель инструментов */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleApply}
          className="flex items-center gap-1.5 px-3 py-2 bg-success text-white text-xs font-medium rounded-xl hover:bg-success/90 transition-colors active:scale-95"
        >
          <PlayIcon className="w-3.5 h-3.5" />
          Применить
        </button>
        
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-xs font-medium rounded-xl hover:bg-primary/90 transition-colors active:scale-95"
        >
          <SaveIcon className="w-3.5 h-3.5" />
          Сохранить
        </button>
        
        <div className="flex items-center bg-[var(--bg-primary)] rounded-xl shadow-card">
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-l-xl"
            title="Отменить"
          >
            <UndoIcon className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-[var(--border-color)]" />
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-r-xl"
            title="Повторить"
          >
            <RedoIcon className="w-4 h-4" />
          </button>
        </div>
        
        <button
          onClick={handleFormat}
          className="p-2 bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl shadow-card transition-colors"
          title="Форматировать"
        >
          <FormatIcon className="w-4 h-4" />
        </button>
        
        <button
          onClick={handleCopy}
          className="p-2 bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl shadow-card transition-colors"
          title="Копировать"
        >
          <CopyIcon className="w-4 h-4" />
        </button>
        
        <button
          onClick={handleClear}
          className="p-2 bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-error rounded-xl shadow-card transition-colors"
          title="Очистить"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Редактор кода */}
      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="relative h-56 font-mono text-[13px]">
          {/* Номера строк */}
          <div className="absolute left-0 top-0 bottom-0 w-9 bg-[var(--bg-secondary)] border-r border-[var(--border-color)] overflow-hidden pointer-events-none">
            <div className="py-3 px-2 text-right text-[var(--text-tertiary)] text-xs leading-[1.65] select-none">
              {lineNumbers.map(num => (
                <div key={num}>{num}</div>
              ))}
            </div>
          </div>
          
          {/* Подсветка синтаксиса */}
          <div
            ref={highlightRef}
            className="absolute left-9 top-0 right-0 bottom-0 overflow-auto p-3 pointer-events-none"
            aria-hidden="true"
          >
            <pre
              className="css-highlight leading-[1.65] whitespace-pre-wrap break-words"
              dangerouslySetInnerHTML={{ 
                __html: highlightCSS(code) || '<span class="text-[var(--text-tertiary)]">/* Введите CSS код... */</span>' 
              }}
            />
          </div>
          
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={handleCodeChange}
            onBlur={handleBlur}
            onScroll={syncScroll}
            onKeyDown={handleKeyDown}
            placeholder="/* Введите CSS код... */"
            spellCheck={false}
            className="absolute left-9 top-0 right-0 bottom-0 w-[calc(100%-2.25rem)] h-full resize-none bg-transparent text-transparent caret-[var(--text-primary)] p-3 leading-[1.65] outline-none font-mono"
          />
        </div>
        
        {/* Статус бар */}
        <div className="flex items-center justify-between px-3 py-2 bg-[var(--bg-secondary)] border-t border-[var(--border-color)] text-xs text-[var(--text-tertiary)]">
          <div className="flex items-center gap-3">
            <span>{lineCount} {lineCount === 1 ? 'строка' : lineCount < 5 ? 'строки' : 'строк'}</span>
            <span>{code.length} симв.</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-success' : 'bg-[var(--text-tertiary)]'}`} />
            <span>{isEnabled ? 'Активен' : 'Выключен'}</span>
          </div>
        </div>
      </section>

      {/* Шаблоны */}
      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          className="w-full flex items-center justify-between p-4 hover:bg-[var(--bg-secondary)] transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">📝</span>
            <span className="text-sm font-medium text-[var(--text-primary)]">Готовые шаблоны</span>
          </div>
          <svg 
            className={`w-5 h-5 text-[var(--text-tertiary)] transition-transform duration-200 ${showTemplates ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        
        {showTemplates && (
          <div className="px-3 pb-3 space-y-2">
            {CSS_TEMPLATES.map((template, index) => (
              <button
                key={index}
                onClick={() => insertTemplate(template)}
                className="w-full text-left p-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-xl transition-colors active:scale-[0.98]"
              >
                <div className="text-sm font-medium text-[var(--text-primary)] mb-1">
                  {template.name}
                </div>
                <code className="text-[11px] text-[var(--text-tertiary)] font-mono line-clamp-1">
                  {template.code.split('\n')[0]}...
                </code>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Подсказка */}
      <div className="flex gap-3 p-3.5 rounded-xl bg-primary/5 border border-primary/10">
        <span className="text-xl flex-shrink-0">💡</span>
        <div>
          <div className="text-xs font-medium text-primary mb-0.5">Подсказка</div>
          <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Используйте <code className="px-1 py-0.5 bg-[var(--bg-secondary)] rounded text-[10px]">!important</code> для 
            переопределения стилей ВКонтакте
          </div>
        </div>
      </div>
    </div>
  );
}