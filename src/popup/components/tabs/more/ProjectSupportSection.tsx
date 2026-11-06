import React from 'react';
import { useTranslation } from 'react-i18next';
import { CLOUDTIPS_SUPPORT_URL, PROJECT_SUPPORT_LINKS } from '@/popup/constants/links.js';
import { openTab } from '@/popup/utils/tabs.js';
import { DashboardPanel } from '../../ui/DashboardPrimitives.js';
import { DonutIcon, ExternalLinkIcon, HeartIcon, TelegramIcon } from '../../icons/Icons.js';

/** Keep link semantics/context menus, while routing ordinary clicks through the
 * existing background bridge (also available in Firefox's embedded settings). */
function openSupport(event: React.MouseEvent<HTMLAnchorElement>, url: string): void {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  openTab(url);
}

export default function ProjectSupportSection(): React.ReactElement {
  const { t } = useTranslation('settings');
  return <DashboardPanel title={t('more.support.title')} description={t('more.support.description')}
    icon={<HeartIcon className="w-5 h-5" />}>
    <div className="more-support" data-testid="project-support">
      <div className="more-support__options">
        {PROJECT_SUPPORT_LINKS.map(link => {
          const Icon = link.id === 'tribute' ? TelegramIcon : DonutIcon;
          return <a key={link.id} className="more-support__card" href={link.url} target="_blank" rel="noopener noreferrer"
            onClick={event => openSupport(event, link.url)}>
            <span className="dashboard-icon dashboard-icon--small dashboard-icon--primary"><Icon className="w-5 h-5" /></span>
            <span className="more-support__copy"><strong>{link.title}</strong><span>{t(`more.support.${link.id}`)}</span></span>
            <ExternalLinkIcon className="more-support__external w-3.5 h-3.5" />
          </a>;
        })}
      </div>
      <div className="more-support__alternative">
        <span>{t('more.support.alternative')}</span>
        <a href={CLOUDTIPS_SUPPORT_URL} target="_blank" rel="noopener noreferrer" onClick={event => openSupport(event, CLOUDTIPS_SUPPORT_URL)}>
          CloudTips<ExternalLinkIcon className="w-3 h-3" />
        </a>
      </div>
    </div>
  </DashboardPanel>;
}
