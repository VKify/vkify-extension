import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection, { SectionDivider } from '@/popup/components/ui/SettingsSection.js';
import InfoBlock from '@/popup/components/ui/InfoBlock.js';
import HotkeyPicker from '@/popup/components/ui/HotkeyPicker.js';
import { Kbd, HotkeyKeys } from '@/popup/components/ui/Kbd.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { useToast } from '@/popup/context/ToastContext.js';
import {
  FileTextIcon, PlusIcon, XIcon, EditIcon, SparklesIcon, AttachIcon, InfoIcon,
  SearchIcon, CopyIcon,
} from '@/popup/components/icons/Icons.js';
import TemplateEditor from './TemplateEditor.js';
import {
  type EditingState, BLANK_EDIT, DEFAULT_TEMPLATES_HOTKEY,
  TPL_NAME_MAX, TPL_TEXT_MAX, ATTACH_MAX_FILES, ATTACH_MAX_BYTES,
  formatBytes, readFileAsDataUrl, genId,
} from './templateUtils.js';
import type { MessageTemplate, HotkeyCombo } from '@/types/index.js';

/**
 * Шаблоны сообщений — тело отдельной подстраницы «Мессенджер → Шаблоны»
 * (см. MessagesPage + SubpageHost). У функции много опций (способы открытия,
 * горячая клавиша, поведение, список шаблонов с редактором), поэтому она
 * вынесена на собственную страницу — заголовок и иконку рисует DetailPage,
 * здесь только содержимое. Форма правки — в TemplateEditor, общие
 * константы/типы/хелперы — в templateUtils.
 */

export default function TemplatesBlock(): React.ReactElement {
  const { t: tr } = useTranslation('center');
  const settings = useVKifyStore((s) => s.settings);
  const saveSetting = useVKifyStore((s) => s.saveSetting);
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
  const [query, setQuery] = useState('');

  // Поиск показываем только когда шаблонов много — иначе он лишний.
  const showSearch = templates.length > 5;
  const visibleTemplates = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(t =>
      t.name.toLowerCase().includes(q) || t.text.toLowerCase().includes(q),
    );
  }, [templates, query]);

  const startCreate  = useCallback(() => setEditing(BLANK_EDIT), []);
  const startEdit    = useCallback((t: MessageTemplate) => setEditing({
    id: t.id, name: t.name, text: t.text, attachments: t.attachments ?? [],
  }), []);
  const cancelEdit   = useCallback(() => setEditing(null), []);

  const handleSave = useCallback((): void => {
    if (!editing) return;
    const name = editing.name.trim().slice(0, TPL_NAME_MAX);
    const text = editing.text.slice(0, TPL_TEXT_MAX);
    if (!name) { showToast(tr('tpl.toast.need_name'), 'error'); return; }
    if (!text.trim()) { showToast(tr('tpl.toast.need_text'), 'error'); return; }
    const attachments = editing.attachments;

    if (editing.id) {
      const next = templates.map(t => t.id === editing.id ? { ...t, name, text, attachments } : t);
      void saveSetting('message_templates', next);
      showToast(tr('tpl.toast.updated'), 'success');
    } else {
      const next: MessageTemplate[] = [
        ...templates,
        { id: genId(), name, text, addedAt: Date.now(), attachments },
      ];
      void saveSetting('message_templates', next);
      showToast(tr('tpl.toast.added', { name }), 'success');
    }
    setEditing(null);
  }, [editing, templates, saveSetting, showToast, tr]);

  const handleAttachFiles = useCallback(async (list: FileList | null): Promise<void> => {
    if (!editing || !list || list.length === 0) return;
    const next = [...editing.attachments];
    for (const file of Array.from(list)) {
      if (next.length >= ATTACH_MAX_FILES) {
        showToast(tr('tpl.toast.max_files', { max: ATTACH_MAX_FILES }), 'warning');
        break;
      }
      if (file.size > ATTACH_MAX_BYTES) {
        showToast(tr('tpl.toast.too_big', { name: file.name, size: formatBytes(ATTACH_MAX_BYTES) }), 'error');
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
        showToast(tr('tpl.toast.read_failed', { name: file.name }), 'error');
      }
    }
    setEditing(prev => (prev ? { ...prev, attachments: next } : prev));
  }, [editing, showToast, tr]);

  const handleRemoveAttachment = useCallback((attId: string): void => {
    setEditing(prev => (prev
      ? { ...prev, attachments: prev.attachments.filter(a => a.id !== attId) }
      : prev));
  }, []);

  const handleRemove = useCallback((id: string): void => {
    void saveSetting('message_templates', templates.filter(t => t.id !== id));
    showToast(tr('tpl.toast.removed'), 'success');
  }, [templates, saveSetting, showToast, tr]);

  // Перетаскивание для ручного порядка. Доступно только когда список не
  // отфильтрован (иначе индексы видимого ≠ индексам хранилища) и не идёт правка.
  const [dragId, setDragId] = useState<string | null>(null);
  const canReorder = !editing && query.trim() === '';

  const handleReorder = useCallback((fromId: string, toId: string): void => {
    if (fromId === toId) return;
    const from = templates.findIndex(t => t.id === fromId);
    const to   = templates.findIndex(t => t.id === toId);
    if (from < 0 || to < 0) return;
    const next = [...templates];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    void saveSetting('message_templates', next);
  }, [templates, saveSetting]);

  const handleDuplicate = useCallback((t: MessageTemplate): void => {
    const copy: MessageTemplate = {
      ...t,
      id: genId(),
      name: `${t.name}${tr('tpl.copy_suffix')}`.slice(0, TPL_NAME_MAX),
      addedAt: Date.now(),
      attachments: t.attachments ?? [],
    };
    const idx = templates.findIndex(x => x.id === t.id);
    const next = [...templates];
    next.splice(idx + 1, 0, copy);
    void saveSetting('message_templates', next);
    showToast(tr('tpl.toast.duplicated'), 'success');
  }, [templates, saveSetting, showToast, tr]);

  return (
    <div className="space-y-5">
      {/* Master-тумблер — выделенный блок: главный переключатель функции */}
      <section className="rounded-2xl shadow-card overflow-hidden ring-1 ring-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <SettingRow
          id="message_templates_enabled"
          title={tr('tpl.master_title')}
          description={tr('tpl.master_desc')}
          icon={<SparklesIcon className="w-5 h-5" />}
          iconColor="purple"
        />
      </section>

      {/* Зависимые настройки — гаснут и блокируются, пока функция выключена */}
      <div
        aria-disabled={!enabled}
        className={`space-y-5 transition-opacity duration-200 ${enabled ? '' : 'opacity-40 pointer-events-none select-none grayscale'}`}
      >
        {/* Группа «Открытие шаблонов» */}
        <SettingsSection title={tr('tpl.open_section')}>
          <SettingRow
            id="message_templates_trigger_slash"
            title={tr('tpl.slash_title')}
            description={tr('tpl.slash_desc')}
          />
          <SectionDivider />
          <SettingRow
            id="message_templates_trigger_hotkey"
            title={tr('tpl.hotkey_title')}
            description={tr('tpl.hotkey_desc')}
          />
          {/* Сочетание клавиш — подстрока самой «Горячей клавиши», без разделителя */}
          {hotkeyEnabled && (
            <div className="-mt-1.5 px-4 pb-3 flex items-center justify-between gap-3">
              <span className="text-xs text-[var(--text-tertiary)]">{tr('tpl.combo')}</span>
              <HotkeyPicker
                value={hotkey}
                defaultValue={DEFAULT_TEMPLATES_HOTKEY}
                onChange={handleHotkeyChange}
              />
            </div>
          )}
          <SectionDivider />
          <SettingRow
            id="message_templates_trigger_autocomplete"
            title={tr('tpl.autocomplete_title')}
            description={tr('tpl.autocomplete_desc')}
          />
        </SettingsSection>

        {/* Группа «После выбора» */}
        <SettingsSection title={tr('tpl.after_section')}>
          <SettingRow
            id="message_templates_auto_send"
            title={tr('tpl.autosend_title')}
            description={tr('tpl.autosend_desc')}
          />
        </SettingsSection>
      </div>

      {/* Группа «Шаблоны» — список с редактором (доступна всегда) */}
      <SettingsSection
        title={tr('tpl.list_section')}
        description={templates.length > 0 ? tr('tpl.count', { count: templates.length }) : undefined}
        icon={<FileTextIcon className="w-5 h-5" />}
        iconColor="purple"
        action={!editing && (
          <button
            onClick={startCreate}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors active:scale-95"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            {tr('tpl.add')}
          </button>
        )}
      >
        {editing && (
          <TemplateEditor
            editing={editing}
            onChange={setEditing}
            onSave={handleSave}
            onCancel={cancelEdit}
            onAttachFiles={list => void handleAttachFiles(list)}
            onRemoveAttachment={handleRemoveAttachment}
          />
        )}

        {/* Поиск — появляется только когда шаблонов много */}
        {showSearch && !editing && (
          <div className="mx-4 mb-2 relative">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)] pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={tr('tpl.search_placeholder')}
              className="w-full pl-8 pr-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        )}

        <div className="mx-4 mb-4 mt-1">
          {templates.length === 0 ? (
            <div className="py-8 text-center bg-[var(--bg-secondary)] rounded-xl">
              <FileTextIcon className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-2" />
              <p className="text-xs text-[var(--text-tertiary)]">{tr('tpl.empty')}</p>
              <p className="text-[11px] text-[var(--text-tertiary)] mt-1 opacity-80">
                {tr('tpl.empty_hint_a')} <Kbd>/</Kbd> {tr('tpl.empty_hint_b')}
              </p>
            </div>
          ) : visibleTemplates.length === 0 ? (
            <div className="py-6 text-center bg-[var(--bg-secondary)] rounded-xl">
              <p className="text-xs text-[var(--text-tertiary)]">{tr('tpl.not_found')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleTemplates.map(t => (
                <div
                  key={t.id}
                  draggable={canReorder}
                  onDragStart={() => setDragId(t.id)}
                  onDragOver={e => { if (canReorder && dragId) e.preventDefault(); }}
                  onDrop={() => { if (dragId) handleReorder(dragId, t.id); setDragId(null); }}
                  onDragEnd={() => setDragId(null)}
                  className={`group flex items-center gap-2 p-3 bg-[var(--bg-primary)] border rounded-xl transition-all
                    ${dragId === t.id
                      ? 'border-primary/40 ring-2 ring-primary/20 opacity-60'
                      : 'border-[var(--border-color)] hover:border-primary/30 hover:shadow-sm'}`}
                >
                  {canReorder && (
                    <span
                      className="flex-shrink-0 -ml-1 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-60 cursor-grab active:cursor-grabbing transition-opacity"
                      title={tr('tpl.drag')}
                    >
                      <GripIcon />
                    </span>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm font-semibold text-[var(--text-primary)] truncate">{t.name}</span>
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
                    <div className="text-xs text-[var(--text-secondary)] truncate mt-0.5">{t.text}</div>
                  </div>

                  {/* Быстрые действия — проявляются по наведению */}
                  <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(t)}
                      className="p-1.5 text-[var(--text-tertiary)] hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title={tr('tpl.edit')}
                    >
                      <EditIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDuplicate(t)}
                      className="p-1.5 text-[var(--text-tertiary)] hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title={tr('tpl.duplicate')}
                    >
                      <CopyIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRemove(t.id)}
                      className="p-1.5 text-[var(--text-tertiary)] hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                      title={tr('tpl.delete')}
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SettingsSection>

      {/* Подсказка: как пользоваться шаблонами в чате — выделенный блок.
          Клавиши берём из актуальных настроек, а не из текста. */}
      <InfoBlock icon={<InfoIcon className="w-4 h-4" />} title={tr('tpl.tip.title')} variant="tip">
        <ul className="space-y-1.5">
          <li>
            <span className="font-semibold text-[var(--text-primary)]">{tr('tpl.tip.open')}</span>
            {slashEnabled && <> — {tr('tpl.tip.type')} <Kbd>/</Kbd> {tr('tpl.tip.in_empty_field')}</>}
            {slashEnabled && hotkeyEnabled && ' ' + tr('tpl.tip.or')}
            {hotkeyEnabled && <> {tr('tpl.tip.press')} <HotkeyKeys combo={hotkey} /></>}
            {!slashEnabled && !hotkeyEnabled && (
              <> — {tr('tpl.tip.open_none')}</>
            )}.
          </li>
          <li>
            <span className="font-semibold text-[var(--text-primary)]">{tr('tpl.tip.nav')}</span> —
            <Kbd>↑</Kbd> / <Kbd>↓</Kbd> {tr('tpl.tip.nav_select')} <Kbd>Enter</Kbd> {tr('tpl.tip.nav_insert')}
          </li>
          {hotkeyEnabled && (
            <li>
              <span className="font-semibold text-[var(--text-primary)]">{tr('tpl.tip.close')}</span> — {tr('tpl.tip.close_desc')} <HotkeyKeys combo={hotkey} />.
            </li>
          )}
          <li>
            <span className="font-semibold text-[var(--text-primary)]">{tr('tpl.tip.vars')}</span> {tr('tpl.tip.vars_desc')}
          </li>
          <li>
            <span className="font-semibold text-[var(--text-primary)]">{tr('tpl.tip.files')}</span> {tr('tpl.tip.files_desc')}
          </li>
        </ul>
      </InfoBlock>
    </div>
  );
}

/** Ручка перетаскивания — две колонки точек («грип»). */
function GripIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="3.5" r="1.1" />
      <circle cx="9" cy="3.5" r="1.1" />
      <circle cx="5" cy="7" r="1.1" />
      <circle cx="9" cy="7" r="1.1" />
      <circle cx="5" cy="10.5" r="1.1" />
      <circle cx="9" cy="10.5" r="1.1" />
    </svg>
  );
}

