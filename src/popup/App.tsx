import React, { useState, useEffect, useCallback } from 'react';
import { SettingsProvider } from './context/SettingsContext.js';
import { ToastProvider } from './context/ToastContext.js';
import Header from './components/layout/Header.js';
import QuickActions from './components/layout/QuickActions.js';
import Tabs from './components/layout/Tabs.js';
import TabContent from './components/layout/TabContent.js';
import Toast from './components/ui/Toast.js';
import OnboardingTour from './components/onboarding/OnboardingTour.js';
import { usePopupTheme } from './hooks/core/usePopupTheme.js';
import { TABS } from './constants/tabs.js';
import { StorageKey } from '../shared/constants/storage-keys.js';

function AppContent(): React.ReactElement | null {
  const [activeTab, setActiveTab] = useState('appearance');
  const [isReady, setIsReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { initTheme } = usePopupTheme();

  useEffect(() => {
    const init = async (): Promise<void> => {
      await initTheme();

      // Check whether the user has already seen the onboarding tour.
      // We use a dedicated key so it's independent of the content-script
      // first_run flag (which triggers the WelcomeModal on the VK page).
      const { [StorageKey.ONBOARDING_DONE]: done } = await chrome.storage.local.get(
        StorageKey.ONBOARDING_DONE
      );
      if (!done) {
        setShowOnboarding(true);
      }

      setIsReady(true);
      document.getElementById('root')?.classList.add('ready');
    };
    void init();
  }, [initTheme]);

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
    void chrome.storage.local.set({ [StorageKey.ONBOARDING_DONE]: true });
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <div className="relative flex flex-col h-full min-h-[660px] bg-[var(--bg-secondary)]">
      <Header />
      <QuickActions />
      <Tabs tabs={TABS} activeTab={activeTab} setActiveTab={setActiveTab} />
      <TabContent activeTab={activeTab} />
      <Toast />

      {showOnboarding && (
        <OnboardingTour onComplete={handleOnboardingComplete} />
      )}
    </div>
  );
}

export default function App(): React.ReactElement {
  return (
    <SettingsProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </SettingsProvider>
  );
}