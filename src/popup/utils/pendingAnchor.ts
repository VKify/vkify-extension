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

/** Вкладка при монтировании: забрать (и сбросить) ожидающий якорь. */
export function consumeAnchor(): string | null {
  const anchor = pending;
  pending = null;
  return anchor;
}

/**
 * Подсмотреть ожидающий якорь, НЕ сбрасывая его. Нужно вложенной навигации
 * (SubpageHost), которая монтируется глубже владельца вкладки и должна успеть
 * увидеть якорь до того, как тот его потребит через `consumeAnchor`.
 */
export function peekAnchor(): string | null {
  return pending;
}

/** Уже смонтированная вкладка: подписка на новые якоря. Возвращает unsubscribe. */
export function onAnchor(cb: (anchor: string) => void): () => void {
  const handler = (e: Event): void => {
    pending = null; // доставлен подписчику — потреблён
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
