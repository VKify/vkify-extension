import React, { useState } from 'react';
import { useSettings } from '../../context/SettingsContext.js';
import RangeSlider from '../ui/RangeSlider.js';
import ColorPicker from '../ui/ColorPicker.js';
import { XIcon, MoveHorizontalIcon, DropletIcon, ShareIcon, WidthIcon, RadiusIcon, ChevronDownIcon } from '../icons/Icons.js';

import SettingRow from '../ui/SettingRow.js';
import DisplayModeSection from './appearanceSections/DisplayModeSection.js';
import ThemeSection from './appearanceSections/ThemeSection.js';
import FontSection from './appearanceSections/FontSection.js';
import VisualFiltersSection from './appearanceSections/VisualFiltersSection.js';
import BackgroundSection from './appearanceSections/BackgroundSection.js';
import ShareButton from './appearanceSections/ShareSection.js';

import { useVKTheme } from '../../hooks/features/useVKTheme.js';

interface SliderSectionProps {
  icon: React.ReactNode;
  iconBg?: string;
  title: string;
  sliderId: string;
  sliderLabel: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
  zeroLabel?: string;
}

function SliderSection({ icon, iconBg = 'bg-[var(--bg-secondary)]', title, sliderId, sliderLabel, value, onChange, ...sliderProps }: SliderSectionProps): React.ReactElement {
  return (
    <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card p-4">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
        <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
      </div>
      <RangeSlider
        id={sliderId}
        label={sliderLabel}
        value={value}
        onChange={onChange}
        {...sliderProps}
      />
    </section>
  );
}

function ContentWidthSection(): React.ReactElement {
  const { settings, saveSetting } = useSettings();

  const enabled = settings['content_width_enabled'] === true;
  const value   = (settings['content_width'] as number | undefined) ?? 1100;

  return (
    <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
          <WidthIcon className="w-5 h-5 text-indigo-500" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Ширина контента</h3>
          {enabled && (
            <span className="flex items-center gap-1 mt-0.5 text-xs font-medium text-indigo-500">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
              {value}px
            </span>
          )}
        </div>
      </div>

      <SettingRow
        id="content_width_enabled"
        title="Расширить контент"
        description="Увеличить ширину профиля, ленты и сообщений до нужного значения"
        icon={<WidthIcon className="w-5 h-5" />}
        iconColor="purple"
      />

      {enabled && (
        <div className="px-4 pb-4 pt-2">
          <RangeSlider
            id="content_width"
            label="Ширина"
            value={value}
            min={900}
            max={2500}
            step={50}
            unit="px"
            onChange={(v) => { void saveSetting('content_width', v); }}
          />
        </div>
      )}
    </section>
  );
}

function PageOffsetSection(): React.ReactElement {
  const { settings, saveSetting } = useSettings();

  const enabled = settings['page_offset_enabled'] === true;
  const value   = (settings['page_offset_value'] as number | undefined) ?? 50;

  // Human-readable label: "← 240px" / "Центр" / "240px →"
  const MAX_OFFSET = 600;
  const px = Math.round(((value - 50) / 50) * MAX_OFFSET);
  const dirLabel = value === 50
    ? 'Центр'
    : value < 50
      ? `← ${Math.abs(px)}px`
      : `${px}px →`;

  const pct = ((value - 0) / 100) * 100; // for slider fill

  return (
    <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center flex-shrink-0">
          <MoveHorizontalIcon className="w-5 h-5 text-sky-500" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Смещение страницы</h3>
          {enabled && (
            <span className="flex items-center gap-1 mt-0.5 text-xs font-medium text-blue-500">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
              Активно
            </span>
          )}
        </div>
      </div>

      <SettingRow
        id="page_offset_enabled"
        title="Смещение страницы"
        description="Сдвигает контент VK влево или вправо — удобно на широких мониторах"
        icon={<MoveHorizontalIcon className="w-5 h-5" />}
        iconColor="blue"
      />

      {enabled && (
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
            value={value}
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
    </section>
  );
}

function AccentColorSection(): React.ReactElement {
  const { settings, saveSetting } = useSettings();
  const { currentPreset } = useVKTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const hasCustomAccent = Boolean(settings['custom_accent']);
  const showThemeHint =
    currentPreset?.id !== 'default' &&
    currentPreset?.accent &&
    settings['custom_accent'] !== currentPreset?.accent;

  return (
    <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
      <button
        onClick={() => setIsExpanded(prev => !prev)}
        aria-expanded={isExpanded}
        className="group w-full flex items-center justify-between p-4 hover:bg-[var(--bg-secondary)]/50 transition-all duration-200"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center flex-shrink-0">
            <DropletIcon className="w-5 h-5 text-pink-500" />
          </div>
          <div className="text-left">
            <span className="text-base font-semibold text-[var(--text-primary)] block">Акцентный цвет</span>
            {hasCustomAccent && (
              <span className="flex items-center gap-1 mt-0.5 text-xs font-medium" style={{ color: settings['custom_accent'] as string }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: settings['custom_accent'] as string }} />
                {(settings['custom_accent'] as string)?.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasCustomAccent && (
            <button
              onClick={(e) => { e.stopPropagation(); void saveSetting('custom_accent', ''); }}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-[var(--text-secondary)] hover:text-error bg-[var(--bg-secondary)] hover:bg-error/10 rounded-lg transition-colors"
              aria-label="Сбросить акцентный цвет"
            >
              <XIcon className="w-3 h-3" />
              Сбросить
            </button>
          )}
          <div className={`w-8 h-8 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center transition-all duration-300 group-hover:bg-[var(--bg-tertiary)] ${isExpanded ? 'rotate-180 bg-primary/10' : ''}`}>
            <ChevronDownIcon className={`w-4 h-4 transition-colors duration-200 ${isExpanded ? 'text-primary' : 'text-[var(--text-tertiary)]'}`} />
          </div>
        </div>
      </button>

      <div className={`grid transition-all duration-300 ease-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="px-4 pb-4">
            <ColorPicker
              value={(settings['custom_accent'] as string | undefined) ?? ''}
              onChange={(color) => { void saveSetting('custom_accent', color); }}
            />

            {showThemeHint && currentPreset && (
              <div className="mt-3 flex items-start gap-2 p-2 rounded-lg bg-[var(--bg-secondary)]">
                <span className="text-xs" aria-hidden="true">💡</span>
                <p className="text-xs text-[var(--text-secondary)]">
                  Рекомендуемый акцент для {currentPreset.name}:
                  <button
                    onClick={() => { void saveSetting('custom_accent', currentPreset.accent); }}
                    className="ml-1 inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-white/50"
                      style={{ backgroundColor: currentPreset.accent }}
                      aria-hidden="true"
                    />
                    {currentPreset.accent}
                  </button>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function AppearanceTab(): React.ReactElement {
  const { settings, saveSetting } = useSettings();

  return (
    <div className="space-y-4">
      <div data-vkify-anchor="display_mode"><DisplayModeSection /></div>

      <ContentWidthSection />

      <PageOffsetSection />

      <div data-vkify-anchor="custom_theme"><ThemeSection /></div>

      <AccentColorSection />

      <div data-vkify-anchor="custom_font"><FontSection /></div>

      <SliderSection
        icon={<RadiusIcon className="w-5 h-5 text-cyan-500" />}
        iconBg="bg-cyan-500/10"
        title="Скругление элементов"
        sliderId="border_radius"
        sliderLabel="Скругление"
        value={(settings['border_radius'] as number | undefined) ?? 0}
        min={0}
        max={24}
        step={2}
        unit="px"
        zeroLabel="По умолчанию"
        onChange={(value) => { void saveSetting('border_radius', value); }}
      />

      <div data-vkify-anchor="visual_filters"><VisualFiltersSection /></div>

      <div data-vkify-anchor="custom_background"><BackgroundSection /></div>

      <section data-vkify-anchor="share_theme" className="bg-[var(--bg-primary)] rounded-2xl shadow-card p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <ShareIcon className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Поделиться темой</h3>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mb-3">
          Сгенерируйте ссылку с вашей текущей темой и отправьте другу.
        </p>
        <ShareButton />
      </section>
    </div>
  );
}