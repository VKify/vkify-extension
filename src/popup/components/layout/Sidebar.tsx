import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TABS } from '../../constants/tabs.js';
import { useVKifyStore } from '../../store/index.js';
import { tabIcons } from './Tabs.js';
import { SearchIcon, ChevronLeftIcon, ChevronRightIcon, SettingsIcon } from '../icons/Icons.js';
import { useEmbedViewport } from '../../hooks/core/useEmbedViewport.js';

const GROUPS = [
  { id: 'personalize', tabs: ['appearance', 'hiding', 'center', 'widgets', 'notes'] },
  { id: 'tools', tabs: ['privacy', 'onlinespy', 'scripts', 'ads', 'css'] },
];

function revealWithin(nav: HTMLElement | null, selected: HTMLElement | null): void {
  if (!nav || !selected || !nav.contains(selected)) return;
  const top = selected.getBoundingClientRect().top - nav.getBoundingClientRect().top;
  if (top < 0) nav.scrollTop += top;
  else if (top + selected.offsetHeight > nav.clientHeight) nav.scrollTop += top + selected.offsetHeight - nav.clientHeight;
}

export default function Sidebar({ onOpenSearch }: { onOpenSearch: () => void }): React.ReactElement {
  const { t } = useTranslation('settings');
  const activeTab = useVKifyStore(s => s.activeTab);
  const setActiveTab = useVKifyStore(s => s.setActiveTab);
  const compact = useVKifyStore(s => s.settings.popup_sidebar_compact === true);
  const saveSetting = useVKifyStore(s => s.saveSetting);
  const navRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const viewport = useEmbedViewport();
  const [origin, setOrigin] = useState(0);

  useLayoutEffect(() => {
    const body = asideRef.current?.parentElement;
    if (!body) return;
    const measure = (): void => setOrigin(body.getBoundingClientRect().top + window.scrollY);
    measure();
    const observer = new ResizeObserver(measure);
    if (body.previousElementSibling) observer.observe(body.previousElementSibling);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Scroll only this panel: scrollIntoView would also move the embedded VK page.
    const nav = scrollRef.current;
    if (!nav) return;
    const reveal = (): void => revealWithin(nav, nav.querySelector<HTMLElement>('[aria-current="page"]'));
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [activeTab, compact, viewport]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const next = event.key === 'ArrowDown' ? (index + 1) % TABS.length
      : event.key === 'ArrowUp' ? (index - 1 + TABS.length) % TABS.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    setActiveTab(TABS[next]!.id);
    const button = navRef.current?.querySelectorAll<HTMLButtonElement>('[data-sidebar-tab]')[next];
    button?.focus({ preventScroll: true });
    revealWithin(scrollRef.current, button ?? null);
  };

  return (
    <aside ref={asideRef} className={`popup-sidebar${compact ? ' popup-sidebar--compact' : ''}`}
      style={viewport ? { top: viewport.top, height: Math.max(0, viewport.height - Math.max(0, origin - viewport.top)) }
        : { '--sidebar-origin': `${origin}px` } as React.CSSProperties}>
      <div className="popup-sidebar__intro" aria-hidden="true">
        <span className="popup-sidebar__eyebrow">WORKSPACE</span>
        <span className="popup-sidebar__heading">{t('navigation.heading')}</span>
      </div>
      <button type="button" className="popup-sidebar__search" onClick={onOpenSearch}
        title={t('search.placeholder')} aria-label={t('search.aria')}>
        <SearchIcon className="w-4 h-4" />
        <span className="popup-sidebar__label">{t('navigation.search')}</span>
        <kbd className="popup-sidebar__shortcut">⌘ / Ctrl K</kbd>
      </button>
      <nav ref={navRef} className="popup-sidebar__nav" aria-label={t('navigation.label')}>
        <div ref={scrollRef} className="popup-sidebar__scroll">
        {GROUPS.map(group => (
          <div key={group.id} className={`popup-sidebar__group popup-sidebar__group--${group.id}`}>
            <span className="popup-sidebar__group-title">{t(`navigation.${group.id}`)}</span>
            {group.tabs.map(id => {
              const index = TABS.findIndex(tab => tab.id === id);
              const tab = TABS[index]!;
              const Icon = tabIcons[tab.icon];
              const label = t(`tabs.${id}`);
              return <button key={id} type="button" data-sidebar-tab={id}
                className="popup-sidebar__item" title={label} aria-label={label}
                aria-current={activeTab === id ? 'page' : undefined}
                onClick={() => setActiveTab(id)} onKeyDown={event => handleKeyDown(event, index)}>
                <span className="popup-sidebar__icon">{Icon && <Icon className="w-5 h-5" />}</span>
                <span className="popup-sidebar__label">{label}</span>
                <span className="popup-sidebar__active-dot" aria-hidden="true" />
              </button>;
            })}
          </div>
        ))}
        </div>
        <div className="popup-sidebar__group popup-sidebar__group--more">
          <button type="button" data-sidebar-tab="more" className="popup-sidebar__item"
            title={t('tabs.more')} aria-label={t('tabs.more')} aria-current={activeTab === 'more' ? 'page' : undefined}
            onClick={() => setActiveTab('more')} onKeyDown={event => handleKeyDown(event, TABS.length - 1)}>
            <span className="popup-sidebar__icon"><SettingsIcon className="w-5 h-5" /></span>
            <span className="popup-sidebar__label">{t('tabs.more')}</span>
            <span className="popup-sidebar__active-dot" aria-hidden="true" />
          </button>
        </div>
      </nav>
      <button type="button" className="popup-sidebar__collapse" onClick={() => { void saveSetting('popup_sidebar_compact', !compact); }}
        aria-pressed={compact} aria-label={t(compact ? 'navigation.expand' : 'navigation.collapse')}
        title={t(compact ? 'navigation.expand' : 'navigation.collapse')}>
        {compact ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronLeftIcon className="w-4 h-4" />}
        <span className="popup-sidebar__label">{t('navigation.collapse')}</span>
      </button>
    </aside>
  );
}
