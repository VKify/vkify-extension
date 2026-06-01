import React, { useState, useEffect, useCallback } from 'react';
import { SettingsProvider } from './context/SettingsContext.js';
import { ToastProvider } from './context/ToastContext.js';
import Header from './components/layout/Header.js';
import Tabs from './components/layout/Tabs.js';
import TabContent from './components/layout/TabContent.js';
import HostPermissionBanner from './components/layout/HostPermissionBanner.js';
import SearchPalette from './components/layout/SearchPalette.js';
import Toast from './components/ui/Toast.js';
import OnboardingTour from './components/onboarding/OnboardingTour.js';
import { usePopupTheme } from './hooks/core/usePopupTheme.js';
import { TABS } from './constants/tabs.js';
import { StorageKey } from '../shared/constants/storage-keys.js';

/**
 * Возвращает узел, на который имеет смысл повесить класс `.vkify-flash`.
 *
 * Если anchor был поставлен на голую `<div>`-обёртку без своего размера/фона
 * (типичный случай — `<div data-vkify-anchor="..."><SomeSection /></div>`),
 * inset-тень рисуется на этом div'е и физически перекрывается стилизованным
 * ребёнком — вспышки не видно. В таком случае спускаемся на единственного
 * прямого ребёнка, у которого, скорее всего, есть и фон, и border-radius.
 *
 * Эвристика: тонкий wrapper-div определяется тремя сигналами одновременно:
 *   • это DIV (а не SECTION/ARTICLE/LABEL — у тех своя стилизация);
 *   • нет ни одного класса (`className === ''`);
 *   • ровно один прямой ребёнок-элемент.
 */
function resolveFlashTarget(el: HTMLElement): HTMLElement {
  if (
    el.tagName === 'DIV' &&
    el.className === '' &&
    el.childElementCount === 1
  ) {
    return el.firstElementChild as HTMLElement;
  }
  return el;
}

function AppContent(): React.ReactElement | null {
  const [activeTab, setActiveTab] = useState('appearance');
  const [isReady, setIsReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null);
  const { initTheme } = usePopupTheme();

  // Глобальный хоткей Ctrl+K / Cmd+K — открывает палитру с поиском по
  // функциям. Перехватываем как `capture`, чтобы не дать VK-странице
  // (если попап открыт поверх неё) увести событие к себе.
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Когда поиск выбрал функцию — мы переключаем вкладку, но контент рендерится
  // лениво (Suspense). Поэтому опрашиваем DOM каждые ~RAF до тех пор, пока
  // якорь не появится (но не дольше ~750 мс — иначе тихо сдаёмся, если у
  // функции вообще нет соответствующего SettingRow).
  useEffect(() => {
    if (!pendingAnchor) return;
    let cancelled = false;
    const deadline = performance.now() + 750;

    const tick = (): void => {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(`[data-vkify-anchor="${CSS.escape(pendingAnchor)}"]`);
      if (el) {
        // Если anchor стоит на голом <div>-обёртке (например, `<div data-…>
        // <SomeSection /></div>`), inset-тень анимации рисуется на этом div'е
        // и полностью перекрывается внутренней секцией. Спускаемся на
        // стилизованного ребёнка — тогда тень видна.
        const flashTarget = resolveFlashTarget(el);
        flashTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
        flashTarget.classList.add('vkify-flash');
        setTimeout(() => flashTarget.classList.remove('vkify-flash'), 1600);
        setPendingAnchor(null);
        return;
      }
      if (performance.now() > deadline) {
        // У этой функции нет совпадающего якоря — просто прокручиваем контент
        // вверх, чтобы пользователь видел начало вкладки, и сбрасываем.
        setPendingAnchor(null);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => { cancelled = true; };
  }, [pendingAnchor, activeTab]);

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
      <Header onOpenSearch={() => setSearchOpen(true)} />
      <Tabs tabs={TABS} activeTab={activeTab} setActiveTab={setActiveTab} />
      <HostPermissionBanner />
      <TabContent activeTab={activeTab} />
      <Toast />

      <SearchPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={(tabId, anchorId) => {
          setActiveTab(tabId);
          setPendingAnchor(anchorId ?? null);
        }}
      />

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