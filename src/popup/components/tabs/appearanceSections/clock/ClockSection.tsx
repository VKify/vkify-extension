import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVKifyStore } from '@/popup/store/index.js';
import Toggle from '@/popup/components/ui/Toggle.js';
import RangeSlider from '@/popup/components/ui/RangeSlider.js';
import ColorPickerField from '@/popup/components/ui/ColorPickerField.js';
import { ClockIcon } from '@/popup/components/icons/Icons.js';
import { sendMessage } from '@/shared/messaging.js';
import { CLOCK_DEFAULTS, CLOCK_PRESETS, parseClockSettings } from '@/shared/clock/settings.js';
import { clockStyle } from '@/shared/clock/style.js';
import type { ClockSettings } from '@/shared/clock/types.js';
import ClockPreview from './ClockPreview.js';

const card = 'rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)]';
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
  const slider = (key: 'fontSize' | 'opacity' | 'backgroundOpacity' | 'radius' | 'fontWeight' | 'margin', min: number, max: number, step = 1, unit = '') =>
    <RangeSlider id={`clock-${key}`} label={label(key)} value={value[key]} min={min} max={max} step={step} unit={unit} inline onChange={next => update({ [key]: next })} />;
  const select = (caption: string, selected: string, options: Record<string, string>, onChange: (next: string) => void): React.ReactElement =>
    <label className="block text-xs text-[var(--text-secondary)]">{caption}
      <select value={selected} onChange={event => onChange(event.target.value)}
        className="block w-full mt-2 px-3 py-2.5 rounded-xl bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-primary/40">
        {Object.entries(options).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
    </label>;

  return <div className="space-y-4">
    <section className={`${card} overflow-hidden`}>
      <div className="flex items-center justify-between gap-4 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0 rounded-xl bg-primary/10 p-2.5 text-primary"><ClockIcon className="h-5 w-5" /></div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{label('heroTitle')}</h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">{label('heroDescription')}</p>
          </div>
        </div>
        <div className="shrink-0 [&>label>span]:sr-only"><Toggle label={label('title')} checked={enabled} onChange={next => void saveMultiple({ clock_enabled: next })} /></div>
      </div>
      <div className="relative flex h-52 items-center justify-center overflow-hidden bg-[#0b0e19] px-5 py-12"
        style={{ backgroundImage: 'radial-gradient(ellipse at 25% 100%, #1e2544 0%, transparent 70%)' }}>
        <div className="absolute left-4 top-3 z-10 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          <span className="h-1 w-1 rounded-full bg-cyan-300" />{label('preview')}
        </div>
        <ClockPreview settings={value} locale={i18n.language} className="relative z-[1]" />
      </div>
      <p className="px-4 py-3 text-xs leading-relaxed text-[var(--text-secondary)]">{label(enabled ? 'enabledHint' : 'disabledHint')}</p>
      <div className="px-4 pb-4 space-y-2">
        {select(label('output'), value.output, { overlay: label('overlay'), widget: label('widget') }, output => update({ output: output as ClockSettings['output'] }))}
        {value.output === 'widget' && <p className="text-xs text-[var(--text-secondary)]">{label('widgetHint')}</p>}
          <button type="button" disabled={!enabled || value.output === 'widget'} className="rounded-xl bg-primary/10 px-3 py-2 text-xs text-primary hover:bg-primary/20 disabled:opacity-40"
            onClick={() => { void sendMessage({ type: 'CLOCK_EDIT' }).then(result => setNotice(result?.success ? 'editing' : 'openVk'), () => setNotice('openVk')); }}>
            {label('editPage')}
          </button>
        {notice && <p role="status" className="text-xs text-[var(--text-secondary)]">{label(notice)}</p>}
      </div>
    </section>

    <section className={`${card} p-4 space-y-3`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{label('presets')}</h3>
        <span className="text-[10px] text-[var(--text-tertiary)]">{label('presetsHint')}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {Object.entries(CLOCK_PRESETS).map(([id, preset]) => {
          const active = Object.entries(preset).every(([key, setting]) => value[key as keyof ClockSettings] === setting);
          return <button type="button" key={id} aria-pressed={active} onClick={() => update(preset)}
            className={`p-3 text-left rounded-xl border transition-colors focus-visible:ring-2 focus-visible:ring-primary ${active ? 'border-primary bg-primary/10' : 'border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-primary/50'}`}>
            <span className="flex h-14 items-center justify-center rounded-lg bg-[#101421] px-2">
              <span style={{ ...clockStyle({ ...CLOCK_DEFAULTS, ...preset }), fontSize: 13, padding: '5px 8px' }}>23:48</span>
            </span>
            <span className="mt-3 block text-xs font-semibold text-[var(--text-primary)]">{label(id)}</span>
            <span className="mt-1 block text-[10px] leading-relaxed text-[var(--text-secondary)]">{label(`${id}Description`)}</span>
          </button>;
        })}
      </div>
    </section>

    <section className={`${card} p-4 space-y-4`}>
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{label('format')}</h3>
      <Toggle label={label('hour12')} checked={value.hour12} onChange={hour12 => update({ hour12 })} />
      <Toggle label={label('seconds')} checked={value.seconds} onChange={seconds => update({ seconds })} />
      <Toggle label={label('showDate')} checked={value.showDate} onChange={showDate => update({ showDate })} />
      {value.showDate && <label className="block text-xs text-[var(--text-secondary)]">{label('dateFormat')}
        <select value={value.dateFormat} onChange={event => update({ dateFormat: event.target.value as ClockSettings['dateFormat'] })}
          className="mt-2 block w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2.5 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary/40">
          <option value="short">{label('shortDate')}</option><option value="long">{label('longDate')}</option>
        </select>
      </label>}
    </section>

    <section className={`${card} p-4 space-y-5`}>
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{label('appearance')}</h3>
      {slider('fontSize', 12, 96, 1, 'px')}{slider('fontWeight', 300, 900, 100)}
      {slider('opacity', 10, 100, 1, '%')}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-[var(--text-secondary)]">{label('color')}<div className="mt-2"><ColorPickerField value={value.color} ariaLabel={label('color')} onInput={color => update({ color })} onChange={color => update({ color })} /></div></label>
        {value.showBackground && <label className="text-xs text-[var(--text-secondary)]">{label('background')}<div className="mt-2"><ColorPickerField value={value.background} ariaLabel={label('background')} onInput={background => update({ background })} onChange={background => update({ background })} /></div></label>}
      </div>
      <Toggle label={label('showBackground')} checked={value.showBackground} onChange={showBackground => update({ showBackground })} />
      {value.showBackground && <>{slider('backgroundOpacity', 0, 100, 1, '%')}{slider('radius', 0, 48, 1, 'px')}
        <Toggle label={label('glass')} checked={value.glass} onChange={glass => update({ glass })} /></>}
    </section>

    {value.output === 'overlay' && <section className={`${card} p-4 space-y-5`}>
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{label('position')}</h3>
      {select(label('position'), value.position, { ...Object.fromEntries(positions.map(position => [position, label(position)])), custom: label('custom') }, position => update({ position: position as ClockSettings['position'] }))}
      {value.position === 'custom' && <p className="text-xs text-primary">{label('custom')}</p>}
      {slider('margin', 0, 120, 1, 'px')}
      <p className="text-[11px] leading-relaxed text-[var(--text-tertiary)]">{label('positionHint')}</p>
    </section>}

    <details className={`${card} group`}>
      <summary className="cursor-pointer p-4 text-sm font-semibold text-[var(--text-primary)]">{label('resetSection')}</summary>
      <div className="px-4 pb-4"><p className="mb-3 text-xs leading-relaxed text-[var(--text-secondary)]">{label('resetDescription')}</p>
        <button type="button" className="rounded-xl border border-[var(--border-color)] px-3 py-2 text-xs text-[var(--text-secondary)] hover:border-primary/50 hover:text-primary" onClick={() => update(CLOCK_DEFAULTS)}>{label('reset')}</button></div>
    </details>
  </div>;
}
