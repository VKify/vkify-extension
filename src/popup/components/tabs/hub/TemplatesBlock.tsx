import React, { useState, useCallback, useMemo } from 'react';
import SettingRow from '../../ui/SettingRow.js';
import InfoBlock from '../../ui/InfoBlock.js';
import HotkeyPicker from '../../ui/HotkeyPicker.js';
import { useSettings } from '../../../context/SettingsContext.js';
import { useToast } from '../../../context/ToastContext.js';
import {
  FileTextIcon, PlusIcon, XIcon, EditIcon, KeyboardIcon, SparklesIcon, MessageIcon,
} from '../../icons/Icons.js';
import type { MessageTemplate, HotkeyCombo } from '../../../../types/index.js';

/**
 * Шаблоны сообщений — блок на странице «Сообщения» хаба «Центр» (бывшая
 * отдельная вкладка «Шаблоны»). Шаблоны вставляются в чат ВК, поэтому живут
 * рядом с остальными инструментами сообщений.
 */

const DEFAULT_TEMPLATES_HOTKEY: HotkeyCombo = {
  ctrlKey: true, shiftKey: false, altKey: false, code: 'Space', label: 'Ctrl+Space',
};

const TPL_NAME_MAX = 60;
const TPL_TEXT_MAX = 2000;

const VARIABLES: { code: string; description: string }[] = [
  { code: '%first_name%',    description: 'Имя собеседника' },
  { code: '%last_name%',     description: 'Фамилия собеседника' },
  { code: '%my_first_name%', description: 'Ваше имя' },
  { code: '%my_last_name%',  description: 'Ваша фамилия' },
  { code: '%title%',         description: 'Название беседы (для групп)' },
  { code: '%peer_id%',       description: 'ID диалога (peer_id)' },
  { code: '%time%',          description: 'Текущее время' },
  { code: '%date%',          description: 'Текущая дата' },
  { code: '%br%',            description: 'Перенос строки' },
];

function genId(): string {
  return `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

interface EditingState {
  id: string | null; // null = creating new
  name: string;
  text: string;
}

const BLANK_EDIT: EditingState = { id: null, name: '', text: '' };

export default function TemplatesBlock(): React.ReactElement {
  const { settings, saveSetting } = useSettings();
  const { showToast } = useToast();

  const enabled = settings['message_templates_enabled'] === true;
  const hotkeyEnabled = settings['message_templates_trigger_hotkey'] !== false;
  const hotkey = (settings['message_templates_hotkey'] as HotkeyCombo | undefined) ?? DEFAULT_TEMPLATES_HOTKEY;
  const templates: MessageTemplate[] = useMemo(
    () => (settings['message_templates'] as MessageTemplate[] | undefined) ?? [],
    [settings],
  );

  const handleHotkeyChange = useCallback((combo: HotkeyCombo): void => {
    void saveSetting('message_templates_hotkey', combo);
  }, [saveSetting]);

  const [editing, setEditing] = useState<EditingState | null>(null);

  const startCreate  = useCallback(() => setEditing(BLANK_EDIT), []);
  const startEdit    = useCallback((t: MessageTemplate) => setEditing({ id: t.id, name: t.name, text: t.text }), []);
  const cancelEdit   = useCallback(() => setEditing(null), []);

  const handleSave = useCallback((): void => {
    if (!editing) return;
    const name = editing.name.trim().slice(0, TPL_NAME_MAX);
    const text = editing.text.slice(0, TPL_TEXT_MAX);
    if (!name) { showToast('Укажите название', 'error'); return; }
    if (!text.trim()) { showToast('Укажите текст шаблона', 'error'); return; }

    if (editing.id) {
      const next = templates.map(t => t.id === editing.id ? { ...t, name, text } : t);
      void saveSetting('message_templates', next);
      showToast('Шаблон обновлён', 'success');
    } else {
      const next: MessageTemplate[] = [
        ...templates,
        { id: genId(), name, text, addedAt: Date.now() },
      ];
      void saveSetting('message_templates', next);
      showToast(`«${name}» добавлен`, 'success');
    }
    setEditing(null);
  }, [editing, templates, saveSetting, showToast]);

  const handleRemove = useCallback((id: string): void => {
    void saveSetting('message_templates', templates.filter(t => t.id !== id));
    showToast('Шаблон удалён', 'success');
  }, [templates, saveSetting, showToast]);

  const handleInsertVar = useCallback((code: string): void => {
    if (!editing) return;
    setEditing({ ...editing, text: editing.text + code });
  }, [editing]);

  return (
    <div className="space-y-4">
      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FileTextIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Шаблоны сообщений</h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Быстрая вставка в ВК-чат по горячей клавише или слэшу
            </p>
          </div>
        </div>

        <SettingRow
          id="message_templates_enabled"
          title="Включить шаблоны"
          description="При включении в ВК-чате будут доступны триггеры открытия пикера"
          icon={<SparklesIcon className="w-5 h-5" />}
          iconColor="purple"
        />

        {enabled && (
          <>
            <div className="mx-4 border-t border-[var(--border-color)] my-2" />
            <div className="px-4 pb-1">
              <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                Способы открытия
              </span>
            </div>

            <SettingRow
              id="message_templates_trigger_slash"
              title="Слэш в начале строки"
              description="Наберите «/» в пустом поле сообщения — откроется пикер"
              icon={<MessageIcon className="w-5 h-5" />}
              iconColor="blue"
            />
            <div className="mx-3 border-t border-[var(--border-color)] opacity-50" />
            <SettingRow
              id="message_templates_trigger_hotkey"
              title="Горячая клавиша"
              description="Открывает пикер в любой момент при фокусе на поле сообщения"
              icon={<KeyboardIcon className="w-5 h-5" />}
              iconColor="cyan"
            />
            {hotkeyEnabled && (
              <div className="px-4 pb-3 pt-1 flex items-center justify-between">
                <span className="text-xs text-[var(--text-tertiary)]">Сочетание клавиш</span>
                <HotkeyPicker
                  value={hotkey}
                  defaultValue={DEFAULT_TEMPLATES_HOTKEY}
                  onChange={handleHotkeyChange}
                />
              </div>
            )}
            <div className="mx-3 border-t border-[var(--border-color)] opacity-50" />
            <SettingRow
              id="message_templates_trigger_autocomplete"
              title="Автоподсказка по мере набора"
              description="Подсказывает подходящие шаблоны по префиксу. Может мешать обычному набору"
              icon={<SparklesIcon className="w-5 h-5" />}
              iconColor="orange"
            />

            <div className="mx-3 border-t border-[var(--border-color)] opacity-50" />
            <SettingRow
              id="message_templates_auto_send"
              title="Отправлять сообщение сразу"
              description="После выбора шаблона (мышь или Enter) сообщение уйдёт в VK без вашего подтверждения"
              icon={<FileTextIcon className="w-5 h-5" />}
              iconColor="green"
            />
          </>
        )}
      </section>

      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Список шаблонов ({templates.length})</h3>
          {!editing && (
            <button
              onClick={startCreate}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Добавить
            </button>
          )}
        </div>

        {editing && (
          <div className="mx-4 mb-3 p-3 bg-[var(--bg-secondary)] rounded-xl space-y-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Название
              </label>
              <input
                type="text"
                value={editing.name}
                maxLength={TPL_NAME_MAX}
                onChange={e => setEditing({ ...editing, name: e.target.value })}
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
                onChange={e => setEditing({ ...editing, text: e.target.value })}
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
                    onClick={() => handleInsertVar(v.code)}
                    title={v.description}
                    className="px-2 py-1 text-[11px] font-mono bg-[var(--bg-primary)] hover:bg-primary/10 border border-[var(--border-color)] rounded-md text-[var(--text-secondary)] transition-colors"
                  >
                    {v.code}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={cancelEdit}
                className="flex-1 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
              >
                {editing.id ? 'Сохранить' : 'Добавить'}
              </button>
            </div>
          </div>
        )}

        <div className="mx-4 mb-4">
          {templates.length === 0 ? (
            <div className="py-8 text-center bg-[var(--bg-secondary)] rounded-xl">
              <FileTextIcon className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-2" />
              <p className="text-xs text-[var(--text-tertiary)]">Шаблонов пока нет</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {templates.map(t => (
                <div key={t.id} className="group flex items-center gap-2 p-2.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-xl transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--text-primary)] truncate">{t.name}</div>
                    <div className="text-xs text-[var(--text-tertiary)] truncate font-mono">{t.text}</div>
                  </div>
                  <button
                    onClick={() => startEdit(t)}
                    className="p-1.5 text-[var(--text-tertiary)] hover:text-primary hover:bg-primary/10 rounded-lg transition-colors opacity-60 group-hover:opacity-100"
                    title="Редактировать"
                  >
                    <EditIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRemove(t.id)}
                    className="p-1.5 text-[var(--text-tertiary)] hover:text-error hover:bg-error/10 rounded-lg transition-colors opacity-60 group-hover:opacity-100"
                    title="Удалить"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <InfoBlock variant="info" icon="ℹ️" title="Как это работает">
        В сообщениях VK при включённой опции введите «/» в пустом поле или нажмите
        Ctrl+Space — откроется пикер с подсказками. Стрелки ↑/↓ выбирают шаблон,
        Enter вставляет, Esc закрывает. Переменные подставляются автоматически —
        для имени/фамилии собеседника берётся текущий открытый чат.
      </InfoBlock>
    </div>
  );
}
