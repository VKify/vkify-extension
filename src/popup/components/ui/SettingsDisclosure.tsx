import React, { useId } from 'react';
import { ChevronDownIcon } from '../icons/Icons.js';
import NestedSettings from './NestedSettings.js';

interface SettingsDisclosureProps {
  title: string;
  icon?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  badge?: number | null;
  children: React.ReactNode;
}

/** A compact settings card with the same spacing and accent as section menus. */
export default function SettingsDisclosure({ title, icon, open, onToggle, badge, children }: SettingsDisclosureProps): React.ReactElement {
  const id = useId();
  return (
    <section className={`settings-disclosure ${open ? 'is-open' : ''}`}>
      <button type="button" className="settings-disclosure__trigger" onClick={onToggle}
        aria-expanded={open} aria-controls={id}>
        {icon && <span className="settings-disclosure__icon">{icon}</span>}
        <span className="settings-disclosure__title">{title}</span>
        {badge != null && <span className="settings-disclosure__badge">{badge}</span>}
        <ChevronDownIcon className="settings-disclosure__chevron" />
      </button>
      <NestedSettings open={open} className="settings-disclosure__body">
        <div id={id} className="settings-disclosure__content">{children}</div>
      </NestedSettings>
    </section>
  );
}
