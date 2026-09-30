import React from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '../../ui/SettingRow.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { useToast } from '@/popup/context/ToastContext.js';
import { EyeIcon, EyeOffIcon } from '../../icons/Icons.js';
import { DashboardPanel } from '../../ui/DashboardPrimitives.js';

type IconColor = 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'cyan' | 'pink';

export interface ElementDef {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconColor: IconColor;
}

interface HidingSectionProps {
  title: string;
  subtitle: string;
  /** Иконка секции (уже с размером, без обёртки). */
  icon: React.ReactNode;
  /** Класс фона квадрата иконки, напр. 'bg-orange-500/10'. */
  iconBg: string;
  elements: ElementDef[];
}

/**
 * Секция-карточка страницы хаба «Скрытие»: шапка с иконкой, счётчиком
 * скрытого и кнопкой «Скрыть/Показать всё» (только если элементов больше
 * одного) + список SettingRow. Общая для всех страниц хаба.
 */
export default function HidingSection({
  title,
  subtitle,
  icon,
  iconBg: _iconBg,
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

  return (
    <DashboardPanel title={title} description={hiddenCount > 0 ? t('hidden_count', { count: hiddenCount }) : subtitle}
      icon={icon} action={action} className="pb-1">
      {elements.map((element) => (
        <React.Fragment key={element.id}>
          <SettingRow
            id={element.id}
            title={t(`items.${element.id}.title`, { defaultValue: element.title })}
            icon={element.icon}
            iconColor={element.iconColor}
            description={t(`items.${element.id}.desc`, { defaultValue: element.description })}
          />
        </React.Fragment>
      ))}
    </DashboardPanel>
  );
}
