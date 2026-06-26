import React, { Suspense, lazy } from 'react';

const AppearanceTab   = lazy(() => import('../tabs/AppearanceTab.js'));
const HidingTab       = lazy(() => import('../tabs/hiding/HidingTab.js'));
const PrivacyTab      = lazy(() => import('../tabs/PrivacyTab.js'));
const AdsTab          = lazy(() => import('../tabs/AdsTab.js'));
const AutomationTab   = lazy(() => import('../tabs/AutomationTab.js'));
const OnlineSpyTab    = lazy(() => import('../tabs/OnlineSpyTab.js'));
const CenterTab       = lazy(() => import('../tabs/center/CenterTab.js'));
const NotesTab        = lazy(() => import('../tabs/NotesTab.js'));
const CSSEditorTab    = lazy(() => import('../tabs/CSSEditorTab.js'));
const MoreTab         = lazy(() => import('../tabs/MoreTab.js'));

const TAB_COMPONENTS: Record<string, React.ComponentType> = {
  appearance: AppearanceTab,
  hiding:     HidingTab,
  privacy:    PrivacyTab,
  ads:        AdsTab,
  scripts:    AutomationTab,
  onlinespy:  OnlineSpyTab,
  center:     CenterTab,
  notes:      NotesTab,
  css:        CSSEditorTab,
  more:       MoreTab,
};

function TabFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

interface TabContentProps {
  activeTab: string;
}

export default function TabContent({ activeTab }: TabContentProps) {
  const ActiveComponent = TAB_COMPONENTS[activeTab];

  return (
    <main className="flex-1 overflow-y-auto px-5 pb-5">
      <div className="animate-fade-in">
        {ActiveComponent && (
          <Suspense fallback={<TabFallback />}>
            <ActiveComponent />
          </Suspense>
        )}
      </div>
    </main>
  );
}