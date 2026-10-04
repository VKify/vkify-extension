import React from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardPanel, SegmentedControl } from '@/popup/components/ui/DashboardPrimitives.js';
import Toggle from '@/popup/components/ui/Toggle.js';
import { PlayIcon, LayoutIcon, WidgetsIcon, ChevronDownIcon } from '@/popup/components/icons/Icons.js';
import type { VisualizerSettings } from '@/shared/music-visualizer.js';
import './music-appearance.css';

export function MusicSettingsPanel({ title, description, icon, children }: {
  title: string; description?: string; icon: React.ReactNode; children: React.ReactNode;
}): React.ReactElement {
  return <DashboardPanel title={title} description={description} icon={icon}>
    <div className="music-appearance__body">{children}</div>
  </DashboardPanel>;
}

export function MusicToggleRow({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (checked: boolean) => void;
}): React.ReactElement {
  return <div className="music-appearance__toggle">
    <span>{label}</span><Toggle ariaLabel={label} checked={checked} onChange={onChange} />
  </div>;
}

export function MusicDisclosure({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return <details className="dashboard-panel music-appearance__disclosure">
    <summary><span>{title}</span><ChevronDownIcon className="h-4 w-4" /></summary>
    <div className="music-appearance__body">{children}</div>
  </details>;
}

export function MusicPreviewPanel({ title, description, icon, enabled, enableLabel, enableAnchor, onEnable,
  animated, onAnimate, output, onOutput, dragHint, children, footer }: {
  title: string; description: string; icon: React.ReactNode; enabled: boolean; enableLabel: string;
  enableAnchor: string; onEnable: (value: boolean) => void; animated: boolean; onAnimate: () => void;
  output: VisualizerSettings['output']; onOutput: (value: VisualizerSettings['output']) => void;
  dragHint: string; children: React.ReactNode; footer: React.ReactNode;
}): React.ReactElement {
  const { t } = useTranslation('center');
  return <DashboardPanel title={title} description={description} icon={icon} className="music-appearance__hero"
    action={<span data-vkify-anchor={enableAnchor}><Toggle ariaLabel={enableLabel} checked={enabled} onChange={onEnable} /></span>}>
    <div className="music-appearance__body">
      <div className="music-appearance__preview">
        <div className="music-appearance__preview-caption">
          <span>{t('music.visualizer.demo')}</span>
          <button type="button" aria-pressed={animated} onClick={onAnimate}>
            <PlayIcon className="h-3.5 w-3.5" />{t(animated ? 'music.visualizer.stop' : 'music.visualizer.animate')}
          </button>
        </div>
        <div className="music-appearance__stage">{children}<p>{dragHint}</p></div>
      </div>
      <div className="space-y-2">
        <span className="text-xs font-medium text-[var(--text-secondary)]">{t('music.visualizer.output')}</span>
        <SegmentedControl label={t('music.visualizer.output')} value={output} onChange={onOutput} options={[
          { value: 'overlay', label: t('music.visualizer.output_overlay'), icon: <LayoutIcon className="h-4 w-4" /> },
          { value: 'widget', label: t('music.visualizer.output_widget'), icon: <WidgetsIcon className="h-4 w-4" /> },
        ]} />
      </div>
      {output === 'widget' && <p className="text-xs text-[var(--text-secondary)]">{t('music.visualizer.widget_hint')}</p>}
      {footer}
    </div>
  </DashboardPanel>;
}
