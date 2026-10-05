import { Select } from '@/popup/components/ui/FormControls.js';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVKifyStore } from '@/popup/store/index.js';
import Toggle from '@/popup/components/ui/Toggle.js';
import RangeSlider from '@/popup/components/ui/RangeSlider.js';
import ColorPickerField from '@/popup/components/ui/ColorPickerField.js';
import { DashboardPanel, SegmentedControl } from '@/popup/components/ui/DashboardPrimitives.js';
import { ClockIcon, LayoutIcon, CalendarIcon, PaletteIcon, SparklesIcon, CheckIcon, TypeIcon } from '@/popup/components/icons/Icons.js';
import { sendMessage } from '@/shared/messaging.js';
import { CLOCK_DEFAULTS, parseClockSettings } from '@/shared/clock/settings.js';
import { CLOCK_APPEARANCE_DEFAULTS, CLOCK_PRESETS } from '@/shared/clock/presets.js';
import { clockStyle } from '@/shared/clock/style.js';
import type { ClockSettings } from '@/shared/clock/types.js';
import ClockPreview from './ClockPreview.js';
import './clock-section.css';

const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;

export default function ClockSection(): React.ReactElement {
  const { t, i18n } = useTranslation('appearance');
  const label = (key: string) => t(`clock.${key}`);
  const settings = useVKifyStore(s => s.settings);
  const saveMultiple = useVKifyStore(s => s.saveMultiple);
  const value = parseClockSettings(settings.clock_settings);
  const enabled = settings.clock_enabled === true;
  const [notice, setNotice] = useState('');
  const update = (patch: Partial<ClockSettings>): void => {
    const current = parseClockSettings(useVKifyStore.getState().settings.clock_settings);
    void saveMultiple({ clock_settings: JSON.stringify({ ...current, ...patch }) });
  };
  const slider = (key: 'fontSize' | 'opacity' | 'backgroundOpacity' | 'radius' | 'fontWeight' | 'margin' | 'letterSpacing' | 'padding' | 'gradientAngle' | 'borderWidth' | 'shadow' | 'glow' | 'blur' | 'dateSize', min: number, max: number, step = 1, unit = '') =>
    <RangeSlider id={`clock-${key}`} label={label(key)} value={value[key]} min={min} max={max} step={step} unit={unit} inline onChange={next => update({ [key]: next })} />;
  const toggle = (key: 'hour12' | 'seconds' | 'showDate' | 'showBackground' | 'glass' | 'gradient') =>
    <div className="clock-settings__row">
      <span className="text-xs font-medium text-[var(--text-primary)]">{label(key)}</span>
      <Toggle ariaLabel={label(key)} checked={value[key]} onChange={next => update({ [key]: next })} />
    </div>;
  const colorField = (key: 'color' | 'background' | 'backgroundSecondary' | 'borderColor') =>
    <div className="clock-settings__row"><span className="text-xs text-[var(--text-secondary)]">{label(key)}</span><ColorPickerField value={value[key]} ariaLabel={label(key)} onInput={color => update({ [key]: color })} onChange={color => update({ [key]: color })} /></div>;

  return <div className="clock-settings space-y-4 pb-4">
    <DashboardPanel title={label('heroTitle')} description={label('heroDescription')} icon={<ClockIcon className="h-5 w-5" />}
      action={<Toggle ariaLabel={label('title')} checked={enabled} onChange={next => void saveMultiple({ clock_enabled: next })} />}>
      <div className="px-4 pb-4 space-y-3">
        <div className="clock-settings__preview">
          <div className="clock-settings__preview-caption">
            <span>{label('preview')}</span>
            <span className={`clock-settings__status${enabled ? ' is-enabled' : ''}`}><span aria-hidden="true" />{label(enabled ? 'enabledHint' : 'disabledHint')}</span>
          </div>
          <div className="clock-settings__preview-stage"><ClockPreview settings={value} locale={i18n.language} /></div>
        </div>
        <div className="space-y-2">
          <span className="text-xs font-medium text-[var(--text-secondary)]">{label('output')}</span>
          <SegmentedControl label={label('output')} value={value.output} options={[
            { value: 'overlay', label: label('overlay'), icon: <LayoutIcon className="h-4 w-4" /> },
            { value: 'widget', label: label('widget'), icon: <ClockIcon className="h-4 w-4" /> },
          ]} onChange={output => { update({ output }); setNotice(''); }} />
        </div>
        {value.output === 'widget' && <p className="text-xs text-[var(--text-secondary)]">{label('widgetHint')}</p>}
      </div>
    </DashboardPanel>

    <DashboardPanel title={label('presets')} description={label('presetsHint')} icon={<SparklesIcon className="h-5 w-5" />}>
      <div className="clock-settings__presets px-4 pb-4">
        {Object.entries(CLOCK_PRESETS).map(([id, preset]) => {
          const active = Object.entries(preset).every(([key, setting]) => value[key as keyof ClockSettings] === setting);
          return <button type="button" key={id} aria-pressed={active} onClick={() => update(preset)}
            className="clock-settings__preset">
            <span className="clock-settings__preset-preview">
              <span style={{ ...clockStyle({ ...CLOCK_DEFAULTS, ...preset }), fontSize: 18, padding: '7px 9px', maxWidth: '100%' }}>23:48</span>
            </span>
            <span className="mt-3 flex items-center justify-between gap-1 text-xs font-semibold text-[var(--text-primary)]">{label(id)}{active && <CheckIcon className="h-3.5 w-3.5 shrink-0 text-primary" />}</span>
            <span className="mt-1 block text-[10px] leading-relaxed text-[var(--text-secondary)]">{label(`${id}Description`)}</span>
          </button>;
        })}
      </div>
    </DashboardPanel>

    <DashboardPanel title={label('format')} icon={<CalendarIcon className="h-5 w-5" />}>
      <div className="px-4 pb-4">
      <div className="clock-settings__rows">{toggle('hour12')}{toggle('seconds')}{toggle('showDate')}</div>
      {value.showDate && <label className="mt-3 block text-xs text-[var(--text-secondary)]">{label('dateFormat')}
        <Select icon={<CalendarIcon />} value={value.dateFormat} onChange={event => update({ dateFormat: event.target.value as ClockSettings['dateFormat'] })}
          className="mt-2 block w-full">
          <option value="short">{label('shortDate')}</option><option value="long">{label('longDate')}</option>
        </Select>
      </label>}
      {value.showDate && <div className="mt-3 space-y-3">
        <span className="text-xs text-[var(--text-secondary)]">{label('dateLayout')}</span>
        <SegmentedControl label={label('dateLayout')} value={value.dateLayout} options={[
          { value: 'inline', label: label('dateInline') }, { value: 'above', label: label('dateAbove') }, { value: 'below', label: label('dateBelow') },
        ]} onChange={dateLayout => update({ dateLayout })} />
        {value.dateLayout !== 'inline' && slider('dateSize', 25, 80, 1, '%')}
      </div>}
      </div>
    </DashboardPanel>

    <DashboardPanel title={label('appearance')} icon={<PaletteIcon className="h-5 w-5" />}>
      <div className="px-4 pb-4 space-y-3">
      <div className="clock-settings__group space-y-4">
      <div className="flex items-center gap-2 text-[var(--text-secondary)]"><TypeIcon className="h-4 w-4" /><span className="text-xs font-semibold">{label('text')}</span></div>
      <label className="block text-xs text-[var(--text-secondary)]">{label('fontFamily')}
        <Select icon={<TypeIcon />} value={value.fontFamily} onChange={event => update({ fontFamily: event.target.value as ClockSettings['fontFamily'] })} className="mt-2 block w-full">
          {(['system', 'mono', 'serif', 'rounded'] as const).map(font => <option key={font} value={font}>{label(`font_${font}`)}</option>)}
        </Select>
      </label>
      {slider('fontSize', 12, 96, 1, 'px')}{slider('fontWeight', 300, 900, 100)}
      {slider('letterSpacing', -2, 8, 0.5, 'px')}
      {slider('opacity', 10, 100, 1, '%')}
      {colorField('color')}
      </div>
      <div className="clock-settings__group space-y-4">
      {toggle('showBackground')}
      {value.showBackground && <>
        {colorField('background')}{toggle('gradient')}
        {value.gradient && <>{colorField('backgroundSecondary')}{slider('gradientAngle', 0, 360, 15, '°')}</>}
        {slider('backgroundOpacity', 0, 100, 1, '%')}{toggle('glass')}
        {value.glass && slider('blur', 0, 32, 1, 'px')}
      </>}
      {slider('radius', 0, 48, 1, 'px')}{slider('padding', 0, 32, 1, 'px')}
      </div>
      <div className="clock-settings__group space-y-4">
      <div className="flex items-center gap-2 text-[var(--text-secondary)]"><SparklesIcon className="h-4 w-4" /><span className="text-xs font-semibold">{label('effects')}</span></div>
      {slider('borderWidth', 0, 6, 1, 'px')}
      {value.borderWidth > 0 && colorField('borderColor')}
      {slider('shadow', 0, 40, 1, 'px')}{slider('glow', 0, 32, 1, 'px')}
      </div>
      <button type="button" className="clock-settings__edit" onClick={() => update(CLOCK_APPEARANCE_DEFAULTS)}>{label('resetAppearance')}</button>
      </div>
    </DashboardPanel>

    {value.output === 'overlay' && <DashboardPanel title={label('position')} description={label('positionHint')} icon={<LayoutIcon className="h-5 w-5" />}>
      <div className="px-4 pb-4 space-y-4">
      <div className="clock-settings__positions" role="group" aria-label={label('position')}>
        {positions.map(position => <button key={position} type="button" aria-pressed={value.position === position} className="clock-settings__position" onClick={() => update({ position })}>
          <span className={`clock-settings__position-map is-${position}`} aria-hidden="true"><span /></span>
          <span>{label(position)}</span>
        </button>)}
      </div>
      {value.position === 'custom' && <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">{label('custom')}</p>}
      {slider('margin', 0, 120, 1, 'px')}
      <button type="button" disabled={!enabled} className="clock-settings__edit" onClick={() => { void sendMessage({ type: 'CLOCK_EDIT' }).then(result => setNotice(result?.success ? 'editing' : 'openVk'), () => setNotice('openVk')); }}>{label('editPage')}</button>
      {notice && <p role="status" className="text-xs leading-relaxed text-[var(--text-secondary)]">{label(notice)}</p>}
      </div>
    </DashboardPanel>}

  </div>;
}
