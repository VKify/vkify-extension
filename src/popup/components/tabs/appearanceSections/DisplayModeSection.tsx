import React, { memo } from 'react';
import SettingRow from '../../ui/SettingRow.js';
import RangeSlider from '../../ui/RangeSlider.js';
import { SidebarIcon, SearchIcon, LayoutRowsIcon, MonitorIcon, WidthIcon, MoveHorizontalIcon, RadiusIcon } from '../../icons/Icons.js';
import { useSettings } from '../../../context/SettingsContext.js';
import { DISPLAY_MODES } from '../../../constants/appearance.js';

type IconColor = 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'cyan' | 'pink';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  sidebar: SidebarIcon,
  search: SearchIcon,
  rows: LayoutRowsIcon,
};

/**
 * Формы аватарок. id синхронизированы с SHAPE_RADIUS в
 * content/features/appearance/border-radius.ts и enum'ом в settings-schema.ts.
 * radius здесь — только для превью в попапе.
 */
const AVATAR_SHAPES: { id: string; name: string; radius: string }[] = [
  { id: '',      name: 'Своё',     radius: '' },
  { id: 'drop',  name: 'Капля',    radius: '0 50% 50% 50%' },
  { id: 'leaf',  name: 'Лист',     radius: '0 50% 0 50%' },
  { id: 'petal', name: 'Лепесток', radius: '50% 0 50% 0' },
  { id: 'blob',  name: 'Блоб',     radius: '30% 70% 70% 30% / 30% 30% 70% 70%' },
];

function Divider(): React.ReactElement {
  return <div className="mx-3 border-t border-[var(--border-color)] opacity-50" />;
}

const DisplayModeSection = memo(function DisplayModeSection(): React.ReactElement {
  const { settings, saveSetting } = useSettings();

  const widthEnabled = settings['content_width_enabled'] === true;
  const widthValue   = (settings['content_width'] as number | undefined) ?? 1100;

  const offsetEnabled = settings['page_offset_enabled'] === true;
  const offsetValue   = (settings['page_offset_value'] as number | undefined) ?? 50;

  // Human-readable label: "← 240px" / "Центр" / "240px →"
  const MAX_OFFSET = 600;
  const offsetPx = Math.round(((offsetValue - 50) / 50) * MAX_OFFSET);
  const dirLabel = offsetValue === 50
    ? 'Центр'
    : offsetValue < 50
      ? `← ${Math.abs(offsetPx)}px`
      : `${offsetPx}px →`;
  const pct = offsetValue; // 0–100 → slider fill %

  const shape = (settings['avatar_radius_shape'] as string | undefined) ?? '';
  // 50% — нативный вид VK (аватарки изначально круглые), поэтому это дефолт
  const percent = (settings['border_radius'] as number | undefined) ?? 50;

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

      {DISPLAY_MODES.map((mode) => {
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
            <Divider />
          </React.Fragment>
        );
      })}

      {/* Ширина контента */}
      <SettingRow
        id="content_width_enabled"
        title="Ширина контента"
        description="Увеличить ширину профиля, ленты и сообщений до нужного значения"
        icon={<WidthIcon className="w-5 h-5" />}
        iconColor="purple"
      />

      {widthEnabled && (
        <div className="px-4 pb-4 pt-2">
          <RangeSlider
            id="content_width"
            label="Ширина"
            value={widthValue}
            min={900}
            max={2500}
            step={50}
            unit="px"
            onChange={(v) => { void saveSetting('content_width', v); }}
          />
        </div>
      )}

      <Divider />

      {/* Смещение страницы */}
      <SettingRow
        id="page_offset_enabled"
        title="Смещение страницы"
        description="Сдвигает контент VK влево или вправо — удобно на широких мониторах"
        icon={<MoveHorizontalIcon className="w-5 h-5" />}
        iconColor="blue"
      />

      {offsetEnabled && (
        <div className="px-4 pb-4 pt-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--text-primary)]">Положение</span>
            <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-lg">
              {dirLabel}
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={offsetValue}
            onChange={(e) => { void saveSetting('page_offset_value', parseInt(e.target.value, 10)); }}
            className="w-full h-2 rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
              [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md
              [&::-webkit-slider-thumb]:shadow-primary/30
              [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:active:scale-95
              [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5
              [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:border-none"
            style={{
              background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${pct}%, var(--bg-tertiary) ${pct}%, var(--bg-tertiary) 100%)`,
            }}
          />

          <div className="flex justify-between text-[10px] text-[var(--text-tertiary)] px-0.5">
            <span>← Влево</span>
            <span>Центр</span>
            <span>Вправо →</span>
          </div>
        </div>
      )}

      <Divider />

      {/* Скругление аватарок */}
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
            <RadiusIcon className="w-5 h-5 text-cyan-500" />
          </div>
          <span className="text-sm font-medium text-[var(--text-primary)]">
            Скругление аватарок
          </span>
        </div>

        <div className="grid grid-cols-5 gap-2 mb-4">
          {AVATAR_SHAPES.map((s) => {
            const selected = shape === s.id;
            const previewRadius = s.id === '' ? `${percent}%` : s.radius;
            return (
              <button
                key={s.id || 'percent'}
                onClick={() => { void saveSetting('avatar_radius_shape', s.id); }}
                aria-pressed={selected}
                className={`
                  flex flex-col items-center gap-1.5 py-2 rounded-xl border-2 transition-all
                  ${selected
                    ? 'border-primary bg-primary/5'
                    : 'border-[var(--border-color)] hover:border-[var(--text-tertiary)]'}
                `}
              >
                <span
                  className={`w-7 h-7 ${selected ? 'bg-primary' : 'bg-[var(--text-tertiary)]'}`}
                  style={{ borderRadius: previewRadius }}
                />
                <span className={`text-[10px] font-medium ${selected ? 'text-primary' : 'text-[var(--text-secondary)]'}`}>
                  {s.name}
                </span>
              </button>
            );
          })}
        </div>

        {shape === '' ? (
          <RangeSlider
            id="border_radius"
            label="Скругление"
            value={percent}
            min={0}
            max={50}
            step={5}
            unit="%"
            zeroLabel="Квадратные"
            onChange={(value) => { void saveSetting('border_radius', value); }}
          />
        ) : (
          <p className="text-[10px] text-[var(--text-tertiary)]">
            Для фигурной формы процент скругления не используется
          </p>
        )}
      </div>
    </section>
  );
});

export default DisplayModeSection;
