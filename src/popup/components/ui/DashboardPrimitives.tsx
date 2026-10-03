import React, { forwardRef } from 'react';
import { ChevronRightIcon } from '../icons/Icons.js';
import DocsLink from './DocsLink.js';
import Toggle from './Toggle.js';
import { useSetting } from '../../store/selectors.js';
import { dashboardArtworks, type DashboardArtworkName } from '../../artwork/flat/index.js';
import './dashboard-primitives.css';

interface DashboardHeroProps {
  title: string;
  subtitle: string;
  description: string;
  artwork?: React.ReactNode;
  className?: string;
}

export function DashboardHero({ title, subtitle, description, artwork, className = '' }: DashboardHeroProps): React.ReactElement {
  const enabled = useSetting<boolean | undefined>('dashboard_hero_enabled');
  if (enabled === false) return <></>;
  return <section className={`dashboard-hero ${className}`}>
    <div className="dashboard-hero__copy">
      <h2>{title}</h2>
      <p className="dashboard-hero__subtitle">{subtitle}</p>
      <p className="dashboard-hero__description">{description}</p>
    </div>
    {artwork}
  </section>;
}

export function DashboardHeroArtwork({ name, alt = '', className = '' }: {
  name: DashboardArtworkName;
  alt?: string;
  className?: string;
}): React.ReactElement {
  // These strings are authored local SVG assets, never user or remote content.
  // Inline SVG inherits the live accent and surface variables from the popup.
  return <span className={`dashboard-hero__artwork ${className}`}
    role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}
    dangerouslySetInnerHTML={{ __html: dashboardArtworks[name] }} />;
}

interface DashboardPanelProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const DashboardPanel = forwardRef<HTMLElement, DashboardPanelProps>(function DashboardPanel({
  title, description, icon, action, children, className = '',
}, ref): React.ReactElement {
  return <section ref={ref} className={`dashboard-panel ${className}`}>
    <header className="dashboard-panel__header">
      <div className="dashboard-panel__identity">
        <span className="dashboard-icon dashboard-icon--primary">{icon}</span>
        <div className="dashboard-panel__copy">
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
      </div>
      {action && <div className="dashboard-panel__action">{action}</div>}
    </header>
    {children}
  </section>;
});

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

export function SegmentedControl<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
}): React.ReactElement {
  return <div role="group" aria-label={label} className="dashboard-segments">
    {options.map(option => <button key={option.value} type="button" aria-pressed={value === option.value}
      onClick={() => onChange(option.value)} className="dashboard-segments__item">
      {option.icon}{option.label}
    </button>)}
  </div>;
}

interface DashboardSettingCardProps {
  icon: React.ReactNode;
  title?: string;
  description?: string;
  control?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  anchor?: string;
  settingId?: string;
  docsId?: string;
}

export function DashboardSettingCard({ icon, title, description, control, children, className = '', anchor, settingId, docsId }: DashboardSettingCardProps): React.ReactElement {
  return <div className={`dashboard-setting-card ${className}`} data-vkify-anchor={anchor} data-setting={settingId}>
    <span className="dashboard-icon dashboard-icon--small dashboard-icon--primary">{icon}</span>
    <div className="dashboard-setting-card__content">
      {title && <strong>{title}</strong>}
      {description && <span>{description}</span>}
      {children}
    </div>
    {(docsId || control) && <div className="dashboard-setting-card__control">
      {docsId && <DocsLink featureId={docsId} />}
      {control}
    </div>}
  </div>;
}

interface DashboardListItemProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  checked: boolean;
  disabled?: boolean;
  badge?: string;
  expanded?: boolean;
  onToggle: (value: boolean) => void;
  onExpand: () => void;
  controlsLabel: string;
  anchor?: string;
  children?: React.ReactNode;
}

export function DashboardListItem({
  title, description, icon, checked, disabled, badge, expanded = false, onToggle,
  onExpand, controlsLabel, anchor, children,
}: DashboardListItemProps): React.ReactElement {
  return <article className={`dashboard-list-item${expanded ? ' is-expanded' : ''}`} data-vkify-anchor={anchor}>
    <div className="dashboard-list-item__row">
      <button type="button" className="dashboard-list-item__main" aria-expanded={expanded} onClick={onExpand}>
        <span className="dashboard-icon dashboard-icon--primary">{icon}</span>
        <span className="dashboard-list-item__copy">
          <span className="dashboard-list-item__title">{title}{badge && <span className="dashboard-badge">{badge}</span>}</span>
          <span className="dashboard-list-item__description">{description}</span>
        </span>
      </button>
      <Toggle checked={checked} onChange={onToggle} disabled={disabled} />
      <button type="button" className="dashboard-list-item__chevron" aria-label={controlsLabel} aria-expanded={expanded} onClick={onExpand}>
        <ChevronRightIcon className="h-4 w-4" />
      </button>
    </div>
    {expanded && <div className="dashboard-list-item__details">{children}</div>}
  </article>;
}

interface DashboardNavItemProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  meta?: React.ReactNode;
  docsId?: string;
  badge?: string;
}

export function DashboardNavItem({ title, description, icon, onClick, meta, docsId, badge }: DashboardNavItemProps): React.ReactElement {
  return <div className="dashboard-list-item dashboard-nav-item">
    <button type="button" className="dashboard-list-item__main dashboard-nav-item__main" onClick={onClick}>
      <span className="dashboard-icon dashboard-icon--primary">{icon}</span>
      <span className="dashboard-list-item__copy">
        <span className="dashboard-list-item__title">{title}{badge && <span className="dashboard-badge">{badge}</span>}</span>
        <span className="dashboard-list-item__description">{description}</span>
      </span>
      {meta && <span className="dashboard-nav-item__meta">{meta}</span>}
    </button>
    {docsId && <DocsLink featureId={docsId} />}
    <ChevronRightIcon className="dashboard-nav-item__chevron h-4 w-4" />
  </div>;
}

