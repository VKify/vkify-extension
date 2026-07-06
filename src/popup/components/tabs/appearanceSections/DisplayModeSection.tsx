import React, { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '../../ui/SettingRow.js';
import SettingsSection, { SectionDivider } from '../../ui/SettingsSection.js';
import RangeSlider from '../../ui/RangeSlider.js';
import {
  SidebarIcon, SearchIcon, LayoutRowsIcon, LayoutIcon, SparklesIcon,
  WidthIcon, MoveHorizontalIcon, RadiusIcon,
} from '../../icons/Icons.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { useDebouncedCallback } from '@/popup/hooks/core/useDebouncedCallback.js';
import { previewFeatureValue } from '@/popup/utils/livePreview.js';
import { DISPLAY_MODES, type DisplayMode } from '@/popup/constants/appearance.js';

/**
 * Слайдер с live-preview на странице VK (как у цвета темы): каждое движение
 * мгновенно уезжает в контент через ENABLE_FEATURE (мимо storage), запись в
 * storage дебаунсится. Локальный стейт держит ползунок отзывчивым между
 * дебаунсами; синхронизируется, когда настройка меняется извне.
 */
function useLiveSliderValue(
  featureId: string,
  settingKey: string,
  stored: number,
): [number, (v: number) => void] {
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  const [local, setLocal] = useState(stored);

  useEffect(() => { setLocal(stored); }, [stored]);

  const commit = useDebouncedCallback((v: number): void => {
    void saveSetting(settingKey, v);
  }, 250);

  const onChange = (v: number): void => {
    setLocal(v);
    previewFeatureValue(featureId, v); // мгновенно на страницу VK
    commit(v);                         // дебаунснутый коммит в storage
  };

  return [local, onChange];
}

type IconColor = 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'cyan' | 'pink';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  sidebar: SidebarIcon,
  search: SearchIcon,
  rows: LayoutRowsIcon,
};

// Разбивка плоского списка DISPLAY_MODES по смысловым группам ТЗ:
// «Макет» (боковое меню + ширина/смещение), «Поиск», «Внешний вид».
const LAYOUT_MODE_IDS = ['minimalistic_sidebar', 'fixed_sidebar', 'sidebar_with_background'];
const SEARCH_MODE_IDS = ['collapse_search'];
const APPEARANCE_MODE_IDS = ['compact_spacing'];

const byId = (id: string): DisplayMode | undefined => DISPLAY_MODES.find((m) => m.id === id);

/**
 * Формы аватарок. id синхронизированы с SHAPE_RADIUS в
 * content/features/appearance/border-radius.ts и enum'ом в settings-schema.ts.
 * radius здесь — только для превью в попапе.
 */
// id формы аватарки → ключ в appearance.display.avatar.shapes; '' — «своё».
const AVATAR_SHAPES: { id: string; shapeKey: string; radius: string }[] = [
  { id: '',      shapeKey: 'custom', radius: '' },
  { id: 'drop',  shapeKey: 'drop',   radius: '0 50% 50% 50%' },
  { id: 'leaf',  shapeKey: 'leaf',   radius: '0 50% 0 50%' },
  { id: 'petal', shapeKey: 'petal',  radius: '50% 0 50% 0' },
  { id: 'blob',  shapeKey: 'blob',   radius: '30% 70% 70% 30% / 30% 30% 70% 70%' },
];

/** Ряд-переключатель режима по его id из DISPLAY_MODES. */
function ModeRow({ id }: { id: string }): React.ReactElement | null {
  const { t } = useTranslation('appearance');
  const mode = byId(id);
  if (!mode) return null;
  const IconComponent = ICON_MAP[mode.iconId];
  return (
    <SettingRow
      id={mode.id}
      title={t(`modes.${mode.id}.title`, { defaultValue: mode.title })}
      description={t(`modes.${mode.id}.desc`, { defaultValue: mode.description })}
      icon={IconComponent ? <IconComponent className="w-5 h-5" /> : undefined}
      iconColor={mode.iconColor as IconColor}
    />
  );
}

const DisplayModeSection = memo(function DisplayModeSection(): React.ReactElement {
  const { t } = useTranslation('appearance');
  const settings = useVKifyStore((s) => s.settings);
  const saveSetting = useVKifyStore((s) => s.saveSetting);

  const widthEnabled = settings['content_width_enabled'] === true;
  const storedWidth  = (settings['content_width'] as number | undefined) ?? 1100;
  const [widthValue, onWidthChange] = useLiveSliderValue(
    'content_width_enabled', 'content_width', storedWidth,
  );

  const offsetEnabled = settings['page_offset_enabled'] === true;
  const storedOffset  = (settings['page_offset_value'] as number | undefined) ?? 50;
  const [offsetValue, onOffsetChange] = useLiveSliderValue(
    'page_offset_enabled', 'page_offset_value', storedOffset,
  );

  // Human-readable label: "← 240px" / "Центр" / "240px →"
  const MAX_OFFSET = 600;
  const offsetPx = Math.round(((offsetValue - 50) / 50) * MAX_OFFSET);
  const dirLabel = offsetValue === 50
    ? t('display.offset.center')
    : offsetValue < 50
      ? t('display.offset.left_px', { px: Math.abs(offsetPx) })
      : t('display.offset.right_px', { px: offsetPx });
  const pct = offsetValue; // 0–100 → slider fill %

  const shape = (settings['avatar_radius_shape'] as string | undefined) ?? '';
  // 50% — нативный вид VK (аватарки изначально круглые), поэтому это дефолт
  const percent = (settings['border_radius'] as number | undefined) ?? 50;

  return (
    <div className="space-y-6">
      {/* 📐 Макет — боковое меню, ширина и смещение страницы */}
      <SettingsSection
        title={t('display.layout.section')}
        description={t('display.layout.section_desc')}
        icon={<LayoutIcon className="w-5 h-5" />}
        iconColor="cyan"
      >
        {LAYOUT_MODE_IDS.map((id, i) => (
          <React.Fragment key={id}>
            {i > 0 && <SectionDivider />}
            <ModeRow id={id} />
          </React.Fragment>
        ))}

        <SectionDivider />

        {/* Ширина контента */}
        <SettingRow
          id="content_width_enabled"
          title={t('display.width.title')}
          description={t('display.width.desc')}
          icon={<WidthIcon className="w-5 h-5" />}
          iconColor="purple"
        />
        {widthEnabled && (
          <div className="px-4 pb-3 pt-1">
            <RangeSlider
              id="content_width"
              label={t('display.width.slider')}
              value={widthValue}
              min={900}
              max={2500}
              step={50}
              unit="px"
              onChange={onWidthChange}
            />
          </div>
        )}

        <SectionDivider />

        {/* Смещение страницы */}
        <SettingRow
          id="page_offset_enabled"
          title={t('display.offset.title')}
          description={t('display.offset.desc')}
          icon={<MoveHorizontalIcon className="w-5 h-5" />}
          iconColor="blue"
        />
        {offsetEnabled && (
          <div className="px-4 pb-3 pt-1 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--text-primary)]">{t('display.offset.position')}</span>
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
              onChange={(e) => { onOffsetChange(parseInt(e.target.value, 10)); }}
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
              <span>{t('display.offset.left')}</span>
              <span>{t('display.offset.center')}</span>
              <span>{t('display.offset.right')}</span>
            </div>
          </div>
        )}
      </SettingsSection>

      {/* 🔍 Поиск */}
      <SettingsSection
        title={t('display.search.section')}
        description={t('display.search.section_desc')}
        icon={<SearchIcon className="w-5 h-5" />}
        iconColor="orange"
      >
        {SEARCH_MODE_IDS.map((id) => <ModeRow key={id} id={id} />)}
      </SettingsSection>

      {/* 🎨 Внешний вид */}
      <SettingsSection
        title={t('display.look.section')}
        description={t('display.look.section_desc')}
        icon={<SparklesIcon className="w-5 h-5" />}
        iconColor="purple"
      >
        {APPEARANCE_MODE_IDS.map((id) => <ModeRow key={id} id={id} />)}

        <SectionDivider />

        {/* Скругление аватарок — сегментированный выбор формы */}
        <div className="p-4">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 ring-1 ring-inset ring-cyan-500/20 flex items-center justify-center flex-shrink-0">
              <RadiusIcon className="w-4 h-4 text-cyan-500" />
            </div>
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {t('display.avatar.title')}
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5 p-1 rounded-2xl bg-[var(--bg-secondary)] mb-3">
            {AVATAR_SHAPES.map((s) => {
              const selected = shape === s.id;
              const previewRadius = s.id === '' ? `${percent}%` : s.radius;
              return (
                <button
                  key={s.id || 'percent'}
                  onClick={() => { void saveSetting('avatar_radius_shape', s.id); }}
                  aria-pressed={selected}
                  className={`
                    flex flex-col items-center gap-1.5 py-2 rounded-xl transition-all duration-200
                    ${selected
                      ? 'bg-[var(--bg-primary)] shadow-card ring-1 ring-inset ring-primary/30'
                      : 'hover:bg-[var(--bg-primary)]/50'}
                  `}
                >
                  <span
                    className={`w-7 h-7 transition-colors duration-200 ${selected ? 'bg-primary' : 'bg-[var(--text-tertiary)]'}`}
                    style={{ borderRadius: previewRadius }}
                  />
                  <span className={`text-[10px] font-medium ${selected ? 'text-primary' : 'text-[var(--text-secondary)]'}`}>
                    {t(`display.avatar.shapes.${s.shapeKey}`)}
                  </span>
                </button>
              );
            })}
          </div>

          {shape === '' ? (
            <RangeSlider
              id="border_radius"
              label={t('display.avatar.slider')}
              value={percent}
              min={0}
              max={50}
              step={5}
              unit="%"
              zeroLabel={t('display.avatar.zero')}
              onChange={(value) => { void saveSetting('border_radius', value); }}
            />
          ) : (
            <p className="text-[10px] text-[var(--text-tertiary)]">
              {t('display.avatar.shape_note')}
            </p>
          )}
        </div>
      </SettingsSection>
    </div>
  );
});

export default DisplayModeSection;
