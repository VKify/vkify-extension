import React, { useState, useEffect, useCallback } from 'react';
import Header from './Header.js';
import Tabs from './Tabs.js';
import TabContent from './TabContent.js';
import HostPermissionBanner from './HostPermissionBanner.js';
import SearchPalette from './SearchPalette.js';
import Toast from '../ui/Toast.js';
import OnboardingTour from '../onboarding/OnboardingTour.js';
import { usePopupTheme } from '../../hooks/core/usePopupTheme.js';
import { clearAnchor, onNavigateRequest } from '../../utils/pendingAnchor.js';
import { useVKifyStore } from '../../store/index.js';
import { TABS } from '../../constants/tabs.js';
import { StorageKey } from '@/shared/constants/storage-keys.js';
import { getStorage, setStorage } from '@/popup/utils/storageClient.js';

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

/**
 * Постоянный каркас popup'а: Header + вкладки + контент + оверлеи.
 *
 * Здесь же живёт навигация верхнего уровня (`activeTab`) и мост deep-link'ов
 * из Ctrl+K/поиска (`pendingAnchor`). Компонент намеренно не размонтируется при
 * смене вкладки — иначе DOM-опрос якоря и отложенная подсветка не доживали бы
 * до появления лениво загруженного контента. Провайдеры вынесены в `App`.
 */
export default function Layout(): React.ReactElement | null {
  // Навигация/поиск/deep-link якорь живут в сторе (ui-слайс). isReady и
  // showOnboarding — чисто локальный lifecycle каркаса, в сторе им не место.
  const activeTab = useVKifyStore((s) => s.activeTab);
  const searchOpen = useVKifyStore((s) => s.searchOpen);
  const setSearchOpen = useVKifyStore((s) => s.setSearchOpen);
  const pendingAnchor = useVKifyStore((s) => s.pendingAnchor);
  const setPendingAnchor = useVKifyStore((s) => s.setPendingAnchor);
  const navigateTo = useVKifyStore((s) => s.navigateTo);
  const [isReady, setIsReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
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
  }, [setSearchOpen]);

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
        clearAnchor(); // якорь доставлен — глобальный сброс для навигации подстраниц
        return;
      }
      if (performance.now() > deadline) {
        // У этой функции нет совпадающего якоря — просто прокручиваем контент
        // вверх, чтобы пользователь видел начало вкладки, и сбрасываем.
        setPendingAnchor(null);
        clearAnchor();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => { cancelled = true; };
  }, [pendingAnchor, activeTab, setPendingAnchor]);

  useEffect(() => {
    const init = async (): Promise<void> => {
      await initTheme();

      // Check whether the user has already seen the onboarding tour.
      // We use a dedicated key so it's independent of the content-script
      // first_run flag (which triggers the WelcomeModal on the VK page).
      const { [StorageKey.ONBOARDING_DONE]: done } = await getStorage(
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
    void setStorage({ [StorageKey.ONBOARDING_DONE]: true });
  }, []);

  // Единая точка навигации (`navigateTo`) теперь — экшен стора (ui-слайс): он
  // переключает вкладку, ставит pendingAnchor и зовёт announceAnchor для
  // подстраниц. Здесь только мост из requestNavigate (например, «Заметки →
  // настройки сообщений») в этот экшен.
  useEffect(() => onNavigateRequest(req => navigateTo(req.tab, req.anchor)), [navigateTo]);

  // Клик по мини-виджету на vk.com просит открыть дашборд: background ставит
  // флаг open_perf_dashboard. При загрузке popup'а потребляем его один раз и
  // переходим во вкладку «Ещё» → подстраница «Performance Dashboard» (по якорю).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await getStorage('open_perf_dashboard');
      if (cancelled || !res['open_perf_dashboard']) return;
      await setStorage({ open_perf_dashboard: false });
      navigateTo('more', 'performance_dashboard');
    })();
    return () => { cancelled = true; };
  }, [navigateTo]);

  if (!isReady) {
    return null;
  }

  return (
    <div className="relative flex flex-col h-full min-h-[660px] bg-[var(--bg-secondary)]">
      <Header onOpenSearch={() => setSearchOpen(true)} />
      <Tabs tabs={TABS} />
      <HostPermissionBanner />
      <TabContent activeTab={activeTab} />
      <Toast />

      <SearchPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={navigateTo}
      />

      {showOnboarding && (
        <OnboardingTour onComplete={handleOnboardingComplete} />
      )}
    </div>
  );
}
