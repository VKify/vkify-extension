/**
 * Embed-хост: тот же popup React-app внедряется в страницу /vkify_settings как
 * iframe. Host лежит в document.body (а не в #spa_layout_content) — иначе React
 * ВК выбрасывает чужой узел при следующей реконсиляции и попап исчезает.
 * Позиционируется absolute по bounding rect #page_body.
 */

import { EMBED_PATH } from './constants.js';
import { t } from './i18n.js';

const HOST_ID    = 'vkify-embed-host';
const IFRAME_ID  = 'vkify-embed-iframe';
const STYLE_ID   = 'vkify-embed-styles';
const BODY_CLASS = 'vkify-embed-active';

const ANCHOR_SELECTORS = [
  '#page_body',
  '#spa_layout_content',
];

// URL/origin попапа вычисляем лениво: модуль может импортироваться до того, как
// installExtApi() в точке входа нормализует глобальный `chrome` (Firefox).
let popupUrl = '';
function getPopupUrl(): string {
  return popupUrl ||= chrome.runtime.getURL('index.html') + '?embed=1';
}
// Origin попапа фиксирован (chrome-extension://<id>) — пиним его на исходящих
// postMessage вместо '*', чтобы viewport-данные не достались чужому origin,
// если iframe вдруг будет уведён на другой адрес.
let extOrigin = '';
function getExtOrigin(): string {
  return extOrigin ||= new URL(getPopupUrl()).origin;
}

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
    pointer-events: auto;
    margin-top: 16px;
  }

  #${IFRAME_ID} {
    width: 100%;
    /* min-height до первого замера из popup'а (postMessage VKIFY_EMBED_HEIGHT). */
    min-height: 100vh;
    border: 0;
    box-shadow: none;
    background: var(--vkui--color_background_secondary, #f5f5f7);
    display: block;
    color-scheme: light dark;
    box-shadow: var(--page-block-shadow) !important;
    border-radius: var(--vkui--size_border_radius_paper--regular);
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

  // Фон хоста + сам iframe должны доходить минимум до низа экрана, даже если
  // контента в iframe мало. floor = расстояние от верха контента до низа экрана
  // (по вьюпорту vk.com). Держим iframe не короче floor: тогда html-canvas
  // попапа (themed bg-secondary) заполняет весь iframe до низа экрана, и под
  // коротким контентом не проглядывает фон/обои страницы VK.
  //
  // floor — внешняя, вьюпорт-зависимая величина (не `100vh` внутри iframe и не
  // его собственная высота), поэтому после длинной подстраницы возврат к
  // короткой честно ужимает iframe обратно, без «залипания» на максимуме.
  const floor = Math.max(0, window.innerHeight - r.top);
  host.style.minHeight = `${floor}px`;
  if (currentIframe) currentIframe.style.minHeight = `${floor}px`;

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
    getExtOrigin(),
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

  // Первое сообщение применяем мгновенно; ПОСЛЕ него включаем плавный переход
  // высоты. Так начальная подгонка под контент не анимируется от 100vh (иначе
  // на загрузке iframe «схлопывался» бы с полного экрана), а вот последующие
  // изменения (открытие/возврат подстраницы → iframe растёт/ужимается) идут
  // плавно. Это и убирает «резкий скролл вверх»: при ужатии iframe'а окно VK
  // переклеммывает прокрутку постепенно, кадр за кадром, а не рывком.
  let sized = false;

  const handler = (e: MessageEvent): void => {
    if (e.source !== iframe.contentWindow) return;
    const data = e.data as { type?: string; height?: number } | null;
    if (!data || data.type !== 'VKIFY_EMBED_HEIGHT') return;
    const h = data.height;
    if (typeof h !== 'number' || h < 1) return;
    iframe.style.height = `${h}px`;
    // НЕ сбрасываем iframe.style.minHeight в 0: positionHost держит его равным
    // floor (высота видимой области), чтобы фон попапа доходил до низа экрана.
    // Иначе короткий контент схлопнул бы iframe и под ним проглянул бы фон VK.
    if (!sized) {
      sized = true;
      // На следующий кадр (после применения стартовой высоты) — включаем анимацию.
      requestAnimationFrame(() => { iframe.style.transition = 'height 0.22s ease'; });
    }
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
  iframe.src = getPopupUrl();
  iframe.title = t('embed.iframe_title');
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

/** Монтирует/демонтирует embed в зависимости от текущего маршрута SPA. */
export function syncWithRoute(): void {
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
