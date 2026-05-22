import React from 'react';
import SettingRow from '../ui/SettingRow.js';
import InfoBlock from '../ui/InfoBlock.js';
import { useSettings } from '../../context/SettingsContext.js';
import { useToast } from '../../context/ToastContext.js';
import {
  EyeOffIcon,
  ImageIcon,
  SparklesIcon,
  UserPlusIcon,
  SmileIcon,
  MessageCircleIcon,
  ArrowUpIcon,
  SettingsIcon,
  LockIcon,
} from '../icons/Icons.js';

type IconColor = 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'cyan' | 'pink';

interface ElementDef {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconColor: IconColor;
}

const ELEMENTS: ElementDef[] = [
  {
    id: 'hide_stories',
    title: 'Истории',
    description: 'Блок историй в ленте',
    icon: <ImageIcon className="w-5 h-5" />,          // фото/сторис
    iconColor: 'orange',
  },
  {
    id: 'hide_recommendations',
    title: 'Рекомендации',
    description: 'Рекомендуемый контент',
    icon: <SparklesIcon className="w-5 h-5" />,       // ✨ «для вас»
    iconColor: 'purple',
  },
  {
    id: 'hide_friends_suggestions',
    title: 'Возможные друзья',
    description: 'Блок с предложениями дружбы',
    icon: <UserPlusIcon className="w-5 h-5" />,       // добавить в друзья
    iconColor: 'blue',
  },
  {
    id: 'hide_emoji_status',
    title: 'Эмодзи-статусы',
    description: 'Статусы с эмодзи у пользователей',
    icon: <SmileIcon className="w-5 h-5" />,          // улыбка/эмодзи
    iconColor: 'pink',
  },
  {
    id: 'hide_mini_chat',
    title: 'Мини-чат',
    description: 'Всплывающий чат в углу',
    icon: <MessageCircleIcon className="w-5 h-5" />,  // пузырь чата
    iconColor: 'cyan',
  },
  {
    id: 'hide_scroll_top',
    title: 'Кнопка «Наверх»',
    description: 'Кнопка прокрутки вверх',
    icon: <ArrowUpIcon className="w-5 h-5" />,        // стрелка вверх
    iconColor: 'green',
  },
  {
    id: 'hide_menu_settings',
    title: 'Настройки в меню',
    description: 'Пункт настроек в левом меню',
    icon: <SettingsIcon className="w-5 h-5" />,       // шестерёнка
    iconColor: 'purple',
  },
  {
    id: 'hide_auth_popup',
    title: 'Убрать окно авторизации',
    description: 'Скрывает всплывающие окна входа и баннеры',
    icon: <LockIcon className="w-5 h-5" />,           // замок/авторизация
    iconColor: 'red',
  },
];

export default function ElementsTab(): React.ReactElement {
  const { settings, saveMultiple } = useSettings();
  const { showToast } = useToast();

  const hideIds = ELEMENTS.map(e => e.id);
  const hiddenCount = hideIds.filter(id => settings[id] === true).length;
  const allHidden = hiddenCount === hideIds.length;

  const handleToggleAll = async (): Promise<void> => {
    const newValue = !allHidden;
    const updates: Record<string, boolean> = {};
    hideIds.forEach(id => { updates[id] = newValue; });
    await saveMultiple(updates);
    showToast(newValue ? 'Все элементы скрыты' : 'Все элементы показаны', 'success');
  };

  return (
    <div className="space-y-4">
      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-3">
            {/* Секция: EyeOffIcon — скрытие элементов (уникален среди всех секций) */}
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center flex-shrink-0">
              <EyeOffIcon className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Скрыть элементы</h3>
              {hiddenCount > 0 && (
                <span className="flex items-center gap-1 mt-0.5 text-xs font-medium text-orange-500">
                  <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                  {hiddenCount} скрыто
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleToggleAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 rounded-lg transition-colors active:scale-95"
          >
            {allHidden ? (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                Показать всё
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                  <circle cx="12" cy="12" r="3"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
                Скрыть всё
              </>
            )}
          </button>
        </div>

        {ELEMENTS.map((element, index) => (
          <React.Fragment key={element.id}>
            <SettingRow
              id={element.id}
              title={element.title}
              icon={element.icon}
              iconColor={element.iconColor}
              description={element.description}
            />
            {index < ELEMENTS.length - 1 && (
              <div className="mx-3 border-t border-[var(--border-color)] opacity-50" />
            )}
          </React.Fragment>
        ))}
      </section>

      <InfoBlock variant="tip" icon="💡" title="Подсказка">
        Скрытие элементов помогает сосредоточиться на важном контенте
      </InfoBlock>
    </div>
  );
}