import React from 'react';
import { XIcon, AttachIcon } from '@/popup/components/icons/Icons.js';
import {
  type EditingState, VARIABLES, formatBytes,
  TPL_NAME_MAX, TPL_TEXT_MAX, ATTACH_MAX_FILES, ATTACH_MAX_BYTES,
} from './templateUtils.js';

interface TemplateEditorProps {
  editing: EditingState;
  onChange: (next: EditingState) => void;
  onSave: () => void;
  onCancel: () => void;
  onAttachFiles: (list: FileList | null) => void;
  onRemoveAttachment: (attId: string) => void;
}

/**
 * Форма создания/правки шаблона — управляемый компонент.
 * Всё состояние живёт в родителе (TemplatesBlock), сюда приходит через `editing`
 * и обновляется через `onChange` / обработчики.
 */
export default function TemplateEditor({
  editing, onChange, onSave, onCancel, onAttachFiles, onRemoveAttachment,
}: TemplateEditorProps): React.ReactElement {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  return (
    <div className="mx-4 mb-3 p-3 bg-[var(--bg-secondary)] rounded-xl space-y-3">
      <div>
        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
          Название
        </label>
        <input
          type="text"
          value={editing.name}
          maxLength={TPL_NAME_MAX}
          onChange={e => onChange({ ...editing, name: e.target.value })}
          placeholder="Например: Приветствие"
          className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
          Текст шаблона
        </label>
        <textarea
          value={editing.text}
          maxLength={TPL_TEXT_MAX}
          onChange={e => onChange({ ...editing, text: e.target.value })}
          placeholder="Привет, %first_name%! Как дела?"
          rows={4}
          className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
        />
        <div className="mt-1 text-[10px] text-[var(--text-tertiary)] text-right">
          {editing.text.length} / {TPL_TEXT_MAX}
        </div>
      </div>

      <div>
        <div className="text-xs font-medium text-[var(--text-secondary)] mb-1.5">Переменные</div>
        <div className="flex flex-wrap gap-1.5">
          {VARIABLES.map(v => (
            <button
              key={v.code}
              onClick={() => onChange({ ...editing, text: editing.text + v.code })}
              title={v.description}
              className="px-2 py-1 text-[11px] font-mono bg-[var(--bg-primary)] hover:bg-primary/10 border border-[var(--border-color)] rounded-md text-[var(--text-secondary)] transition-colors"
            >
              {v.code}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-xs font-medium text-[var(--text-secondary)]">
            Файлы ({editing.attachments.length}/{ATTACH_MAX_FILES})
          </div>
          {editing.attachments.length < ATTACH_MAX_FILES && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
            >
              <AttachIcon className="w-3.5 h-3.5" />
              Прикрепить
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => {
            onAttachFiles(e.target.files);
            e.target.value = ''; // позволяет выбрать тот же файл повторно
          }}
        />
        {editing.attachments.length === 0 ? (
          <p className="text-[10px] text-[var(--text-tertiary)] leading-relaxed">
            Файлы прикрепятся к сообщению вместе с текстом шаблона.
            До {ATTACH_MAX_FILES} файлов по {formatBytes(ATTACH_MAX_BYTES)}.
          </p>
        ) : (
          <div className="space-y-1">
            {editing.attachments.map(a => (
              <div key={a.id} className="flex items-center gap-2 px-2 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg">
                <AttachIcon className="w-3.5 h-3.5 text-[var(--text-tertiary)] flex-shrink-0" />
                <span className="flex-1 min-w-0 text-xs text-[var(--text-primary)] truncate" title={a.name}>
                  {a.name}
                </span>
                <span className="text-[10px] text-[var(--text-tertiary)] whitespace-nowrap">
                  {formatBytes(a.size)}
                </span>
                <button
                  onClick={() => onRemoveAttachment(a.id)}
                  title="Убрать файл"
                  className="p-1 text-[var(--text-tertiary)] hover:text-error hover:bg-error/10 rounded-md transition-colors"
                >
                  <XIcon className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
        >
          Отмена
        </button>
        <button
          onClick={onSave}
          className="flex-1 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
        >
          {editing.id ? 'Сохранить' : 'Добавить'}
        </button>
      </div>
    </div>
  );
}
