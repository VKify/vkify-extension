/**
 * Мост «поисковая палитра → вкладка с внутренней навигацией».
 *
 * App после выбора в Ctrl+K знает только id вкладки и якорь (data-vkify-anchor),
 * но вкладка «Центр» сама решает, какая из её страниц активна — якорь может
 * лежать на ещё не открытой странице, и DOM-опрос App его не найдёт.
 *
 * Модуль намеренно крошечный и без зависимостей: его импортируют и App
 * (основной чанк), и лениво загружаемый CenterTab — тянуть сюда реестр страниц
 * нельзя, иначе весь чанк «Центра» попадёт в основной бандл.
 */

const EVENT = 'vkify:pending-anchor';

let pending: string | null = null;

/** App: объявить якорь перед переключением вкладки. */
export function announceAnchor(anchor: string | null): void {
  pending = anchor;
  if (anchor) {
    window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: anchor }));
  }
}

/**
 * Подсмотреть ожидающий якорь, НЕ сбрасывая его.
 *
 * Якорь может понадобиться нескольким уровням навигации подряд: хаб
 * переключает страницу (CenterTab/HidingTab), затем `SubpageHost` на этой
 * странице открывает подстраницу. Если кто-то один «потребит» (обнулит) якорь,
 * следующий уровень его не увидит — поэтому все читают через peek, а финально
 * сбрасывает только App (`clearAnchor`) после того, как нашёл и подсветил
 * элемент в DOM.
 */
export function peekAnchor(): string | null {
  return pending;
}

/** App: сбросить якорь, когда он доставлен (элемент найден) или истёк дедлайн. */
export function clearAnchor(): void {
  pending = null;
}

/** Уже смонтированная вкладка: подписка на новые якоря. Возвращает unsubscribe. */
export function onAnchor(cb: (anchor: string) => void): () => void {
  // НЕ обнуляем pending здесь: его читают несколько уровней навигации, а
  // финально сбрасывает App через clearAnchor.
  const handler = (e: Event): void => {
    cb((e as CustomEvent<string>).detail);
  };
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

// ── Обратное направление: вкладка → App ────────────────────────────────────
// Кросс-вкладочные ссылки («открыть настройки X») живут глубоко в дереве, а
// состояние активной вкладки — в App. Запрос идёт тем же event-механизмом,
// чтобы не прокидывать setActiveTab через все уровни пропсами.

const NAV_EVENT = 'vkify:navigate-request';

export interface NavigateRequest {
  tab: string;
  anchor?: string | null;
}

/** Любой компонент: попросить App открыть вкладку (и подсветить якорь). */
export function requestNavigate(tab: string, anchor?: string | null): void {
  window.dispatchEvent(new CustomEvent<NavigateRequest>(NAV_EVENT, { detail: { tab, anchor } }));
}

/** App: подписка на запросы навигации. Возвращает unsubscribe. */
export function onNavigateRequest(cb: (req: NavigateRequest) => void): () => void {
  const handler = (e: Event): void => cb((e as CustomEvent<NavigateRequest>).detail);
  window.addEventListener(NAV_EVENT, handler);
  return () => window.removeEventListener(NAV_EVENT, handler);
}
