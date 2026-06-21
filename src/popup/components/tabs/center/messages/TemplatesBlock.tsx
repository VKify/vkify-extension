import React, { useState, useCallback, useMemo, useRef } from 'react';
import SettingRow from '../../../ui/SettingRow.js';
import SettingsSection, { SectionDivider } from '../../../ui/SettingsSection.js';
import NestedSettings, { NestedField } from '../../../ui/NestedSettings.js';
import InfoBlock from '../../../ui/InfoBlock.js';
import HotkeyPicker from '../../../ui/HotkeyPicker.js';
import { useSettings } from '../../../../context/SettingsContext.js';
import { useToast } from '../../../../context/ToastContext.js';
import {
  FileTextIcon, PlusIcon, XIcon, EditIcon, KeyboardIcon, SparklesIcon, MessageIcon, AttachIcon, InfoIcon,
} from '../../../icons/Icons.js';
import type { MessageTemplate, TemplateAttachment, HotkeyCombo } from '../../../../../types/index.js';

/**
 * Шаблоны сообщений — тело отдельной подстраницы «Мессенджер → Шаблоны»
 * (см. MessagesPage + SubpageHost). У функции много опций (способы открытия,
 * горячая клавиша, поведение, список шаблонов с редактором), поэтому она
 * вынесена на собственную страницу — заголовок и иконку рисует DetailPage,
 * здесь только содержимое.
 */

const DEFAULT_TEMPLATES_HOTKEY: HotkeyCombo = {
  ctrlKey: true, shiftKey: false, altKey: false, code: 'Space', label: 'Ctrl+Space',
};

const TPL_NAME_MAX = 60;
const TPL_TEXT_MAX = 2000;

// Лимиты вложений: файлы хранятся base64-строками в chrome.storage.local
// (квота 10 МБ на всё расширение, unlimitedStorage не запрашиваем), поэтому
// сознательно скромные.
const ATTACH_MAX_FILES = 3;
const ATTACH_MAX_BYTES = 1.5 * 1024 * 1024; // 1,5 МБ на файл

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} МБ`;
  if (n >= 1024)        return `${Math.round(n / 1024)} КБ`;
  return `${n} Б`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

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
  attachments: TemplateAttachment[];
}

const BLANK_EDIT: EditingState = { id: null, name: '', text: '', attachments: [] };

export default function TemplatesBlock(): React.ReactElement {
  const { settings, saveSetting } = useSettings();
  const { showToast } = useToast();

  const enabled = settings['message_templates_enabled'] === true;
  const slashEnabled = settings['message_templates_trigger_slash'] === true;
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const startCreate  = useCallback(() => setEditing(BLANK_EDIT), []);
  const startEdit    = useCallback((t: MessageTemplate) => setEditing({
    id: t.id, name: t.name, text: t.text, attachments: t.attachments ?? [],
  }), []);
  const cancelEdit   = useCallback(() => setEditing(null), []);

  const handleSave = useCallback((): void => {
    if (!editing) return;
    const name = editing.name.trim().slice(0, TPL_NAME_MAX);
    const text = editing.text.slice(0, TPL_TEXT_MAX);
    if (!name) { showToast('Укажите название', 'error'); return; }
    if (!text.trim()) { showToast('Укажите текст шаблона', 'error'); return; }
    const attachments = editing.attachments;

    if (editing.id) {
      const next = templates.map(t => t.id === editing.id ? { ...t, name, text, attachments } : t);
      void saveSetting('message_templates', next);
      showToast('Шаблон обновлён', 'success');
    } else {
      const next: MessageTemplate[] = [
        ...templates,
        { id: genId(), name, text, addedAt: Date.now(), attachments },
      ];
      void saveSetting('message_templates', next);
      showToast(`«${name}» добавлен`, 'success');
    }
    setEditing(null);
  }, [editing, templates, saveSetting, showToast]);

  const handleAttachFiles = useCallback(async (list: FileList | null): Promise<void> => {
    if (!editing || !list || list.length === 0) return;
    const next = [...editing.attachments];
    for (const file of Array.from(list)) {
      if (next.length >= ATTACH_MAX_FILES) {
        showToast(`Не больше ${ATTACH_MAX_FILES} файлов на шаблон`, 'warning');
        break;
      }
      if (file.size > ATTACH_MAX_BYTES) {
        showToast(`«${file.name}» больше ${formatBytes(ATTACH_MAX_BYTES)}`, 'error');
        continue;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        next.push({
          id: genId(),
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl,
        });
      } catch {
        showToast(`Не удалось прочитать «${file.name}»`, 'error');
      }
    }
    setEditing(prev => (prev ? { ...prev, attachments: next } : prev));
  }, [editing, showToast]);

  const handleRemoveAttachment = useCallback((attId: string): void => {
    setEditing(prev => (prev
      ? { ...prev, attachments: prev.attachments.filter(a => a.id !== attId) }
      : prev));
  }, []);

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
      {/* Секция: активация функции */}
      <SettingsSection>
        <SettingRow
          id="message_templates_enabled"
          title="Включить шаблоны"
          description="При включении в ВК-чате будут доступны триггеры открытия пикера"
          icon={<SparklesIcon className="w-5 h-5" />}
          iconColor="purple"
        />
      </SettingsSection>

      {/* Секция: способы открытия пикера — видна только когда функция включена */}
      {enabled && (
        <SettingsSection
          title="Способы открытия"
          description="Чем вызвать пикер шаблонов в поле сообщения"
          icon={<KeyboardIcon className="w-5 h-5" />}
          iconColor="cyan"
        >
          <SettingRow
            id="message_templates_trigger_slash"
            title="Слэш в начале строки"
            description="Наберите «/» в пустом поле сообщения — откроется пикер"
            icon={<MessageIcon className="w-5 h-5" />}
            iconColor="blue"
          />
          <SectionDivider />
          <SettingRow
            id="message_templates_trigger_hotkey"
            title="Горячая клавиша"
            description="Открывает пикер в любой момент при фокусе на поле сообщения"
            icon={<KeyboardIcon className="w-5 h-5" />}
            iconColor="cyan"
          />
          {hotkeyEnabled && (
            <NestedSettings accent="cyan">
              <NestedField
                title="Сочетание клавиш"
                description="Нажмите и задайте удобную комбинацию"
              >
                <HotkeyPicker
                  value={hotkey}
                  defaultValue={DEFAULT_TEMPLATES_HOTKEY}
                  onChange={handleHotkeyChange}
                />
              </NestedField>
            </NestedSettings>
          )}
          <SectionDivider />
          <SettingRow
            id="message_templates_trigger_autocomplete"
            title="Автоподсказка по мере набора"
            description="Подсказывает подходящие шаблоны по префиксу. Может мешать обычному набору"
            icon={<SparklesIcon className="w-5 h-5" />}
            iconColor="orange"
          />
        </SettingsSection>
      )}

      {/* Секция: поведение после выбора шаблона */}
      {enabled && (
        <SettingsSection
          title="Поведение"
          description="Что происходит после выбора шаблона"
          icon={<SparklesIcon className="w-5 h-5" />}
          iconColor="green"
        >
          <SettingRow
            id="message_templates_auto_send"
            title="Отправлять сообщение сразу"
            description="После выбора шаблона (мышь или Enter) сообщение уйдёт в VK без вашего подтверждения"
            icon={<FileTextIcon className="w-5 h-5" />}
            iconColor="green"
          />
        </SettingsSection>
      )}

      {/* Секция: список шаблонов с редактором */}
      <SettingsSection
        title={`Список шаблонов (${templates.length})`}
        icon={<FileTextIcon className="w-5 h-5" />}
        iconColor="purple"
        action={!editing && (
          <button
            onClick={startCreate}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            Добавить
          </button>
        )}
      >
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
                  void handleAttachFiles(e.target.files);
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
                        onClick={() => handleRemoveAttachment(a.id)}
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

        <div className="mx-4 mb-4 mt-1">
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
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm font-medium text-[var(--text-primary)] truncate">{t.name}</span>
                      {t.attachments && t.attachments.length > 0 && (
                        <span
                          title={t.attachments.map(a => a.name).join(', ')}
                          className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-primary bg-primary/10 rounded-full flex-shrink-0"
                        >
                          <AttachIcon className="w-3 h-3" />
                          {t.attachments.length}
                        </span>
                      )}
                    </div>
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
      </SettingsSection>

      {/* Подсказка: как пользоваться шаблонами в чате — выделенный блок.
          Клавиши берём из актуальных настроек, а не из текста. */}
      <InfoBlock icon={<InfoIcon className="w-4 h-4" />} title="Как пользоваться в чате VK" variant="tip">
        <ul className="space-y-1.5">
          <li>
            <span className="font-semibold text-[var(--text-primary)]">Открыть пикер</span>
            {slashEnabled && <> — введите <Kbd>/</Kbd> в пустом поле</>}
            {slashEnabled && hotkeyEnabled && ' или'}
            {hotkeyEnabled && <> нажмите <ComboKeys combo={hotkey} /></>}
            {!slashEnabled && !hotkeyEnabled && (
              <> — включите способ открытия выше (слэш или горячую клавишу)</>
            )}.
          </li>
          <li>
            <span className="font-semibold text-[var(--text-primary)]">Навигация</span> —
            <Kbd>↑</Kbd> / <Kbd>↓</Kbd> выбирают, <Kbd>Enter</Kbd> вставляет.
          </li>
          {hotkeyEnabled && (
            <li>
              <span className="font-semibold text-[var(--text-primary)]">Закрыть</span> — той же
              клавишей, что и открывает: <ComboKeys combo={hotkey} />.
            </li>
          )}
          <li>
            <span className="font-semibold text-[var(--text-primary)]">Переменные</span> подставляются
            автоматически из текущего чата.
          </li>
          <li>
            <span className="font-semibold text-[var(--text-primary)]">Файлы</span> из шаблона
            прикрепляются в поле ввода — такие шаблоны не отправляются автоматически,
            отправку подтверждаете вы.
          </li>
        </ul>
      </InfoBlock>
    </div>
  );
}

/** Клавиша/символ в подсказке — моноширинный «капс» в рамке. */
function Kbd({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <kbd className="inline-flex items-center px-1.5 py-0.5 mx-0.5 text-[10px] font-mono font-semibold text-[var(--text-primary)] bg-[var(--bg-primary)] border border-[var(--border-color)] rounded shadow-sm">
      {children}
    </kbd>
  );
}

/** Актуальное сочетание клавиш из настроек — каждый клавиша-токен в рамке. */
function ComboKeys({ combo }: { combo: HotkeyCombo }): React.ReactElement {
  const keys = combo.label.split('+').map(k => k.trim()).filter(Boolean);
  return (
    <span className="inline-flex items-center">
      {keys.map((k, i) => (
        <React.Fragment key={`${k}-${i}`}>
          {i > 0 && <span className="mx-0.5 text-[var(--text-tertiary)]">+</span>}
          <Kbd>{k}</Kbd>
        </React.Fragment>
      ))}
    </span>
  );
}
