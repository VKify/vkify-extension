import React, { useState, useEffect } from 'react';
import { SettingsProvider } from './context/SettingsContext';
import { ToastProvider } from './context/ToastContext';
import Header from './components/Header';
import QuickActions from './components/QuickActions';
import Tabs from './components/Tabs';
import TabContent from './components/TabContent';
import Toast from './components/ui/Toast';
import { useTheme } from './hooks/useTheme';

const tabs = [
  { id: 'appearance', label: 'Вид', icon: 'palette' },
  { id: 'filters', label: 'Фильтры', icon: 'filter' },
  { id: 'elements', label: 'Элементы', icon: 'layout' },
  { id: 'privacy', label: 'Приватность', icon: 'shield' },
  { id: 'ads', label: 'Реклама', icon: 'ban' },
  { id: 'scripts', label: 'Скрипты', icon: 'code' },
  { id: 'css', label: 'CSS', icon: 'code' },
  { id: 'more', label: 'Ещё', icon: 'settings' },
];

function AppContent() {
  const [activeTab, setActiveTab] = useState('appearance');
  const [isReady, setIsReady] = useState(false);
  const { initTheme } = useTheme();

  useEffect(() => {
    const init = async () => {
      await initTheme();
      setIsReady(true);
      document.getElementById('root')?.classList.add('ready');
    };
    init();
  }, [initTheme]);

  if (!isReady) {
    return null;
  }

  return (
    <div className="flex flex-col h-full min-h-[600px] bg-[var(--bg-secondary)]">
      <Header />
      <QuickActions />
      <Tabs tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />
      <TabContent activeTab={activeTab} />
      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </SettingsProvider>
  );
}