import React, { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '../../ui/SettingRow.js';
import SettingsSection from '../../ui/SettingsSection.js';
import RangeSlider from '../../ui/RangeSlider.js';
import NestedSettings from '../../ui/NestedSettings.js';
import {
  SidebarIcon, SearchIcon, LayoutRowsIcon, LayoutIcon, SparklesIcon,
  WidthIcon, MoveHorizontalIcon, RadiusIcon,
} from '../../icons/Icons.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { useDebouncedCallback } from '@/popup/hooks/core/useDebouncedCallback.js';
import { previewFeatureValue } from '@/popup/utils/livePreview.js';
import { DISPLAY_MODES, type DisplayMode } from '@/popup/constants/appearance.js';
import { isEmbedded, getEmbedParentOrigin } from '@/popup/utils/embedViewport.js';

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
    // A reset can disable the feature while a slider write is still pending.
    if (useVKifyStore.getState().settings[featureId] !== true) return;
    void saveSetting(settingKey, v);
  }, 250);

  const onChange = (v: number): void => {
    setLocal(v);
    previewFeatureValue(featureId, v); // мгновенно на страницу VK
    commit(v);                         // дебаунснутый коммит в storage
  };

  return [local, onChange];
}

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
 * content/features/appearance/theme/border-radius.ts и enum'ом в settings-schema.ts.
 * radius здесь — только для превью в попапе.
 */
// id формы аватарки → ключ в appearance.display.avatar.shapes; '' — «своё».
const AVATAR_SHAPES: { id: string; shapeKey: string; radius: string }[] = [
  { id: '',      shapeKey: 'custom', radius: '' },
  { id: 'drop',  shapeKey: 'drop',   radius: '0 50% 50% 50%' },
  { id: 'leaf',  shapeKey: 'leaf',   radius: '0 50% 0 50%' },
  { id: 'petal', shapeKey: 'petal',  radius: '50% 0 50% 0' },
  { id: 'blob',  shapeKey: 'blob',   radius: '30% 70% 70% 30% / 30% 30% 70% 70%' },
  { id: 'arch',   shapeKey: 'arch',   radius: '50% 50% 12% 12%' },
  { id: 'shield', shapeKey: 'shield', radius: '12% 12% 50% 50% / 12% 12% 85% 85%' },
  { id: 'egg',    shapeKey: 'egg',    radius: '50% 50% 45% 45% / 65% 65% 35% 35%' },
  { id: 'pebble', shapeKey: 'pebble', radius: '65% 35% 45% 55% / 55% 45% 35% 65%' },
  { id: 'pillow',   shapeKey: 'pillow',   radius: '35% / 25%' },
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
    />
  );
}

const DisplayModeSection = memo(function DisplayModeSection(): React.ReactElement {
  const { t } = useTranslation('appearance');
  const settings = useVKifyStore((s) => s.settings);
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  const embedded = isEmbedded();
  const editorButton = useRef<HTMLButtonElement | null>(null);
  const editOnPage = (target: 'content_width' | 'page_offset_value', button: HTMLButtonElement): void => {
    editorButton.current = button;
    window.parent.postMessage({ type: 'VKIFY_LAYOUT_EDIT', target }, getEmbedParentOrigin());
  };
  useEffect(() => {
    if (!embedded) return;
    const close = (): void => window.parent.postMessage({ type: 'VKIFY_LAYOUT_EDIT_CLOSE' }, getEmbedParentOrigin());
    const key = (event: KeyboardEvent): void => { if (event.key === 'Escape') close(); };
    const message = (event: MessageEvent): void => {
      if (event.source !== window.parent || event.origin !== getEmbedParentOrigin()) return;
      if (event.data?.type === 'VKIFY_LAYOUT_EDIT_STATE' && event.data.active === false && editorButton.current?.isConnected) {
        editorButton.current.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', key);
    window.addEventListener('message', message);
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('message', message); close(); };
  }, [embedded]);

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
  const shape = (settings['avatar_radius_shape'] as string | undefined) ?? '';
  // 50% — нативный вид VK (аватарки изначально круглые), поэтому это дефолт
  const percent = (settings['border_radius'] as number | undefined) ?? 50;

  return (
    <div className="space-y-4">
      {/* Макет — боковое меню, ширина и смещение страницы */}
      <SettingsSection title={t('display.layout.section')} description={t('display.layout.section_desc')}
        icon={<LayoutIcon className="w-5 h-5" />}>
        {LAYOUT_MODE_IDS.map((id) => (
          <ModeRow key={id} id={id} />
        ))}

        {/* Ширина контента */}
        <SettingRow
          id="content_width_enabled"
          title={t('display.width.title')}
          description={t('display.width.desc')}
          icon={<WidthIcon className="w-5 h-5" />}
        />
        <NestedSettings open={widthEnabled}>
          <div className="px-4 py-3">
            {embedded ? (
              <button type="button" onClick={(event) => editOnPage('content_width', event.currentTarget)}
                className="rounded-xl bg-primary/10 px-3 py-2 text-xs text-primary hover:bg-primary/20">
                {t('display.layout.edit_width')}
              </button>
            ) : <RangeSlider
              id="content_width"
              label={t('display.width.slider')}
              value={widthValue}
              min={900}
              max={2500}
              step={50}
              unit="px"
              onChange={onWidthChange}
            />}
          </div>
        </NestedSettings>

        {/* Смещение страницы */}
        <SettingRow
          id="page_offset_enabled"
          title={t('display.offset.title')}
          description={t('display.offset.desc')}
          icon={<MoveHorizontalIcon className="w-5 h-5" />}
        />
        <NestedSettings open={offsetEnabled}>
          <div className="px-4 py-3">
            {embedded ? (
              <button type="button" onClick={(event) => editOnPage('page_offset_value', event.currentTarget)}
                className="rounded-xl bg-primary/10 px-3 py-2 text-xs text-primary hover:bg-primary/20">
                {t('display.layout.edit_offset')}
              </button>
            ) : <RangeSlider id="page_offset_value" inline label={t('display.offset.position')}
              value={offsetValue} valueLabel={dirLabel} min={0} max={100} step={1}
              minLabel={t('display.offset.left')} maxLabel={t('display.offset.right')}
              onChange={onOffsetChange} />}
          </div>
        </NestedSettings>
      </SettingsSection>

      {/* Поиск */}
      <SettingsSection
        title={t('display.search.section')}
        description={t('display.search.section_desc')}
        icon={<SearchIcon className="w-5 h-5" />}
      >
        {SEARCH_MODE_IDS.map((id) => <ModeRow key={id} id={id} />)}
      </SettingsSection>

      {/* Внешний вид */}
      <SettingsSection
        title={t('display.look.section')}
        description={t('display.look.section_desc')}
        icon={<SparklesIcon className="w-5 h-5" />}
      >
        {APPEARANCE_MODE_IDS.map((id) => <ModeRow key={id} id={id} />)}

        {/* Скругление аватарок — сегментированный выбор формы */}
        <div className="p-4 border-t border-[var(--dashboard-panel-border)]">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="dashboard-icon dashboard-icon--small dashboard-icon--primary">
              <RadiusIcon className="w-4 h-4 text-primary" />
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
                      ? 'bg-[var(--bg-primary)] ring-1 ring-inset ring-primary/30'
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
