import React from 'react';
import AppearanceTab from './tabs/AppearanceTab';
import FiltersTab from './tabs/FiltersTab';
import ElementsTab from './tabs/ElementsTab';
import PrivacyTab from './tabs/PrivacyTab';
import AdsTab from './tabs/AdsTab';
import ScriptsTab from './tabs/ScriptsTab';
import CSSEditorTab from './tabs/CSSEditorTab';
import MoreTab from './tabs/MoreTab';

const tabComponents = {
  appearance: AppearanceTab,
  filters: FiltersTab,
  elements: ElementsTab,
  privacy: PrivacyTab,
  ads: AdsTab,
  scripts: ScriptsTab,
  css: CSSEditorTab,
  more: MoreTab,
};

export default function TabContent({ activeTab }) {
  const ActiveComponent = tabComponents[activeTab];
  
  return (
    <main className="flex-1 overflow-y-auto px-5 pb-5">
      <div className="animate-fade-in">
        <ActiveComponent />
      </div>
    </main>
  );
}