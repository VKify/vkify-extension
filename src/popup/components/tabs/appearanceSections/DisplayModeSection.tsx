import React, { memo } from 'react';
import SettingRow from '../../ui/SettingRow.js';
import { SidebarIcon, SearchIcon, LayoutRowsIcon, MonitorIcon } from '../../icons/Icons.js';
import { DISPLAY_MODES } from '../../../constants/appearance.js';

type IconColor = 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'cyan' | 'pink';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  sidebar: SidebarIcon,
  search: SearchIcon,
  rows: LayoutRowsIcon,
};

const DisplayModeSection = memo(function DisplayModeSection(): React.ReactElement {
  return (
    <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center flex-shrink-0">
          <MonitorIcon className="w-5 h-5 text-sky-500" />
        </div>
        <h3 className="text-base font-semibold text-[var(--text-primary)]">
          Режим отображения
        </h3>
      </div>

      {DISPLAY_MODES.map((mode, index) => {
        const IconComponent = ICON_MAP[mode.iconId];
        return (
          <React.Fragment key={mode.id}>
            <SettingRow
              id={mode.id}
              title={mode.title}
              description={mode.description}
              icon={IconComponent ? <IconComponent className="w-5 h-5" /> : undefined}
              iconColor={mode.iconColor as IconColor}
            />
            {index < DISPLAY_MODES.length - 1 && (
              <div className="mx-3 border-t border-[var(--border-color)] opacity-50" />
            )}
          </React.Fragment>
        );
      })}
    </section>
  );
});

export default DisplayModeSection;