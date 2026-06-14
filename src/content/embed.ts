import { installExtApi } from '../shared/ext-api.js';
import { syncWithRoute } from './embed/host.js';
import { startMenuObserver } from './embed/menu-item.js';

/**
 * Точка входа embed-моста (content-script на /vkify_settings). Внедряет popup
 * как iframe (host.ts) и добавляет пункт «Настройки VKify» в меню профиля
 * (menu-item.ts). Здесь — инициализация API, отслеживание SPA-навигации и boot.
 */

installExtApi(); // cross-browser chrome/browser normalisation — before any chrome.* call

// ───────────────────────────────────────────────────────────────────────────
// SPA route tracking
// ───────────────────────────────────────────────────────────────────────────

let lastUrl = location.href;
function onUrlMaybeChanged(): void {
  if (location.href === lastUrl) return;
  lastUrl = location.href;
  syncWithRoute();
}

// Два уровня хука: VK мог закэшировать ссылку на History.prototype.pushState
// ДО загрузки content-script'а — без хука на прототип такие вызовы пройдут
// мимо нас. Полл-фолбэк ниже покрывает остальные кейсы.
//
// КРОСС-БРАУЗЕРНО: в Firefox content-script живёт в Xray-песочнице и НЕ может
// переопределять нативные методы прототипов страницы (`History.prototype.*`) —
// присваивание бросает исключение. Оборачиваем в try/catch, чтобы оно не уронило
// весь модуль (иначе boot() ниже не вызовется — нет ни меню, ни эмбеда). Даже
// когда хуки не ставятся, отслеживание SPA-навигации остаётся рабочим за счёт
// popstate/hashchange + setInterval-полла.
function hookHistory(): void {
  const wrap = <T extends (...a: never[]) => unknown>(orig: T): T =>
    function (this: unknown, ...args: never[]) {
      const r = orig.apply(this, args);
      queueMicrotask(onUrlMaybeChanged);
      return r;
    } as T;

  try {
    History.prototype.pushState = wrap(History.prototype.pushState);
    History.prototype.replaceState = wrap(History.prototype.replaceState);
  } catch { /* Firefox Xray: нельзя переопределить методы прототипа страницы */ }

  try {
    history.pushState = wrap(history.pushState);
    history.replaceState = wrap(history.replaceState);
  } catch { /* same as above for the instance */ }
}
hookHistory();

window.addEventListener('popstate',   onUrlMaybeChanged);
window.addEventListener('hashchange', onUrlMaybeChanged);
setInterval(onUrlMaybeChanged, 300);

function boot(): void {
  syncWithRoute();
  startMenuObserver();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
