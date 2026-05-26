/**
 * Скачивание клипов VK.
 *
 * Клипы — это вертикальные короткие видео (TikTok-стиль), доступны на
 *   • https://vk.com/clip<owner>_<id>
 *   • https://vk.com/clips...
 *   • https://vkvideo.ru/clip<owner>_<id>
 *   • https://vkvideo.ru/clips...
 *
 * Кнопка добавляется в правую панель управления (`clips-feed-controls`)
 * рядом с лайком, с той же вёрсткой VKUI (`vkitRoundedGroupItem__root`).
 * Идентификатор активного клипа берётся из URL `/clip<owner>_<id>` —
 * VK обновляет path через pushState при свайпе между клипами.
 * Фолбэк — `data-snap-key` карточки, у которой видео-контейнер
 * не помечен `playerContainerHidden`.
 *
 * При клике лениво запрашиваем прямые ссылки через `video.get`,
 * показываем дропдаун качества (1080p…240p) рядом с кнопкой и отправляем
 * URL в background — он скачивает через `chrome.downloads`.
 */

import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap } from '../../../types/index.js';
import { vkApi } from '../../api/vk-api-client.js';

const BTN_ID       = 'vkify-clip-dl-btn';
const DROPDOWN_ID  = 'vkify-clip-dl-dd';
const STYLE_ID     = 'vkify-clip-dl-style';
const POLL_INTERVAL = 600;

const QUALITY_COLORS: Record<string, string> = {
  mp4_1080: '#a855f7',
  mp4_720:  '#3b82f6',
  mp4_480:  '#06b6d4',
  mp4_360:  '#10b981',
  mp4_240:  '#9ca3af',
};

const QUALITIES = [
  { key: 'mp4_1080' as const, label: '1080p' },
  { key: 'mp4_720'  as const, label: '720p'  },
  { key: 'mp4_480'  as const, label: '480p'  },
  { key: 'mp4_360'  as const, label: '360p'  },
  { key: 'mp4_240'  as const, label: '240p'  },
];

interface VideoFiles {
  mp4_1080?: string;
  mp4_720?:  string;
  mp4_480?:  string;
  mp4_360?:  string;
  mp4_240?:  string;
}

interface VideoItem {
  title?: string;
  files?: VideoFiles;
}

interface VideoGetResponse {
  count: number;
  items: VideoItem[];
}

// ── Утилиты ─────────────────────────────────────────────────────────────────

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').slice(0, 180);
}

/** Активна только на /clip* / /clips* (vk.com, vk.ru, vkvideo.ru). */
function isClipsPage(): boolean {
  const host = window.location.hostname;
  if (host !== 'vk.com' && host !== 'vk.ru' && host !== 'vkvideo.ru') return false;
  return /^\/clips?(?:[-_/]|$)/.test(window.location.pathname);
}

/**
 * Идентификатор клипа, который пользователь сейчас смотрит.
 *   1. Сначала пробуем URL — VK обновляет path при свайпе между клипами.
 *   2. Иначе ищем карточку с активным (не-hidden) videoContainer'ом.
 */
function findActiveClipId(): { ownerId: number; videoId: number } | null {
  const m = window.location.pathname.match(/\/clip(-?\d+)_(\d+)/);
  if (m) return { ownerId: Number(m[1]), videoId: Number(m[2]) };

  for (const card of document.querySelectorAll<HTMLElement>('[data-snap-key]')) {
    const player = card.querySelector('[class*="vkitClipPlayerContainer__playerContainer"]');
    if (!player) continue;
    const hidden = Array.from(player.classList).some(c => c.includes('playerContainerHidden'));
    if (hidden) continue;
    const key = card.getAttribute('data-snap-key') ?? '';
    const km = key.match(/^(-?\d+)_(\d+)$/);
    if (km) return { ownerId: Number(km[1]), videoId: Number(km[2]) };
  }
  return null;
}

// ── API ─────────────────────────────────────────────────────────────────────

/** Кэш по "owner_id" → промис с данными video.get. null-ответы не кэшируем. */
const fetchCache = new Map<string, Promise<VideoItem | null>>();

async function fetchClipData(ownerId: number, videoId: number): Promise<VideoItem | null> {
  const key = `${ownerId}_${videoId}`;
  let pending = fetchCache.get(key);
  if (pending) return pending;

  pending = (async () => {
    try {
      const resp = await vkApi.call('video.get', {
        videos:   key,
        extended: 0,
      }) as VideoGetResponse;
      return resp?.items?.[0] ?? null;
    } catch {
      return null;
    }
  })();
  fetchCache.set(key, pending);

  const result = await pending;
  if (result === null) fetchCache.delete(key);
  return result;
}

// ── Стили ──────────────────────────────────────────────────────────────────

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes vkify-clip-dd-fadein {
      from { opacity: 0; transform: translateY(-4px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0)    scale(1);    }
    }
    #${DROPDOWN_ID} {
      position: fixed;
      background: #fff;
      border: 1px solid rgba(0,0,0,0.08);
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      overflow: hidden;
      min-width: 120px;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      animation: vkify-clip-dd-fadein 0.12s ease;
    }
    #${BTN_ID}[disabled] {
      opacity: 0.5;
      cursor: wait;
    }
  `;
  document.head.appendChild(style);
}

// ── Дропдаун качества ──────────────────────────────────────────────────────

function closeDropdown(): void {
  document.getElementById(DROPDOWN_ID)?.remove();
}

function openDropdown(btn: HTMLButtonElement, item: VideoItem, ids: { ownerId: number; videoId: number }): void {
  closeDropdown();

  const files = item.files ?? {};
  const available = QUALITIES.filter(q => files[q.key]);
  if (available.length === 0) return;

  const dropdown = document.createElement('div');
  dropdown.id = DROPDOWN_ID;

  const baseFilename = item.title
    ? sanitizeFilename(item.title)
    : `clip_${ids.ownerId}_${ids.videoId}`;

  for (const q of available) {
    const url = files[q.key]!;
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
      closeDropdown();
      void chrome.runtime.sendMessage({
        type:     'DOWNLOAD_VIDEO',
        url,
        filename: `${baseFilename}_${q.label}.mp4`,
      });
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
    dropdown.appendChild(row);
  }

  // Панель управления справа, дропдаун открываем СЛЕВА от кнопки (right-aligned).
  const rect = btn.getBoundingClientRect();
  const top  = Math.min(rect.top, window.innerHeight - 250);
  dropdown.style.top   = `${top}px`;
  dropdown.style.right = `${window.innerWidth - rect.left + 8}px`;
  document.body.appendChild(dropdown);
}

// ── Инжект кнопки ──────────────────────────────────────────────────────────

/** SVG-иконка скачивания, 28×28 (под размер VKUI-иконок в панели клипов). */
function buildDownloadIcon(): SVGSVGElement {
  const ns  = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('display', 'block');
  svg.setAttribute('width', '28');
  svg.setAttribute('height', '28');
  svg.setAttribute('viewBox', '0 0 28 28');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('style', 'width: 28px; height: 28px;');
  svg.setAttribute('class', 'vkuiIcon vkuiIcon--28 vkuiIcon--w-28 vkuiIcon--h-28');
  // Стрелка вниз с подложкой — стилизована под material-style.
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('fill-rule', 'evenodd');
  path.setAttribute('clip-rule', 'evenodd');
  path.setAttribute(
    'd',
    'M14 3a1 1 0 0 1 1 1v11.586l3.293-3.293a1 1 0 0 1 1.414 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L13 15.586V4a1 1 0 0 1 1-1Zm-8 19a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Z',
  );
  svg.appendChild(path);
  return svg;
}

/**
 * Создаёт кнопку с такой же вёрсткой, как у соседних кнопок в группе
 * (лайк/коммент/шер/диз/more). Структура копируется из like-кнопки,
 * чтобы наследовались все классы темы VKUI и corner spacing.
 */
function injectControlButton(): void {
  if (document.getElementById(BTN_ID)) return;

  const controls = document.querySelector('[data-testid="clips-feed-controls"]');
  if (!controls) return;

  // Первая группа — like/comment/share/dislike/more. Не вторая (prev/next).
  const group = controls.querySelector('[data-testid="roundedgroup"]');
  if (!group) return;

  // Берём like-кнопку как шаблон классов (она всегда есть).
  const refButton = group.querySelector<HTMLButtonElement>('[data-testid="clips-controls-like-button"]');
  if (!refButton) return;

  // Контейнер кнопки — то же, что у more-button (без bottom-counter):
  //   <div class="vkitRoundedGroupItem__root--... vkitRoundedGroupItem__rootBorder--...">
  //     <button ...>...</button>
  //   </div>
  const refInnerRoot = refButton.parentElement;
  if (!refInnerRoot) return;

  injectStyle();

  const inner = document.createElement('div');
  inner.className = refInnerRoot.className;
  inner.setAttribute('style', '--rounded-spacing: 0px;');

  const btn = document.createElement('button');
  btn.id        = BTN_ID;
  btn.type      = 'button';
  btn.className = refButton.className;
  btn.setAttribute('data-testid', 'clips-controls-vkify-download');
  btn.setAttribute('style', 'width: 52px; height: 52px; min-width: 52px; min-height: 52px;');
  btn.title     = 'Скачать клип';

  const a11y = document.createElement('span');
  a11y.className = 'vkuiVisuallyHidden__host vkuiRootComponent__host';
  a11y.textContent = 'Скачать клип';
  btn.appendChild(a11y);

  btn.appendChild(buildDownloadIcon());

  const ripple = document.createElement('span');
  ripple.setAttribute('aria-hidden', 'true');
  ripple.className = 'vkuiTappable__stateLayer vkuiTappable__ripple';
  btn.appendChild(ripple);

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const ids = findActiveClipId();
    if (!ids) return;

    btn.disabled = true;
    try {
      const data = await fetchClipData(ids.ownerId, ids.videoId);
      if (!data || !data.files) return;
      openDropdown(btn, data, ids);
    } finally {
      btn.disabled = false;
    }
  });

  inner.appendChild(btn);

  // Вставляем в самое начало группы — перед like.
  // Если ref-обёртка имеет родителя `vkitRoundedGroupItem__wrapper` (с count),
  // встраиваем перед ним; иначе перед самим inner-root.
  const refWrapper = refInnerRoot.parentElement;
  const anchor = (refWrapper && refWrapper.parentElement === group) ? refWrapper : refInnerRoot;
  group.insertBefore(inner, anchor);
}

function removeButton(): void {
  document.getElementById(BTN_ID)?.parentElement?.remove();
  document.getElementById(STYLE_ID)?.remove();
  closeDropdown();
}

// ── FeatureMap export ──────────────────────────────────────────────────────

export function createClipDownloadFeature(_manager: FeatureManager): FeatureMap {
  let observer:     MutationObserver | null = null;
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let clickHandler: ((e: MouseEvent) => void) | null = null;
  let lastPath:     string = '';

  function start(): void {
    lastPath = window.location.pathname;
    injectControlButton();

    // Реагируем на появление/перерисовку панели управления.
    observer = new MutationObserver(() => {
      // Если URL клипа сменился — сбрасываем кэш кнопки (не самих API-данных),
      // чтобы дропдаун открывался для НОВОГО клипа.
      if (window.location.pathname !== lastPath) {
        lastPath = window.location.pathname;
        closeDropdown();
      }
      injectControlButton();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Polling — страховка от случаев, когда React перерисовал панель без
    // mutation на body (виртуализация, suspense и т.п.).
    pollInterval = setInterval(() => {
      if (window.location.pathname !== lastPath) {
        lastPath = window.location.pathname;
        closeDropdown();
      }
      injectControlButton();
    }, POLL_INTERVAL);

    clickHandler = (e: MouseEvent) => {
      const dd = document.getElementById(DROPDOWN_ID);
      if (!dd) return;
      if (e.target instanceof Node && dd.contains(e.target)) return;
      closeDropdown();
    };
    document.addEventListener('click', clickHandler);
  }

  function stop(): void {
    observer?.disconnect();
    observer = null;
    if (pollInterval !== null) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    if (clickHandler) {
      document.removeEventListener('click', clickHandler);
      clickHandler = null;
    }
    fetchCache.clear();
    removeButton();
  }

  return {
    clip_download: {
      reapplyOnNavigate: true,

      enable: () => {
        stop();
        if (!isClipsPage()) return;
        start();
      },

      disable: () => { stop(); },
    },
  };
}