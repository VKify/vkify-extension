import React from 'react';
import SettingRow from '../../ui/SettingRow.js';
import { useSettings } from '../../../context/SettingsContext.js';
import { useToast } from '../../../context/ToastContext.js';
import { EyeIcon, EyeOffIcon } from '../../icons/Icons.js';

type IconColor = 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'cyan' | 'pink';

export interface ElementDef {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconColor: IconColor;
}

interface ElementsSectionProps {
  title: string;
  subtitle: string;
  /** Иконка секции (уже с размером, без обёртки). */
  icon: React.ReactNode;
  /** Класс фона квадрата иконки, напр. 'bg-orange-500/10'. */
  iconBg: string;
  elements: ElementDef[];
}

/**
 * Секция-карточка страницы хаба «Элементы»: шапка с иконкой, счётчиком
 * скрытого и кнопкой «Скрыть/Показать всё» (только если элементов больше
 * одного) + список SettingRow. Общая для всех страниц хаба.
 */
export default function ElementsSection({
  title,
  subtitle,
  icon,
  iconBg,
  elements,
}: ElementsSectionProps): React.ReactElement {
  const { settings, saveMultiple } = useSettings();
  const { showToast } = useToast();

  const hideIds = elements.map(e => e.id);
  const hiddenCount = hideIds.filter(id => settings[id] === true).length;
  const allHidden = hiddenCount === hideIds.length;

  const handleToggleAll = async (): Promise<void> => {
    const newValue = !allHidden;
    const updates: Record<string, boolean> = {};
    hideIds.forEach(id => { updates[id] = newValue; });
    await saveMultiple(updates);
    showToast(newValue ? 'Все элементы скрыты' : 'Все элементы показаны', 'success');
  };

  // Кольцо в цвет плитки — как у канонического IconTile. Литеральные классы
  // (а не runtime-строка), иначе Tailwind не сгенерирует их при сборке.
  const ringByBg: Record<string, string> = {
    'bg-blue-500/10':   'ring-blue-500/20',
    'bg-cyan-500/10':   'ring-cyan-500/20',
    'bg-green-500/10':  'ring-green-500/20',
    'bg-orange-500/10': 'ring-orange-500/20',
    'bg-pink-500/10':   'ring-pink-500/20',
    'bg-purple-500/10': 'ring-purple-500/20',
  };
  const iconRing = `${ringByBg[iconBg] ?? 'ring-[var(--border-color)]'} ring-1 ring-inset`;

  return (
    <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${iconBg} ${iconRing} flex items-center justify-center flex-shrink-0`}>
            {icon}
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
            {hiddenCount > 0 ? (
              <span className="flex items-center gap-1 mt-0.5 text-xs font-medium text-orange-500">
                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                {hiddenCount} скрыто
              </span>
            ) : (
              <p className="text-xs text-[var(--text-secondary)]">{subtitle}</p>
            )}
          </div>
        </div>
        {elements.length > 1 && (
          <button
            onClick={() => { void handleToggleAll(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 rounded-lg transition-colors active:scale-95"
          >
            {allHidden ? (
              <>
                <EyeIcon className="w-3.5 h-3.5" />
                Показать всё
              </>
            ) : (
              <>
                <EyeOffIcon className="w-3.5 h-3.5" />
                Скрыть всё
              </>
            )}
          </button>
        )}
      </div>

      {elements.map((element, index) => (
        <React.Fragment key={element.id}>
          <SettingRow
            id={element.id}
            title={element.title}
            icon={element.icon}
            iconColor={element.iconColor}
            description={element.description}
          />
          {index < elements.length - 1 && (
            <div className="mx-3 border-t border-[var(--border-color)]" />
          )}
        </React.Fragment>
      ))}
    </section>
  );
}
