/**
 * Общие утилиты и константы для всех download-фич:
 *   • video-download   — обычные видео (vkvideo.ru)
 *   • story-download   — сторис (vk.com)
 *   • clip-download    — клипы (vk.com / vkvideo.ru)
 *   • photo-download   — фото и альбомы (vk.com)
 */

/** Цвет «точки» у каждого качества в пикере. */
export const QUALITY_COLORS: Record<string, string> = {
  mp4_1080: '#a855f7',
  mp4_720:  '#3b82f6',
  mp4_480:  '#06b6d4',
  mp4_360:  '#10b981',
  mp4_240:  '#9ca3af',
};

/** Порядок отображения качеств в пикере (от высшего к низшему). */
export const VIDEO_QUALITIES = [
  { key: 'mp4_1080' as const, label: '1080p' },
  { key: 'mp4_720'  as const, label: '720p'  },
  { key: 'mp4_480'  as const, label: '480p'  },
  { key: 'mp4_360'  as const, label: '360p'  },
  { key: 'mp4_240'  as const, label: '240p'  },
];

export type VideoQualityKey = typeof VIDEO_QUALITIES[number]['key'];

/** Поля прямых URL'ов из ответа video.get / stories.getById. */
export interface VideoQualityFiles {
  mp4_1080?: string;
  mp4_720?:  string;
  mp4_480?:  string;
  mp4_360?:  string;
  mp4_240?:  string;
}

/** Запрещённые в именах файлов символы → подчёркивание; длина ≤ 180. */
export function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').slice(0, 180);
}

/** Отправляет запрос на скачивание в background (chrome.downloads) и показывает
 *  его в едином центре загрузок (видео/клипы/сторис/фото идут через эту функцию). */
export function requestDownload(url: string, filename: string): void {
  const id = `file:${filename}#${Date.now()}`;
  downloadCenterJobStart(id, filename);
  downloadCenterJobUpdate(id, 'Скачивание…');
  void Promise.resolve(chrome.runtime.sendMessage({ type: 'DOWNLOAD_VIDEO', url, filename }))
    .then((resp: unknown) => {
      const r = resp as { success?: boolean; error?: string } | undefined;
      if (r && r.success === false) downloadCenterJobError(id, r.error || 'Ошибка');
      else downloadCenterJobDone(id, 'В загрузках браузера');
    })
    .catch(() => downloadCenterJobError(id, 'Ошибка'));
}

/**
 * Единая иконка скачивания VKify — глиф из @vkontakte/icons (download_24).
 * ОДИН источник для всех download-фич — не дублируйте inline-SVG в фичах.
 */
export function buildDownloadIconSvg(size = 24): SVGSVGElement {
  const ns  = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = `width:${size}px;height:${size}px;display:block`;
  const p = document.createElementNS(ns, 'path');
  p.setAttribute(
    'd',
    'M9 3h6v6h3.034a.4.4 0 0 1 .283.683l-6.034 6.034a.4.4 0 0 1-.566 0L5.683 9.683A.4.4 0 0 1 5.966 9H9zM6 18h12a1 1 0 0 1 0 2H6a1 1 0 0 1 0-2',
  );
  svg.appendChild(p);
  return svg;
}

// ─── Фирменный tooltip VKify (общий для всех download-фич) ──────────────────────
//
// Один элемент на body (position:fixed → не клиппится контейнерами VK).
// Тёмная «пилюля» с фирменной точкой-градиентом и стрелкой снизу — узнаваемо
// и единообразно во всех фичах. Нативный VK-тултип из content-скрипта вызвать
// нельзя (page-global + inline-handler под CSP), поэтому рисуем свой.

const BRAND_TIP_CSS_ID = 'vkify-tip-css';
const BRAND_TIP_ATTR   = 'data-vkify-tip';
let brandTipEl: HTMLElement | null = null;

function ensureBrandTipStyles(): void {
  if (document.getElementById(BRAND_TIP_CSS_ID)) return;
  const s = document.createElement('style');
  s.id = BRAND_TIP_CSS_ID;
  s.textContent = `
    @keyframes vkify-tip-in {
      from { opacity: 0; transform: translate(-50%, calc(-100% - 2px)); }
      to   { opacity: 1; transform: translate(-50%, calc(-100% - 8px)); }
    }
    @keyframes vkify-tip-spin { to { transform: rotate(360deg); } }
    .vkify-tip {
      position: fixed; z-index: 2147483647;
      transform: translate(-50%, calc(-100% - 8px));
      display: inline-flex; align-items: center; gap: 8px;
      padding: 7px 13px 7px 11px; border-radius: 11px;
      font: 600 12px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      letter-spacing: .2px; white-space: nowrap; pointer-events: none;
      color: #fff;
      background:
        linear-gradient(150deg, rgba(34,36,44,.96), rgba(18,19,24,.96));
      -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
      box-shadow:
        0 10px 34px rgba(0,0,0,.5),
        0 0 0 1px rgba(255,255,255,.07) inset,
        0 0 22px rgba(122,140,255,.22);
      opacity: 0;
    }
    /* фирменная «искра»-индикатор — крутящийся конический градиент */
    .vkify-tip::before {
      content: ''; flex: 0 0 auto;
      width: 9px; height: 9px; border-radius: 50%;
      background: conic-gradient(from 0deg, #4da3ff, #8a6cff, #ff6ca3, #4da3ff);
      box-shadow: 0 0 9px rgba(122,140,255,.95);
      animation: vkify-tip-spin 2.8s linear infinite;
    }
    /* хвостик-стрелка снизу */
    .vkify-tip::after {
      content: ''; position: absolute; top: 100%; left: 50%;
      transform: translateX(-50%);
      border: 5px solid transparent; border-top-color: rgba(18,19,24,.96);
    }
    .vkify-tip.is-visible { opacity: 1; animation: vkify-tip-in .16s ease-out forwards; }
  `;
  document.head.appendChild(s);
}

function getBrandTip(): HTMLElement {
  ensureBrandTipStyles();
  if (brandTipEl && brandTipEl.isConnected) return brandTipEl;
  brandTipEl = document.createElement('div');
  brandTipEl.className = 'vkify-tip';
  brandTipEl.setAttribute(BRAND_TIP_ATTR, '');
  document.body.appendChild(brandTipEl);
  return brandTipEl;
}

/** Показывает фирменный tooltip над `anchor` с заданным текстом. */
export function showBrandTooltip(anchor: Element, text: string): void {
  const tip = getBrandTip();
  tip.textContent = text; // ::before/::after — псевдоэлементы, остаются
  const r = anchor.getBoundingClientRect();
  tip.style.left = `${r.left + r.width / 2}px`;
  tip.style.top  = `${r.top - 8}px`;
  tip.classList.add('is-visible');
}

export function hideBrandTooltip(): void {
  brandTipEl?.classList.remove('is-visible');
}

/** Навешивает фирменный tooltip на hover. `text` может быть функцией (ленивый). */
export function attachBrandTooltip(el: HTMLElement, text: string | (() => string)): void {
  el.addEventListener('mouseenter', () => showBrandTooltip(el, typeof text === 'function' ? text() : text));
  el.addEventListener('mouseleave', hideBrandTooltip);
}

/** Удаляет общий tooltip-элемент (при выключении фич). */
export function removeBrandTooltip(): void {
  brandTipEl?.remove();
  brandTipEl = null;
  document.getElementById(BRAND_TIP_CSS_ID)?.remove();
}

// ─── Фирменный логотип + кнопка VKify (база для всех download-кнопок) ───────────

/** Логотип VKify (2-path SVG, currentColor). Единый источник для всех фич. */
export function buildVkifyLogo(size = 18): SVGSVGElement {
  const ns  = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 231 148');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'vkify-logo');
  svg.style.cssText = `width:${size}px;height:${Math.round(size * 148 / 231)}px;flex-shrink:0`;
  const p1 = document.createElementNS(ns, 'path');
  p1.setAttribute('fill', 'currentColor');
  p1.setAttribute('d', 'M73.711 1.83982L97.0564 57.5097C97.9202 59.5696 100.652 59.9968 102.103 58.2988L151.041 1.05066C151.611 0.383902 152.444 0 153.322 0H221.115C223.645 0 225.039 2.93882 223.438 4.898L107.853 146.382C107.275 147.089 106.408 147.494 105.496 147.484L63.8875 147.022C62.7028 147.008 61.6367 146.299 61.1668 145.211L0.249245 4.18967C-0.606304 2.2091 0.845833 0 3.00328 0H70.9444C72.153 0 73.2436 0.725252 73.711 1.83982Z');
  const p2 = document.createElementNS(ns, 'path');
  p2.setAttribute('fill', 'currentColor');
  p2.setAttribute('d', 'M138.702 122.916L173.168 82.1842C174.36 80.7756 176.529 80.7667 177.733 82.1655L229.675 142.544C231.349 144.488 229.967 147.5 227.401 147.5H160.202C159.395 147.5 158.621 147.175 158.057 146.597L138.848 126.952C137.766 125.845 137.703 124.098 138.702 122.916Z');
  svg.append(p1, p2);
  return svg;
}

const BRAND_BTN_CSS_ID = 'vkify-brand-btn-css';

function ensureBrandButtonStyles(): void {
  if (document.getElementById(BRAND_BTN_CSS_ID)) return;
  const s = document.createElement('style');
  s.id = BRAND_BTN_CSS_ID;
  s.textContent = `
    @keyframes vkify-bb-spin { to { transform: rotate(360deg); } }
    .vkify-brand-btn {
      display: inline-flex; align-items: center; gap: 8px;
      height: 34px; padding: 0 15px; border: 0; border-radius: 10px;
      font: 600 12.5px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #fff; cursor: pointer; white-space: nowrap;
      background: linear-gradient(135deg, #4da3ff 0%, #8a6cff 55%, #b06cff 100%);
      box-shadow: 0 4px 14px rgba(93,124,236,.45);
      transition: filter .15s ease, transform .1s ease, box-shadow .15s ease;
    }
    .vkify-brand-btn:hover  { filter: brightness(1.08); box-shadow: 0 6px 20px rgba(93,124,236,.6); }
    .vkify-brand-btn:active { transform: scale(.97); }
    .vkify-brand-btn[data-busy="1"] { cursor: progress; opacity: .95; }
    .vkify-brand-btn .vkify-logo { color: #fff; }
    .vkify-brand-btn-label { display: inline-block; }
    /* Обычный лоадер во время загрузки; лого — только в покое */
    .vkify-bb-spinner {
      display: none; flex: 0 0 auto;
      width: 15px; height: 15px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,.45); border-top-color: #fff;
      animation: vkify-bb-spin .8s linear infinite;
    }
    .vkify-brand-btn[data-busy="1"] .vkify-logo     { display: none; }
    .vkify-brand-btn[data-busy="1"] .vkify-bb-spinner { display: block; }
  `;
  document.head.appendChild(s);
}

/**
 * Единая брендовая кнопка VKify (по образцу кнопки скачивания видео):
 * градиентная «пилюля» с логотипом и подписью. База для всех download-кнопок.
 */
export function createBrandButton(label: string, tooltip?: string): HTMLButtonElement {
  ensureBrandButtonStyles();
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'vkify-brand-btn';
  btn.appendChild(buildVkifyLogo(18));        // лого — в покое
  const spinner = document.createElement('span');
  spinner.className = 'vkify-bb-spinner';      // лоадер — во время загрузки
  btn.appendChild(spinner);
  const span = document.createElement('span');
  span.className = 'vkify-brand-btn-label';
  span.textContent = label;
  btn.appendChild(span);
  if (tooltip) attachBrandTooltip(btn, tooltip);
  return btn;
}

/** Меняет подпись брендовой кнопки (для прогресса). */
export function setBrandButtonLabel(btn: HTMLElement, text: string): void {
  const el = btn.querySelector('.vkify-brand-btn-label');
  if (el) el.textContent = text;
}

/** Снимает стили брендовой кнопки (при выключении фич). */
export function removeBrandButtonStyles(): void {
  document.getElementById(BRAND_BTN_CSS_ID)?.remove();
}

// ─── Единый центр загрузок (общий для всех download-фич) ────────────────────────
//
// Один фиксированный элемент на body. Любая фича (аудио, видео, клипы, сторис,
// фото) добавляет сюда задачи через jobStart/Update/Done/Error. Пользователь
// может уйти на другую страницу — центр переживает SPA-навигацию (фичи в своём
// scan вызывают ensureDownloadCenter). Центр НЕ должен сам рендериться из чужих
// MutationObserver'ов — рендер дёргается только при изменении задач.

type DlState = 'load' | 'done' | 'err';
interface DlJob { title: string; text: string; state: DlState; }

const DL_CENTER_ATTR   = 'data-vkify-dl-center';
const DL_CENTER_CSS_ID = 'vkify-dl-center-css';
const dlJobs   = new Map<string, DlJob>();
const dlTimers = new Map<string, number>();
let   dlCenterEl: HTMLElement | null = null;

function ensureDlCenterStyles(): void {
  if (document.getElementById(DL_CENTER_CSS_ID)) return;
  const s = document.createElement('style');
  s.id = DL_CENTER_CSS_ID;
  s.textContent = `
    @keyframes vkify-dlc-spin { to { transform: rotate(360deg); } }
    @keyframes vkify-dlc-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    .vkify-dl-center {
      position: fixed; right: 16px; bottom: 16px; z-index: 2147483646;
      width: 300px; max-height: 60vh; display: none; flex-direction: column;
      background: var(--vkui--color_background_modal, #fff);
      color: var(--vkui--color_text_primary, #19191a);
      border-radius: 14px; overflow: hidden;
      box-shadow: 0 14px 44px rgba(0,0,0,.3), 0 0 0 1px rgba(127,127,127,.14);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .vkify-dl-center.is-open { display: flex; animation: vkify-dlc-in .18s ease-out; }
    .vkify-dl-center__head {
      display: flex; align-items: center; gap: 8px;
      padding: 11px 12px; font-size: 13px; font-weight: 700;
      border-bottom: 1px solid rgba(127,127,127,.16);
    }
    .vkify-dl-center__count { margin-left: auto; font-size: 11px; font-weight: 600; color: var(--vkui--color_text_secondary, #818c99); }
    .vkify-dl-center__clear {
      border: 0; background: transparent; cursor: pointer; padding: 2px 5px; border-radius: 6px;
      color: var(--vkui--color_text_secondary, #818c99); font-size: 14px; line-height: 1;
    }
    .vkify-dl-center__clear:hover { background: rgba(127,127,127,.14); }
    .vkify-dl-center__list { overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 2px; }
    .vkify-dl-center__item { display: flex; align-items: center; gap: 10px; padding: 7px 8px; border-radius: 9px; }
    .vkify-dl-center__item:hover { background: rgba(127,127,127,.08); }
    .vkify-dl-center__ic {
      flex: 0 0 auto; width: 16px; height: 16px;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; line-height: 1;
    }
    .vkify-dl-center__ic.s-load::before {
      content: ''; width: 13px; height: 13px; border-radius: 50%;
      border: 2px solid rgba(127,127,127,.3); border-top-color: var(--vkui--color_text_accent, #2688eb);
      animation: vkify-dlc-spin .7s linear infinite;
    }
    .vkify-dl-center__ic.s-done { color: #4bb34b; }
    .vkify-dl-center__ic.s-err  { color: #e64646; }
    .vkify-dl-center__txt { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .vkify-dl-center__title  { font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .vkify-dl-center__status { font-size: 11px; color: var(--vkui--color_text_secondary, #818c99); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  `;
  document.head.appendChild(s);
}

function ensureDlCenterEl(): HTMLElement {
  ensureDlCenterStyles();
  if (dlCenterEl && dlCenterEl.isConnected) return dlCenterEl;
  dlCenterEl = document.createElement('div');
  dlCenterEl.className = 'vkify-dl-center';
  dlCenterEl.setAttribute(DL_CENTER_ATTR, '');
  document.body.appendChild(dlCenterEl);
  return dlCenterEl;
}

function clearFinishedDlJobs(): void {
  for (const [id, j] of dlJobs) if (j.state !== 'load') dlJobs.delete(id);
  renderDlCenter();
}

function renderDlCenter(): void {
  const el = ensureDlCenterEl();
  if (dlJobs.size === 0) { el.classList.remove('is-open'); el.replaceChildren(); return; }

  const active = [...dlJobs.values()].filter(j => j.state === 'load').length;

  const head = document.createElement('div');
  head.className = 'vkify-dl-center__head';
  head.appendChild(buildVkifyLogo(16));
  const ttl = document.createElement('span');
  ttl.textContent = 'Загрузки';
  const cnt = document.createElement('span');
  cnt.className = 'vkify-dl-center__count';
  cnt.textContent = active > 0 ? `${active} в работе` : 'готово';
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'vkify-dl-center__clear';
  clear.setAttribute('aria-label', 'Очистить завершённые');
  clear.textContent = '✕';
  clear.addEventListener('click', clearFinishedDlJobs);
  head.append(ttl, cnt, clear);

  const list = document.createElement('div');
  list.className = 'vkify-dl-center__list';
  for (const job of dlJobs.values()) {
    const item = document.createElement('div');
    item.className = 'vkify-dl-center__item';
    const ic = document.createElement('span');
    ic.className = `vkify-dl-center__ic s-${job.state}`;
    ic.textContent = job.state === 'done' ? '✓' : job.state === 'err' ? '✕' : '';
    const txt = document.createElement('div');
    txt.className = 'vkify-dl-center__txt';
    const t = document.createElement('div');
    t.className = 'vkify-dl-center__title';
    t.textContent = job.title || 'Загрузка';
    const s = document.createElement('div');
    s.className = 'vkify-dl-center__status';
    s.textContent = job.text;
    txt.append(t, s);
    item.append(ic, txt);
    list.appendChild(item);
  }

  el.replaceChildren(head, list);
  el.classList.add('is-open');
}

function scheduleDlCleanup(id: string, ms: number): void {
  const prev = dlTimers.get(id);
  if (prev) window.clearTimeout(prev);
  dlTimers.set(id, window.setTimeout(() => {
    dlJobs.delete(id);
    dlTimers.delete(id);
    renderDlCenter();
  }, ms));
}

/** Регистрирует/перезапускает задачу загрузки в центре. */
export function downloadCenterJobStart(id: string, title: string): void {
  const prev = dlTimers.get(id);
  if (prev) { window.clearTimeout(prev); dlTimers.delete(id); }
  dlJobs.set(id, { title, text: 'В очереди…', state: 'load' });
  renderDlCenter();
}
export function downloadCenterJobUpdate(id: string, text: string): void {
  const j = dlJobs.get(id);
  if (!j) return;
  j.text = text;
  renderDlCenter();
}
export function downloadCenterJobDone(id: string, text = 'Готово'): void {
  const j = dlJobs.get(id);
  dlJobs.set(id, { title: j?.title ?? '', text, state: 'done' });
  renderDlCenter();
  scheduleDlCleanup(id, 10000);
}
export function downloadCenterJobError(id: string, text = 'Ошибка'): void {
  const j = dlJobs.get(id);
  dlJobs.set(id, { title: j?.title ?? '', text, state: 'err' });
  renderDlCenter();
  scheduleDlCleanup(id, 15000);
}
export function downloadCenterJobRemove(id: string): void {
  dlJobs.delete(id);
  const t = dlTimers.get(id);
  if (t) { window.clearTimeout(t); dlTimers.delete(id); }
  renderDlCenter();
}

/** Возвращает центр на body, если SPA-навигация его оторвала (без ре-рендера). */
export function ensureDownloadCenter(): void {
  if (dlJobs.size > 0 && dlCenterEl && !dlCenterEl.isConnected) {
    document.body.appendChild(dlCenterEl);
  }
}

/** Полностью удаляет центр (для тестов/жёсткой очистки). */
export function destroyDownloadCenter(): void {
  dlCenterEl?.remove();
  dlCenterEl = null;
  document.getElementById(DL_CENTER_CSS_ID)?.remove();
  dlJobs.clear();
  dlTimers.forEach(t => window.clearTimeout(t));
  dlTimers.clear();
}

/**
 * Наполняет контейнер строками «● 1080p» для каждого доступного качества.
 * Каждая строка по клику закрывает контейнер (через `onSelect`) и стартует
 * скачивание выбранного URL'а. Возвращает количество добавленных строк.
 */
export function fillQualityRows(
  container: HTMLElement,
  files: VideoQualityFiles,
  baseFilename: string,
  onSelect: () => void,
): number {
  let count = 0;
  for (const q of VIDEO_QUALITIES) {
    const url = files[q.key];
    if (!url) continue;
    count++;

    const row = document.createElement('div');
    Object.assign(row.style, {
      display:    'flex',
      alignItems: 'center',
      gap:        '10px',
      padding:    '9px 14px',
      fontSize:   '13px',
      fontWeight: '500',
      color:      '#1a1a1a',
      cursor:     'pointer',
      transition: 'background 0.1s',
      whiteSpace: 'nowrap',
    });
    row.addEventListener('mouseenter', () => { row.style.background = 'rgba(33,150,255,0.07)'; });
    row.addEventListener('mouseleave', () => { row.style.background = ''; });
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      onSelect();
      requestDownload(url, `${baseFilename}_${q.label}.mp4`);
    });

    const dot = document.createElement('span');
    Object.assign(dot.style, {
      width:        '8px',
      height:       '8px',
      borderRadius: '50%',
      background:   QUALITY_COLORS[q.key] ?? '#9ca3af',
      flexShrink:   '0',
      display:      'inline-block',
    });
    const lbl = document.createElement('span');
    lbl.textContent = q.label;

    row.appendChild(dot);
    row.appendChild(lbl);
    container.appendChild(row);
  }
  return count;
}

/** Базовая разметка/стили дропдауна качества (без позиционирования). */
export const QUALITY_DROPDOWN_CSS = `
  position: fixed;
  background: #fff;
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.2);
  overflow: hidden;
  min-width: 120px;
  z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
`;
