import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PaletteIcon,
  LayoutIcon,
  ShieldIcon,
  BanIcon,
  CodeIcon,
  ActivityIcon,
  SettingsIcon,
  MusicIcon,
  ZapIcon,
  LayoutRowsIcon,
  BookmarkIcon,
  WidgetsIcon,
} from '../icons/Icons.js';
import type { TabDef } from '../../constants/tabs.js';
import { useVKifyStore } from '../../store/index.js';

interface TabsProps {
  tabs: TabDef[];
}

export const tabIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  palette: PaletteIcon,
  layout: LayoutIcon,
  shield: ShieldIcon,
  ban: BanIcon,
  code: CodeIcon,
  zap: ZapIcon,
  activity: ActivityIcon,
  settings: SettingsIcon,
  music: MusicIcon,
  'layout-rows': LayoutRowsIcon,
  bookmark: BookmarkIcon,
  widgets: WidgetsIcon,
};

export default function Tabs({ tabs }: TabsProps) {
  const { t } = useTranslation('settings');
  // Активная вкладка и её переключение живут в сторе (ui-слайс) — компонент
  // подписан узко, ре-рендерится только на смену вкладки.
  const activeTab = useVKifyStore((s) => s.activeTab);
  const setActiveTab = useVKifyStore((s) => s.setActiveTab);
  const navRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = (): void => {
      const selected = track.querySelector<HTMLElement>('[aria-current="page"]');
      if (!selected) return;
      const next = { left: selected.offsetLeft, width: selected.offsetWidth };
      setIndicator(previous => previous.left === next.left && previous.width === next.width ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    track.querySelectorAll('button').forEach(button => observer.observe(button));
    return () => observer.disconnect();
  }, [activeTab, tabs, t]);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced ? 'instant' : 'smooth' });
  }, [activeTab]);

  return (
    <nav className="px-5 my-2">
      <div ref={navRef} className="popup-tabs">
        <div ref={trackRef} className="popup-tabs__track">
        <span aria-hidden="true" className="popup-tabs__indicator" style={{ width: indicator.width, transform: `translateX(${indicator.left}px)`, opacity: indicator.width ? 1 : 0 }} />
        {tabs.map((tab) => {
          const IconComponent = tabIcons[tab.icon];
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              aria-label={t(`tabs.${tab.id}`, { defaultValue: tab.id })}
              title={t(`tabs.${tab.id}`, { defaultValue: tab.id })}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={event => {
                const index = tabs.findIndex(item => item.id === tab.id);
                const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
                  : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length
                    : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
                if (next < 0) return;
                event.preventDefault();
                setActiveTab(tabs[next]!.id);
                trackRef.current?.querySelectorAll('button')[next]?.focus({ preventScroll: true });
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`
                popup-tabs__item text-center
                ${isActive
                  ? 'text-white'
                  : 'text-[var(--text-secondary)]'}
              `}
            >
              {IconComponent && <IconComponent className="w-4 h-4" />}
              <span className="popup-tabs__label">
                {t(`tabs.${tab.id}`, { defaultValue: tab.id })}
              </span>
            </button>
          );
        })}
        </div>
      </div>
    </nav>
  );
}
