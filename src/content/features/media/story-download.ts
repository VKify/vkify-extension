import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap } from '../../../types/index.js';
import { vkApi } from '../../api/vk-api-client.js';

const BUTTON_ID   = 'vkify-story-dl-btn';
const DROPDOWN_ID = 'vkify-story-dl-dd';
const STYLE_ID    = 'vkify-story-dl-style';

const QUALITY_COLORS: Record<string, string> = {
  mp4_1080: '#a855f7',
  mp4_720:  '#3b82f6',
  mp4_480:  '#06b6d4',
  mp4_360:  '#10b981',
  mp4_240:  '#9ca3af',
};

const VIDEO_QUALITIES = [
  { key: 'mp4_1080' as const, label: '1080p' },
  { key: 'mp4_720'  as const, label: '720p'  },
  { key: 'mp4_480'  as const, label: '480p'  },
  { key: 'mp4_360'  as const, label: '360p'  },
  { key: 'mp4_240'  as const, label: '240p'  },
];

interface PhotoSize {
  url: string;
  width: number;
  type: string;
}

interface StoryVideoFiles {
  mp4_1080?: string;
  mp4_720?:  string;
  mp4_480?:  string;
  mp4_360?:  string;
  mp4_240?:  string;
}

interface StoryItem {
  id: number;
  owner_id: number;
  type: 'photo' | 'video';
  photo?: { sizes: PhotoSize[] };
  video?: { title?: string; files?: StoryVideoFiles };
}

interface StoriesGetByIdResponse {
  count: number;
  items: StoryItem[];
}

/** Module-level reference to the current dropdown close handler so removeUI()
 *  can always de-register it from the document, regardless of call site. */
let _closeDropdown: (() => void) | null = null;

/** Parses ownerId and storyId from the VK feed URL ?w= query param.
 *  Handles: ?w=story-213482001_456240063%2Ffeed  →  { ownerId: -213482001, storyId: 456240063 }
 */
function parseStoryIds(search: string): { ownerId: number; storyId: number } | null {
  const w = new URLSearchParams(search).get('w');
  if (!w) return null;
  const m = w.match(/^story(-?\d+)_(\d+)/);
  if (!m) return null;
  return { ownerId: Number(m[1]), storyId: Number(m[2]) };
}

/** Returns the parentElement of the ⋯ menu button inside the active story card. */
function findActionsContainer(): Element | null {
  return (
    document
      .querySelector('[data-testid="stories-gallery-selected-item"] [data-testid="stories_viewer_menu_icon"]')
      ?.parentElement ?? null
  );
}

function removeUI(): void {
  document.getElementById(BUTTON_ID)?.remove();
  document.getElementById(DROPDOWN_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
  if (_closeDropdown) {
    document.removeEventListener('click', _closeDropdown);
    _closeDropdown = null;
  }
}

/** Calls stories.getById and returns the story item. */
async function fetchStoryData(
  ownerId: number,
  storyId: number,
): Promise<StoryItem | null> {
  try {
    const resp = await vkApi.call('stories.getById', {
      stories:  `${ownerId}_${storyId}`,
      extended: 0,
    }) as StoriesGetByIdResponse;

    return resp?.items?.[0] ?? null;
  } catch {
    return null;
  }
}

/** Returns the URL of the largest available photo size. */
function getBestPhotoUrl(sizes: PhotoSize[]): string | null {
  if (!sizes.length) return null;
  return [...sizes].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0].url;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').slice(0, 180);
}

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${BUTTON_ID} {
      background: transparent;
      border: none;
      color: #fff;
      width: 40px;
      height: 40px;
      min-width: 40px;
      min-height: 40px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background 0.1s;
      padding: 0;
      outline: none;
      flex-shrink: 0;
    }
    #${BUTTON_ID}:hover {
      background: rgba(255,255,255,0.15);
    }
    @keyframes vkify-s-dd-fadein {
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
      animation: vkify-s-dd-fadein 0.12s ease;
    }
  `;
  document.head.appendChild(style);
}

/** Download arrow icon (Material-style, 24×24). */
function buildDownloadIcon(): SVGSVGElement {
  const ns  = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');
  Object.assign(svg.style, { width: '24px', height: '24px', display: 'block' });

  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z');
  svg.appendChild(path);
  return svg;
}

/**
 * Creates the download button and inserts it before the ⋯ menu button.
 * Returns null if the actions container is not in the DOM yet.
 */
function createHeaderButton(): HTMLButtonElement | null {
  const actionsContainer = findActionsContainer();
  if (!actionsContainer) return null;

  injectStyle();

  const btn = document.createElement('button');
  btn.id    = BUTTON_ID;
  btn.type  = 'button';
  btn.title = 'Скачать сторис';
  btn.appendChild(buildDownloadIcon());

  const menuBtn = actionsContainer.querySelector('[data-testid="stories_viewer_menu_icon"]');
  actionsContainer.insertBefore(btn, menuBtn ?? null);

  return btn;
}

// ── Photo button (single click → download) ─────────────────────────────────

function injectPhotoButton(url: string, ownerId: number, storyId: number): void {
  const btn = createHeaderButton();
  if (!btn) return;

  btn.addEventListener('click', () => {
    void chrome.runtime.sendMessage({
      type:     'DOWNLOAD_VIDEO',
      url,
      filename: `story_${ownerId}_${storyId}.jpg`,
    });
  });
}

// ── Video button (click → quality dropdown) ────────────────────────────────

function injectVideoButton(
  files: StoryVideoFiles,
  ownerId: number,
  storyId: number,
  title?: string,
): void {
  const available = VIDEO_QUALITIES.filter(q => files[q.key]);
  if (available.length === 0) return;

  const btn = createHeaderButton();
  if (!btn) return;

  const baseFilename = title
    ? sanitizeFilename(title)
    : `story_${ownerId}_${storyId}`;

  let open = false;

  const closeDropdown = (): void => {
    if (!open) return;
    open = false;
    document.getElementById(DROPDOWN_ID)?.remove();
  };

  // Store at module level so removeUI() can clean it up even after navigation.
  _closeDropdown = closeDropdown;
  document.addEventListener('click', closeDropdown);

  btn.addEventListener('click', (e) => {
    e.stopPropagation();

    if (open) {
      closeDropdown();
      return;
    }

    open = true;

    const dropdown = document.createElement('div');
    dropdown.id = DROPDOWN_ID;

    for (const q of available) {
      const qUrl = files[q.key]!;

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
      row.addEventListener('click', (ev) => {
        ev.stopPropagation();
        closeDropdown();
        void chrome.runtime.sendMessage({
          type:     'DOWNLOAD_VIDEO',
          url:      qUrl,
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

    // Position the dropdown below the button, right-aligned.
    // Using position:fixed + getBoundingClientRect() avoids clipping from
    // overflow:hidden ancestors in VK's story viewer.
    const rect = btn.getBoundingClientRect();
    dropdown.style.top   = `${rect.bottom + 6}px`;
    dropdown.style.right = `${window.innerWidth - rect.right}px`;

    document.body.appendChild(dropdown);
  });
}

// ── Shared injection entry-point ───────────────────────────────────────────

function injectFromData(story: StoryItem, ids: { ownerId: number; storyId: number }): void {
  removeUI();

  if (story.type === 'photo' && story.photo) {
    const url = getBestPhotoUrl(story.photo.sizes);
    if (url) injectPhotoButton(url, ids.ownerId, ids.storyId);
  } else if (story.type === 'video' && story.video?.files) {
    injectVideoButton(story.video.files, ids.ownerId, ids.storyId, story.video.title);
  }
}

// ── Feature export ──────────────────────────────────────────────────────────

export function createStoryDownloadFeature(_manager: FeatureManager): FeatureMap {
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  // Monotonically increasing counter — each new story navigation bumps it so
  // in-flight fetches from the previous story can detect they're stale.
  let generation = 0;

  // Cache of the last successfully fetched story + its IDs so we can re-inject
  // the button if VK re-renders the story card without navigating.
  let cachedStory: StoryItem | null = null;
  let cachedIds: { ownerId: number; storyId: number } | null = null;

  /**
   * Core logic: fetch story data for `search` and inject the download button.
   * Bails out early whenever `generation` no longer matches `myGen`, which
   * means the user navigated to a different story while we were awaiting.
   */
  async function runInject(search: string, myGen: number): Promise<void> {
    const ids = parseStoryIds(search);
    if (!ids) {
      removeUI();
      cachedStory = null;
      cachedIds   = null;
      return;
    }

    cachedIds = ids;

    let story = await fetchStoryData(ids.ownerId, ids.storyId);

    if (myGen !== generation) return; // superseded

    if (!story) {
      // Retry once — token may not be ready on a cold page load.
      await new Promise<void>(r => setTimeout(r, 2000));
      if (myGen !== generation) return;
      story = await fetchStoryData(ids.ownerId, ids.storyId);
    }

    if (myGen !== generation) return;
    if (!story) return;

    cachedStory = story;
    injectFromData(story, ids);
  }

  function stopPoll(): void {
    if (pollInterval !== null) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  return {
    story_download: {
      reapplyOnNavigate: true,

      enable: async () => {
        stopPoll();
        generation++;
        removeUI();
        cachedStory = null;
        cachedIds   = null;

        const { hostname } = window.location;
        if (hostname !== 'vk.com' && hostname !== 'vk.ru') return;

        // ── Poll for URL / DOM changes every 300 ms ──────────────────────────
        // VK's story viewer navigates via pushState / replaceState calls that
        // originate inside the page's own JS context. Content-script patches on
        // `history` are unreliable across the isolated-world boundary, so we
        // simply read location.search on a tight interval instead.
        //
        // The same poll also detects when VK re-renders the story card and
        // removes our button, then re-injects it from cache within 300 ms.
        let lastSearch = window.location.search;

        // Kick off fetch for the story that is already open (if any).
        void runInject(lastSearch, generation);

        pollInterval = setInterval(() => {
          const current = window.location.search;

          if (current !== lastSearch) {
            // User navigated to a different story.
            lastSearch  = current;
            generation++;
            cachedStory = null;
            cachedIds   = null;
            removeUI();
            void runInject(current, generation);
          } else if (cachedStory && cachedIds && !document.getElementById(BUTTON_ID)) {
            // Same story, but VK re-rendered the card and our button is gone.
            injectFromData(cachedStory, cachedIds);
          }
        }, 300);
        // ────────────────────────────────────────────────────────────────────
      },

      disable: () => {
        stopPoll();
        generation++;
        removeUI();
        cachedStory = null;
        cachedIds   = null;
      },
    },
  };
}
