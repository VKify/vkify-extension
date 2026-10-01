import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon24MusicNoteWaveOutline } from '@vkontakte/icons';
import {
  ArrowUpIcon, ClockIcon, DownloadIcon, EqualizerIcon, EyeIcon, FileTextIcon,
  LayoutIcon, LayoutRowsIcon, MusicIcon, SettingsIcon,
  SidebarIcon, SparklesIcon, SpeedometerIcon,
} from '../icons/Icons.js';
import {
  DashboardHero,
  DashboardHeroArtwork,
  DashboardListItem,
  DashboardPanel,
  DashboardSettingCard,
  SegmentedControl,
} from '../ui/DashboardPrimitives.js';
import IconButton from '../ui/IconButton.js';
import RangeSlider from '../ui/RangeSlider.js';
import ResetButton from '../ui/ResetButton.js';
import Toggle from '../ui/Toggle.js';
import { widgetIsVisible, widgetVisibilityPatch, withWidgetVisibility } from '@/shared/widget-visibility.js';
import { getStorage, setStorage, subscribeStorage } from '../../utils/storageClient.js';
import {
  STACK_KEY, WIDGET_CATALOG, isWidgetKey, orderedWidgets, parseStack, parseWidget,
  reorderWidgets, type StackSettings, type WidgetDefinition, widgetKey, widgetStorageKeys,
} from '@/shared/widget-stack.js';
import { MUSIC_OFFSET_STATE, withMusicPageOffset } from '@/shared/music-page-offset.js';
import './widgets-tab.css';

const keys = [STACK_KEY, ...WIDGET_CATALOG.flatMap(widgetStorageKeys), 'page_offset_enabled', 'page_offset_value', MUSIC_OFFSET_STATE];
const leftColumnIds = ['clock', 'equalizer', 'perf-widget', 'download-center'];
const rightColumnIds = ['music-mini-player', 'music_visualizer', 'music_lyrics'];
const icons: Record<string, React.ReactNode> = {
  clock: <ClockIcon className="h-5 w-5" />,
  equalizer: <EqualizerIcon className="h-5 w-5" />,
  'perf-widget': <SpeedometerIcon className="h-5 w-5" />,
  'download-center': <DownloadIcon className="h-5 w-5" />,
  'music-mini-player': <MusicIcon className="h-5 w-5" />,
  music_visualizer: <Icon24MusicNoteWaveOutline width={20} height={20} />,
  music_lyrics: <FileTextIcon className="h-5 w-5" />,
};

export default function WidgetsTab(): React.ReactElement {
  const { t } = useTranslation('settings');
  const label = (key: string): string => t(`widgets.${key}`);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [expandedWidget, setExpandedWidget] = useState<string | null>(null);
  const stackSection = useRef<HTMLElement>(null);

  useEffect(() => {
    let active = true;
    const changed = new Set<string>();
    const off = subscribeStorage([], allChanges => {
      const changes = Object.fromEntries(Object.entries(allChanges).filter(([key]) => keys.includes(key) || isWidgetKey(key)));
      if (!Object.keys(changes).length) return;
      for (const key of Object.keys(changes)) changed.add(key);
      setValues(current => ({ ...current, ...Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, value.newValue])) }));
    });
    void getStorage(null).then(data => {
      if (!active) return;
      setValues(current => ({ ...Object.fromEntries(Object.entries(data).filter(([key]) => (keys.includes(key) || isWidgetKey(key)) && !changed.has(key))), ...current }));
      setReady(true);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; off(); };
  }, []);

  const save = async (patch: Record<string, unknown>): Promise<void> => {
    try {
      const current = await getStorage(null);
      await setStorage(withMusicPageOffset(current, withWidgetVisibility(current, patch)));
      setError(false);
    } catch { setError(true); }
  };

  const catalog = useMemo(() => {
    const result: WidgetDefinition[] = [...WIDGET_CATALOG];
    for (const [key, value] of Object.entries(values)) {
      if (!key.startsWith('widgetDefinition:') || !value || typeof value !== 'object') continue;
      const id = key.slice('widgetDefinition:'.length);
      const title = (value as { title?: unknown }).title;
      if (!result.some(widget => widget.id === id) && typeof title === 'string') result.push({ id, feature: '', title });
    }
    return result;
  }, [values]);

  const config = parseStack(values[STACK_KEY]);
  const stack = (patch: Partial<StackSettings>): void => { void save({ [STACK_KEY]: { ...config, ...patch } }); };
  const ids = orderedWidgets(catalog.map(widget => widget.id).filter(id => parseWidget(values[widgetKey(id)]).mode === 'stacked'), values);
  const show = (id: string, feature: string, visible: boolean): void => {
    void getStorage(null).then(current => save(widgetVisibilityPatch(id, feature, visible, current)));
  };
  const reset = (id: string): Record<string, unknown> => ({
    [widgetKey(id)]: { ...parseWidget(values[widgetKey(id)]), position: null },
  });

  const byId = new Map(catalog.map(widget => [widget.id, widget]));
  const knownIds = new Set(WIDGET_CATALOG.map(widget => widget.id));
  const leftColumn = leftColumnIds.map(id => byId.get(id)).filter((widget): widget is WidgetDefinition => widget != null);
  const rightColumn = rightColumnIds.map(id => byId.get(id)).filter((widget): widget is WidgetDefinition => widget != null);
  catalog.filter(widget => !leftColumnIds.includes(widget.id) && !rightColumnIds.includes(widget.id))
    .forEach((widget, index) => (index % 2 === 0 ? leftColumn : rightColumn).push(widget));

  const renderWidget = (widget: WidgetDefinition): React.ReactElement => {
    const state = parseWidget(values[widgetKey(widget.id)]);
    const index = ids.indexOf(widget.id);
    const visible = widgetIsVisible(widget.id, widget.feature, values);
    const title = widget.title ?? label(widget.id);
    const description = knownIds.has(widget.id) ? label(`descriptions.${widget.id}`) : label(visible ? state.mode : 'hidden');
    const expanded = expandedWidget === widget.id;

    const expand = (): void => setExpandedWidget(current => current === widget.id ? null : widget.id);
    return <DashboardListItem key={widget.id} anchor={widgetKey(widget.id)} title={title} description={description}
      icon={icons[widget.id] ?? <LayoutIcon className="h-5 w-5" />} checked={visible} disabled={!ready}
      badge={widget.id === 'clock' ? label('popular') : undefined} expanded={expanded}
      onToggle={value => show(widget.id, widget.feature, value)} onExpand={expand}
      controlsLabel={`${title}: ${label('placement')}`}>
        <SegmentedControl label={`${title}: ${label('mode')}`} value={state.mode} options={[
          { value: 'free', label: label('free'), icon: <LayoutIcon className="h-4 w-4" /> },
          { value: 'stacked', label: label('stacked'), icon: <LayoutRowsIcon className="h-4 w-4" /> },
        ]} onChange={mode => void save({ [widgetKey(widget.id)]: { ...state, mode } })} />
        <div className="widgets-item__option-footer">
          {state.mode === 'stacked' && <div className="widgets-item__order">
            <span>{label('order')} <strong>{index + 1} / {ids.length}</strong></span>
            {[-1, 1].map(direction => <IconButton key={direction} title={label(direction < 0 ? 'up' : 'down')}
              disabled={!ids[index + direction]} className="rounded-lg hover:bg-[var(--bg-tertiary)]"
              onClick={() => void save(reorderWidgets(ids, widget.id, ids[index + direction], values))}>
              <ArrowUpIcon className={direction < 0 ? 'h-4 w-4' : 'h-4 w-4 rotate-180'} />
            </IconButton>)}
          </div>}
          <ResetButton label={label('reset')} aria-label={`${title}: ${label('reset')}`} onClick={() => void save(reset(widget.id))} />
        </div>
    </DashboardListItem>;
  };

  return <div className="widgets-page">
    {error && <p role="alert" className="widgets-error">{label('error')}</p>}
    <fieldset disabled={!ready} className="widgets-fieldset">
      <DashboardHero title={label('heroTitle')} subtitle={label('heroSubtitle')}
        description={label('heroDescription')}
        artwork={<DashboardHeroArtwork name="widgets" />}
        className="widgets-hero" />

      <DashboardPanel title={label('available')} description={label('intro')} icon={<LayoutIcon className="h-5 w-5" />}
        className="widgets-available" action={
          <div className="widgets-header-actions">
            <span className="widgets-count">{label('widgetCount')}</span>
            <button type="button" className="widgets-configure"
              onClick={() => stackSection.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              <SettingsIcon className="h-4 w-4" />{label('configureLayout')}
            </button>
          </div>
        }>
        <div className="widgets-grid">
          <div className="widgets-grid__column">{leftColumn.map(renderWidget)}</div>
          <div className="widgets-grid__column">{rightColumn.map(renderWidget)}</div>
        </div>
      </DashboardPanel>

      <DashboardPanel ref={stackSection} title={label('stack')} description={label('stackHint')}
        icon={<LayoutRowsIcon className="h-5 w-5" />} className="widgets-stack">
        <div className="widgets-stack__choices">
          <div className="widgets-stack__choice"><h4>{label('side')}</h4>
            <SegmentedControl label={label('side')} value={config.side} options={[
              { value: 'left', label: label('left'), icon: <SidebarIcon className="h-4 w-4" /> },
              { value: 'right', label: label('right'), icon: <SidebarIcon className="h-4 w-4 rotate-180" /> },
              { value: 'free', label: label('free'), icon: <LayoutIcon className="h-4 w-4" /> },
            ]} onChange={side => stack({ side })} />
          </div>
          <div className="widgets-stack__choice"><h4>{label('vertical')}</h4>
            <SegmentedControl label={label('vertical')} value={config.vertical}
              options={(['top', 'center', 'bottom'] as const).map(value => ({ value, label: label(value) }))}
              onChange={vertical => stack({ vertical, position: null })} />
          </div>
        </div>

        <div className="widgets-stack__toggles">
          <DashboardSettingCard icon={<LayoutRowsIcon className="h-5 w-5" />} title={label('collapsed')}
            description={label('collapsedHint')} control={<Toggle checked={config.collapsed} onChange={value => stack({ collapsed: value })} disabled={!ready} />} />
          <DashboardSettingCard icon={<SparklesIcon className="h-5 w-5" />} title={label('animation')}
            description={label('animationHint')} tone="primary"
            control={<Toggle checked={config.animation} onChange={value => stack({ animation: value })} disabled={!ready} />} />
        </div>
      </DashboardPanel>

      <DashboardPanel title={label('appearance')} description={label('appearanceHint')}
        icon={<SettingsIcon className="h-5 w-5" />} className="widgets-appearance"
        action={<ResetButton label={label('resetAll')} onClick={() => void save(Object.assign(
          { [STACK_KEY]: { ...config, position: null } }, ...catalog.map(widget => reset(widget.id)),
        ))} />}>
        <div className="widgets-appearance__grid">
          <DashboardSettingCard icon={<SidebarIcon className="h-5 w-5" />} tone="primary">
            <RangeSlider id="widget-stack-width" inline label={label('width')} value={config.width} min={240} max={600} step={10} unit=" px" onChange={width => stack({ width })} />
          </DashboardSettingCard>
          <DashboardSettingCard icon={<EyeIcon className="h-5 w-5" />} tone="primary">
            <RangeSlider id="widget-stack-opacity" inline label={label('opacity')} value={Math.round(config.opacity * 100)} min={40} max={100} step={5} unit="%" onChange={opacity => stack({ opacity: opacity / 100 })} />
          </DashboardSettingCard>
          <DashboardSettingCard icon={<LayoutRowsIcon className="h-5 w-5" />} tone="primary">
            <RangeSlider id="widget-stack-gap" inline label={label('gap')} value={config.gap} min={0} max={80} step={2} unit=" px" onChange={gap => stack({ gap })} />
          </DashboardSettingCard>
        </div>
      </DashboardPanel>
    </fieldset>
  </div>;
}
