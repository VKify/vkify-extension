import React from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '../../ui/SettingRow.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { useToast } from '@/popup/context/ToastContext.js';
import { EyeIcon, EyeOffIcon } from '../../icons/Icons.js';

export interface ElementDef {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface HidingSectionProps {
  title: string;
  elements: ElementDef[];
}

/** Settings list with a shared bulk action; the page supplies the heading. */
export default function HidingSection({
  title,
  elements,
}: HidingSectionProps): React.ReactElement {
  const { t } = useTranslation('hiding');
  const settings = useVKifyStore((s) => s.settings);
  const saveMultiple = useVKifyStore((s) => s.saveMultiple);
  const { showToast } = useToast();

  const hideIds = elements.map(e => e.id);
  const hiddenCount = hideIds.filter(id => settings[id] === true).length;
  const allHidden = hiddenCount === hideIds.length;

  const handleToggleAll = async (): Promise<void> => {
    const newValue = !allHidden;
    const updates: Record<string, boolean> = {};
    hideIds.forEach(id => { updates[id] = newValue; });
    await saveMultiple(updates);
    showToast(newValue ? t('toast_hidden') : t('toast_shown'), 'success');
  };

  const action = elements.length > 1 ? (
    <button
      onClick={() => { void handleToggleAll(); }}
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 active:scale-95"
    >
      {allHidden ? <EyeIcon className="h-3.5 w-3.5" /> : <EyeOffIcon className="h-3.5 w-3.5" />}
      {allHidden ? t('show_all') : t('hide_all')}
    </button>
  ) : undefined;

  const rows = elements.map(element => (
    <SettingRow
      key={element.id}
      id={element.id}
      title={t(`items.${element.id}.title`, { defaultValue: element.title })}
      icon={element.icon}
      description={t(`items.${element.id}.desc`, { defaultValue: element.description })}
    />
  ));

  return (
    <section className="dashboard-panel pb-1" aria-label={title}>
      {action && <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-1">
        <span className="text-xs text-[var(--text-secondary)]">{t('hidden_count', { count: hiddenCount })}</span>
        {action}
      </div>}
      {rows}
    </section>
  );

}
