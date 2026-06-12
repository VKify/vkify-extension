import { installExtApi } from '../shared/ext-api.js';
/**
 * Embed-мост: тот же popup React-app внедряется в страницу
 * /vkify_settings (закрытая группа расширения) как iframe.
 *
 * Host лежит в document.body (а не в #spa_layout_content) — иначе React VK
 * выбрасывает чужой узел при следующей реконсиляции и попап исчезает.
 * Позиционируется absolute по bounding rect #page_body.
 */

installExtApi(); // cross-browser chrome/browser normalisation — before any chrome.* call

const EMBED_PATH = '/vkify_settings';
const POPUP_URL  = chrome.runtime.getURL('index.html') + '?embed=1';
// Origin попапа фиксирован (chrome-extension://<id>) — пиним его на исходящих
// postMessage вместо '*', чтобы viewport-данные не достались чужому origin,
// если iframe вдруг будет уведён на другой адрес.
const EXT_ORIGIN = new URL(POPUP_URL).origin;
const HOST_ID     = 'vkify-embed-host';
const IFRAME_ID   = 'vkify-embed-iframe';
const STYLE_ID    = 'vkify-embed-styles';
const BODY_CLASS  = 'vkify-embed-active';

const ANCHOR_SELECTORS = [
  '#page_body',
  '#spa_layout_content',
];

const ATTR_PROFILE_LINK = 'data-vkify-profile-link';

const STYLE_CSS = `
  /* Сплошной фон хоста перекрывает VK-контент группы за/под iframe'ом
     (карточка «закрытое сообщество», виджеты). min-height задаётся из JS
     по высоте видимой области — так фон всегда доходит до низа экрана,
     даже если контента в iframe мало (раньше эту роль играл отдельный
     #vkify-embed-backdrop). */
  #${HOST_ID} {
    position: absolute;
    z-index: 50;
    padding: 0;
    box-sizing: border-box;
    background: var(--vkui--color_background_secondary, #f5f5f7);
    pointer-events: auto;
  }
  @media (prefers-color-scheme: dark) {
    #${HOST_ID} {
      background: var(--vkui--color_background_secondary, #1c1c1e);
    }
  }
  #${IFRAME_ID} {
    width: 100%;
    /* min-height до первого замера из popup'а (postMessage VKIFY_EMBED_HEIGHT). */
    min-height: 100vh;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: var(--vkui--color_background_secondary, #f5f5f7);
    display: block;
    color-scheme: light dark;
  }
  @media (prefers-color-scheme: dark) {
    #${IFRAME_ID} {
      background: var(--vkui--color_background_secondary, #1c1c1e);
    }
  }
`;

function shouldEmbed(): boolean {
  return location.pathname === EMBED_PATH || location.pathname === EMBED_PATH + '/';
}

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE_CSS;
  document.head.appendChild(style);
}

function findAnchor(): HTMLElement | null {
  for (const sel of ANCHOR_SELECTORS) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) return el;
  }
  return null;
}

let resizeObs: ResizeObserver | null = null;
let resizeHandler: (() => void) | null = null;
let scrollHandler: (() => void) | null = null;
let storageListener: Parameters<typeof chrome.storage.onChanged.addListener>[0] | null = null;
let currentAnchor: HTMLElement | null = null;
let currentIframe: HTMLIFrameElement | null = null;

function positionHost(): void {
  const host = document.getElementById(HOST_ID);
  if (!host || !currentAnchor) return;

  const r = currentAnchor.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) {
    const next = findAnchor();
    if (next && next !== currentAnchor) {
      attachObservers(next);
      currentAnchor = next;
      return positionHost();
    }
  }

  // Host — absolute в координатах документа.
  host.style.left  = `${r.left + window.scrollX}px`;
  host.style.top   = `${r.top + window.scrollY}px`;
  host.style.width = `${r.width}px`;

  // Фон хоста должен доходить минимум до низа экрана, даже если контента в
  // iframe мало — иначе под коротким iframe'ом проглядывала бы группа.
  host.style.minHeight = `${Math.max(0, window.innerHeight - r.top)}px`;

  sendViewport();
}

/**
 * Сообщает popup'у внутри iframe видимую вертикальную полосу — в координатах
 * самого iframe (0 = верх его контента). Нужно, чтобы модалки и onboarding
 * центрировались по видимой части экрана, а не по середине длинного iframe
 * (внутри iframe `position: fixed` отсчитывается от всей его высоты).
 */
function sendViewport(): void {
  const iframe = currentIframe;
  if (!iframe?.contentWindow) return;

  const rect = iframe.getBoundingClientRect();
  const visibleTop    = Math.max(0, -rect.top);
  const visibleBottom = Math.min(rect.height, window.innerHeight - rect.top);
  const height        = Math.max(0, visibleBottom - visibleTop);

  iframe.contentWindow.postMessage(
    { type: 'VKIFY_EMBED_VIEWPORT', top: visibleTop, height },
    EXT_ORIGIN,
  );
}

function attachObservers(anchor: HTMLElement): void {
  detachObservers();
  resizeObs = new ResizeObserver(() => positionHost());
  resizeObs.observe(anchor);
  resizeObs.observe(document.documentElement);
  resizeHandler = positionHost;
  window.addEventListener('resize', resizeHandler);

  // Скролл страницы vk.com не двигает host (он absolute в координатах
  // документа), но меняет видимую полосу iframe — пересылаем её, чтобы
  // открытая модалка/onboarding оставались по центру экрана.
  let scrollScheduled = false;
  scrollHandler = () => {
    if (scrollScheduled) return;
    scrollScheduled = true;
    requestAnimationFrame(() => {
      scrollScheduled = false;
      sendViewport();
    });
  };
  window.addEventListener('scroll', scrollHandler, { passive: true });

  // VKify-фичи вроде page-offset/widescreen меняют CSS transform на
  // #page_layout — это сдвигает anchor визуально, но ResizeObserver на
  // transform не реагирует (размер не меняется). Подписываемся на
  // chrome.storage и перепроводим расчёт при любом изменении настроек.
  storageListener = (_changes, area) => {
    if (area !== 'local') return;
    requestAnimationFrame(positionHost);
  };
  chrome.storage.onChanged.addListener(storageListener);
}

function detachObservers(): void {
  resizeObs?.disconnect();
  resizeObs = null;
  if (resizeHandler) window.removeEventListener('resize', resizeHandler);
  resizeHandler = null;
  if (scrollHandler) window.removeEventListener('scroll', scrollHandler);
  scrollHandler = null;
  if (storageListener) chrome.storage.onChanged.removeListener(storageListener);
  storageListener = null;
}

// Авто-высота iframe — через postMessage из popup'а.
// contentDocument напрямую читать нельзя: content-script в origin vk.com,
// iframe в chrome-extension://[id], SOP блокирует доступ.
let cleanupHeightTracker: (() => void) | null = null;

function attachHeightTracker(iframe: HTMLIFrameElement): void {
  detachHeightTracker();

  const handler = (e: MessageEvent): void => {
    if (e.source !== iframe.contentWindow) return;
    const data = e.data as { type?: string; height?: number } | null;
    if (!data || data.type !== 'VKIFY_EMBED_HEIGHT') return;
    const h = data.height;
    if (typeof h !== 'number' || h < 1) return;
    iframe.style.height = `${h}px`;
    iframe.style.minHeight = '0';
    // Высота iframe изменилась → изменилась и его видимая полоса.
    sendViewport();
  };

  window.addEventListener('message', handler);
  cleanupHeightTracker = () => window.removeEventListener('message', handler);
}

function detachHeightTracker(): void {
  cleanupHeightTracker?.();
  cleanupHeightTracker = null;
}

function mount(): void {
  if (document.getElementById(HOST_ID)) return;
  const anchor = findAnchor();
  if (!anchor) return;

  ensureStyles();

  const host = document.createElement('div');
  host.id = HOST_ID;

  const iframe = document.createElement('iframe');
  iframe.id = IFRAME_ID;
  iframe.src = POPUP_URL;
  iframe.title = 'VKify · Настройки';
  iframe.setAttribute('loading', 'eager');
  iframe.setAttribute('referrerpolicy', 'no-referrer');

  host.appendChild(iframe);

  document.body.appendChild(host);
  document.body.classList.add(BODY_CLASS);

  currentAnchor = anchor;
  currentIframe = iframe;
  attachObservers(anchor);
  attachHeightTracker(iframe);
  positionHost();
}

function unmount(): void {
  const host = document.getElementById(HOST_ID);
  detachObservers();
  detachHeightTracker();
  currentAnchor = null;
  currentIframe = null;
  if (host) host.remove();
  document.body.classList.remove(BODY_CLASS);
}

function syncWithRoute(): void {
  if (!shouldEmbed()) {
    unmount();
    return;
  }

  if (findAnchor()) {
    mount();
    return;
  }

  const obs = new MutationObserver(() => {
    if (!shouldEmbed()) { obs.disconnect(); return; }
    if (findAnchor())   { obs.disconnect(); mount(); }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => obs.disconnect(), 10000);
}

// ───────────────────────────────────────────────────────────────────────────
// Пункт «Настройки VKify» в выпадающем меню профиля
// ───────────────────────────────────────────────────────────────────────────

const PROFILE_MENU_SELECTOR  = '[data-testid="header-profile-menu"]';
const SETTINGS_LINK_SELECTOR = '#top_settings_link';

const VKIFY_ICON_SVG = `
  <svg aria-hidden="true" display="block" width="20" height="20" viewBox="0 0 231 148" fill="currentColor">
    <path d="M73.711 1.84L97.056 57.51c.864 2.06 3.596 2.487 5.047.789L151.041 1.05c.57-.667 1.403-1.05 2.281-1.05h67.793c2.53 0 3.924 2.939 2.323 4.898L107.853 146.382c-.578.707-1.445 1.112-2.357 1.102l-41.609-.462c-1.184-.014-2.25-.723-2.72-1.811L.249 4.19C-.606 2.209.846 0 3.003 0h67.941c1.209 0 2.299.725 2.767 1.84Z"/>
    <path d="M138.702 122.916l34.466-40.732c1.192-1.409 3.361-1.418 4.565-.018l51.942 60.378c1.674 1.944.292 4.956-2.274 4.956h-67.199c-.807 0-1.581-.325-2.145-.903l-19.209-19.645c-1.082-1.107-1.145-2.854-.146-4.036Z"/>
  </svg>
`;

// Классы VKUI Tappable — навешиваем сами, потому что cloneNode не копирует
// React-listeners оригинала.
const VKUI_HOVER_CLASS  = 'vkuiTappable__hoveredBackground';
const VKUI_ACTIVE_CLASS = 'vkuiTappable__activeBackground';

// Закрывает открытый VKUI Popover после клика по нашему пункту.
function closeOpenPopoverMenu(): void {
  requestAnimationFrame(() => {
    const trigger = document.querySelector<HTMLElement>(
      '[aria-expanded="true"][aria-haspopup="menu"], [aria-expanded="true"][aria-haspopup="dialog"]',
    );
    if (trigger) {
      trigger.click();
      return;
    }
    const opts = { bubbles: true, cancelable: true, clientX: 4, clientY: window.innerHeight - 4 };
    document.documentElement.dispatchEvent(new PointerEvent('pointerdown', opts));
    document.documentElement.dispatchEvent(new MouseEvent('mousedown', opts));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
}

function buildVKifyMenuItem(template: HTMLAnchorElement): HTMLAnchorElement {
  const clone = template.cloneNode(true) as HTMLAnchorElement;
  clone.id = 'top_vkify_settings_link';
  clone.setAttribute(ATTR_PROFILE_LINK, '1');
  clone.href = EMBED_PATH;

  clone.addEventListener('mouseenter', () => clone.classList.add(VKUI_HOVER_CLASS));
  clone.addEventListener('mouseleave', () => {
    clone.classList.remove(VKUI_HOVER_CLASS);
    clone.classList.remove(VKUI_ACTIVE_CLASS);
  });
  clone.addEventListener('mousedown',  () => clone.classList.add(VKUI_ACTIVE_CLASS));
  clone.addEventListener('mouseup',    () => clone.classList.remove(VKUI_ACTIVE_CLASS));
  clone.addEventListener('blur',       () => clone.classList.remove(VKUI_ACTIVE_CLASS));

  clone.addEventListener('click', (e) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    history.pushState({}, '', EMBED_PATH);
    window.dispatchEvent(new PopStateEvent('popstate'));
    closeOpenPopoverMenu();
  });

  const iconWrap = clone.querySelector('.vkuiSimpleCell__before') ?? clone.firstElementChild;
  if (iconWrap) {
    const oldIcon = iconWrap.querySelector('svg');
    if (oldIcon) {
      const tmp = document.createElement('div');
      tmp.innerHTML = VKIFY_ICON_SVG.trim();
      const newIcon = tmp.firstElementChild as SVGElement | null;
      if (newIcon) {
        for (const cls of Array.from(oldIcon.classList)) newIcon.classList.add(cls);
        newIcon.setAttribute('width',  oldIcon.getAttribute('width')  ?? '20');
        newIcon.setAttribute('height', oldIcon.getAttribute('height') ?? '20');
        (newIcon as unknown as HTMLElement).style.color = 'var(--vkui--color_accent_blue, #0077ff)';
        oldIcon.replaceWith(newIcon);
      }
    }
  }

  const textNode = clone.querySelector<HTMLElement>('.vkuiText__host');
  if (textNode) textNode.textContent = 'Настройки VKify';

  return clone;
}

function tryInjectMenuItem(menu: Element): void {
  if (menu.querySelector(`[${ATTR_PROFILE_LINK}="1"]`)) return;
  const template = menu.querySelector<HTMLAnchorElement>(SETTINGS_LINK_SELECTOR);
  if (!template) return; // шаблон ещё не отрендерен — повторный скан подхватит позже
  try {
    const item = buildVKifyMenuItem(template);
    template.parentElement?.insertBefore(item, template.nextSibling);
  } catch (err) {
    console.error('[VKify] Profile menu item injection failed:', err);
  }
}

function startMenuObserver(): void {
  const scan = (): void => {
    document.querySelectorAll(PROFILE_MENU_SELECTOR).forEach(tryInjectMenuItem);
  };
  scan();

  // Пересканируем при ЛЮБОМ изменении DOM (дебаунс — раз в кадр), а не реагируем
  // только на добавление узла-меню. Причина: VK (React) добавляет контейнер
  // меню и его пункты (#top_settings_link) в РАЗНЫХ кадрах — в Firefox это
  // особенно заметно. Одноразовая реакция на добавление контейнера ловила его,
  // когда шаблона-ссылки внутри ещё не было, и пункт не вставлялся. Idempotent
  // tryInjectMenuItem делает повторные сканы безопасными.
  let scheduled = false;
  const obs = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; scan(); });
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
}

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