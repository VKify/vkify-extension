import React, { useState } from 'react';
import SettingRow from '../ui/SettingRow.js';
import InfoBlock from '../ui/InfoBlock.js';
import { useSettings } from '../../context/SettingsContext.js';
import { useToast } from '../../context/ToastContext.js';
import { useCSSEditor } from '../../hooks/features/useCSSEditor.js';
import { CSS_TEMPLATES, highlightCSS, getPlaceholderHTML, getLineWord } from '../../utils/css/index.js';
import type { CSSTemplate } from '../../utils/css/index.js';
import {
  PlayIcon, CodeIcon, SaveIcon, TrashIcon,
  CopyIcon, UndoIcon, RedoIcon, FormatIcon,
} from '../icons/Icons.js';

export default function CSSEditorTab(): React.ReactElement {
  const { settings } = useSettings();
  const { showToast } = useToast();
  const [showTemplates, setShowTemplates] = useState(false);

  const {
    code,
    lineCount,
    canUndo,
    canRedo,
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
  } = useCSSEditor();

  const isEnabled = settings['custom_css_enabled'] === true;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  const handleApply = async (): Promise<void> => {
    try {
      await apply();
      showToast('CSS применён!', 'success');
    } catch {
      showToast('Ошибка применения', 'error');
    }
  };

  const handleSave = async (): Promise<void> => {
    try {
      await save();
      showToast('CSS сохранён', 'success');
    } catch {
      showToast('Ошибка сохранения', 'error');
    }
  };

  const handleClear = (): void => {
    if (code && !confirm('Очистить весь CSS код?')) return;
    clear();
  };

  const handleCopy = async (): Promise<void> => {
    try {
      await copy();
      showToast('Скопировано!', 'success');
    } catch {
      showToast('Не удалось скопировать', 'error');
    }
  };

  const handleFormat = (): void => {
    format();
    showToast('Отформатировано', 'success');
  };

  const handleInsertTemplate = (template: CSSTemplate): void => {
    insertTemplate(template);
    setShowTemplates(false);
  };

  return (
    <div className="space-y-4">
      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
            <CodeIcon className="w-5 h-5 text-purple-500" />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            Пользовательский CSS
          </h3>
        </div>

        <SettingRow
          id="custom_css_enabled"
          title="Включить свой CSS"
          description={isEnabled ? 'Стили применяются к странице' : 'Стили отключены'}
          icon={<CodeIcon className="w-5 h-5" />}
          iconColor="purple"
        />
      </section>

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
            onClick={undo}
            disabled={!canUndo}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-l-xl"
            title="Отменить (Ctrl+Z)"
          >
            <UndoIcon className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-[var(--border-color)]" />
          <button
            onClick={redo}
            disabled={!canRedo}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-r-xl"
            title="Повторить (Ctrl+Y)"
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

      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="relative h-56 font-mono text-[13px]">
          <div className="absolute left-0 top-0 bottom-0 w-9 bg-[var(--bg-secondary)] border-r border-[var(--border-color)] overflow-hidden pointer-events-none">
            <div className="py-3 px-2 text-right text-[var(--text-tertiary)] text-xs leading-[1.65] select-none">
              {lineNumbers.map(num => (
                <div key={num}>{num}</div>
              ))}
            </div>
          </div>

          <div
            ref={highlightRef}
            className="absolute left-9 top-0 right-0 bottom-0 overflow-auto p-3 pointer-events-none"
            aria-hidden="true"
          >
            <pre
              className="css-highlight leading-[1.65] whitespace-pre-wrap break-words"
              dangerouslySetInnerHTML={{
                __html: highlightCSS(code) || getPlaceholderHTML(),
              }}
            />
          </div>

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

        <div className="flex items-center justify-between px-3 py-2 bg-[var(--bg-secondary)] border-t border-[var(--border-color)] text-xs text-[var(--text-tertiary)]">
          <div className="flex items-center gap-3">
            <span>{lineCount} {getLineWord(lineCount)}</span>
            <span>{code.length} симв.</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-success' : 'bg-[var(--text-tertiary)]'}`} />
            <span>{isEnabled ? 'Активен' : 'Выключен'}</span>
          </div>
        </div>
      </section>

      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          className="group w-full flex items-center justify-between p-4 hover:bg-[var(--bg-secondary)]/50 transition-all duration-200"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
              <span className="text-lg">📝</span>
            </div>
            <div className="text-left">
              <span className="text-base font-semibold text-[var(--text-primary)] block">
                Готовые шаблоны
              </span>
              <span className="text-xs text-[var(--text-secondary)]">
                {CSS_TEMPLATES.length} шаблонов
              </span>
            </div>
          </div>

          <div className={`
            w-8 h-8 rounded-lg bg-[var(--bg-secondary)]
            flex items-center justify-center
            transition-all duration-300
            group-hover:bg-[var(--bg-tertiary)]
            ${showTemplates ? 'rotate-180 bg-primary/10' : ''}
          `}>
            <svg
              className={`w-4 h-4 transition-colors duration-200 ${showTemplates ? 'text-primary' : 'text-[var(--text-tertiary)]'}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </button>

        <div className={`
          grid transition-all duration-300 ease-out
          ${showTemplates ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}
        `}>
          <div className="overflow-hidden">
            <div className="px-4 pb-4 space-y-2">
              {CSS_TEMPLATES.map((template, index) => (
                <button
                  key={index}
                  onClick={() => handleInsertTemplate(template)}
                  className="
                    group/item w-full text-left p-3.5
                    bg-[var(--bg-secondary)]/50
                    hover:bg-[var(--bg-secondary)]
                    border border-transparent
                    hover:border-[var(--border-color)]
                    rounded-xl transition-all duration-200
                    hover:shadow-sm
                    active:scale-[0.98]
                  "
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                          {template.name}
                        </span>
                        <span className="
                          px-1.5 py-0.5 text-[10px] font-medium
                          bg-primary/10 text-primary rounded-md
                          opacity-0 group-hover/item:opacity-100
                          transition-opacity duration-200
                        ">
                          Вставить
                        </span>
                      </div>
                      <code className="
                        text-[11px] text-[var(--text-tertiary)]
                        font-mono line-clamp-1
                        bg-[var(--bg-tertiary)]/50
                        px-2 py-1 rounded-md
                        block
                      ">
                        {template.code.split('\n')[0]}...
                      </code>
                    </div>

                    <div className="
                      w-8 h-8 rounded-lg
                      bg-[var(--bg-tertiary)]/50
                      flex items-center justify-center
                      opacity-0 group-hover/item:opacity-100
                      transition-all duration-200
                      group-hover/item:bg-primary/10
                    ">
                      <svg
                        className="w-4 h-4 text-primary"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 5v14M5 12h14"/>
                      </svg>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <InfoBlock variant="tip" icon="💡" title="Подсказка">
        Используйте <code className="px-1 py-0.5 bg-[var(--bg-secondary)] rounded text-[10px]">!important</code> для
        переопределения стилей ВКонтакте
      </InfoBlock>
    </div>
  );
}