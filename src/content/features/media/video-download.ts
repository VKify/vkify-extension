import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap } from '../../../types/index.js';
import { vkApi } from '../../api/vk-api-client.js';

const CONTAINER_ID = 'vkify-video-dl';
const STYLE_ID     = 'vkify-video-dl-style';

const QUALITY_COLORS: Record<string, string> = {
  mp4_1080: '#a855f7',
  mp4_720:  '#3b82f6',
  mp4_480:  '#06b6d4',
  mp4_360:  '#10b981',
  mp4_240:  '#9ca3af',
};

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

const QUALITIES = [
  { key: 'mp4_1080' as const, label: '1080p' },
  { key: 'mp4_720'  as const, label: '720p'  },
  { key: 'mp4_480'  as const, label: '480p'  },
  { key: 'mp4_360'  as const, label: '360p'  },
  { key: 'mp4_240'  as const, label: '240p'  },
];

/** Extracts ownerId and videoId from a vkvideo.ru URL path. */
function parseVideoIds(pathname: string): { ownerId: number; videoId: number } | null {
  const m = pathname.match(/\/video(-?\d+)_(\d+)/);
  if (!m) return null;
  return { ownerId: Number(m[1]), videoId: Number(m[2]) };
}

function removeUI(): void {
  document.getElementById(CONTAINER_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
}

/** Calls video.get to retrieve direct MP4 download URLs. */
async function fetchVideoData(
  ownerId: number,
  videoId: number,
): Promise<{ files: VideoFiles; title: string } | null> {
  try {
    const resp = await vkApi.call('video.get', {
      videos:   `${ownerId}_${videoId}`,
      extended: 0,
    }) as VideoGetResponse;

    const item = resp?.items?.[0];
    if (!item) return null;

    return { files: item.files ?? {}, title: item.title ?? 'video' };
  } catch {
    return null;
  }
}

/** Strips characters that are invalid in file names. */
function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').slice(0, 180);
}

/** Injects a floating download button with a quality dropdown into the page. */
function injectButton(files: VideoFiles, title: string): void {
  removeUI();

  const available = QUALITIES.filter(q => files[q.key]);
  if (available.length === 0) return; // no downloadable MP4 streams for this video

  // ── Keyframe animation style ────────────────────────────────────────────
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes vkify-pulse {
      0%   { box-shadow: 0 4px 20px rgba(33,150,255,0.55), 0 0 0 0 rgba(33,150,255,0.4); }
      70%  { box-shadow: 0 4px 20px rgba(33,150,255,0.55), 0 0 0 10px rgba(33,150,255,0); }
      100% { box-shadow: 0 4px 20px rgba(33,150,255,0.55), 0 0 0 0 rgba(33,150,255,0); }
    }
    @keyframes vkify-fadein {
      from { opacity: 0; transform: translateY(6px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    #${CONTAINER_ID} button {
      animation: vkify-pulse 2.2s ease-out infinite;
    }
    #${CONTAINER_ID} button:hover {
      animation: none !important;
      box-shadow: 0 6px 28px rgba(33,150,255,0.7) !important;
      transform: scale(1.04) !important;
    }
    #${CONTAINER_ID} .__vkify-dd {
      animation: vkify-fadein 0.15s ease;
    }
  `;
  document.head.appendChild(style);

  // ── Root wrapper ────────────────────────────────────────────────────────
  const root = document.createElement('div');
  root.id = CONTAINER_ID;
  Object.assign(root.style, {
    position:   'fixed',
    bottom:     '24px',
    right:      '24px',
    zIndex:     '2147483647',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  });

  // ── Quality dropdown ────────────────────────────────────────────────────
  const dropdown = document.createElement('div');
  dropdown.className = '__vkify-dd';
  Object.assign(dropdown.style, {
    display:      'none',
    position:     'absolute',
    bottom:       'calc(100% + 10px)',
    right:        '0',
    background:   '#fff',
    border:       '1px solid rgba(0,0,0,0.07)',
    borderRadius: '14px',
    boxShadow:    '0 12px 32px rgba(0,0,0,0.18)',
    overflow:     'hidden',
    minWidth:     '130px',
  });

  for (const q of available) {
    const url = files[q.key]!;
    const row = document.createElement('div');
    Object.assign(row.style, {
      display:    'flex',
      alignItems: 'center',
      gap:        '10px',
      padding:    '10px 16px',
      fontSize:   '13px',
      fontWeight: '500',
      color:      '#1a1a1a',
      cursor:     'pointer',
      transition: 'background 0.1s',
    });

    // Color dot
    const dot = document.createElement('span');
    Object.assign(dot.style, {
      width:        '8px',
      height:       '8px',
      borderRadius: '50%',
      flexShrink:   '0',
      background:   QUALITY_COLORS[q.key] ?? '#9ca3af',
    });

    const label = document.createElement('span');
    label.textContent = q.label;

    row.appendChild(dot);
    row.appendChild(label);

    row.addEventListener('mouseenter', () => { row.style.background = 'rgba(33,150,255,0.07)'; });
    row.addEventListener('mouseleave', () => { row.style.background = ''; });
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.style.display = 'none';
      open = false;
      void chrome.runtime.sendMessage({
        type:     'DOWNLOAD_VIDEO',
        url,
        filename: `${sanitizeFilename(title)}_${q.label}.mp4`,
      });
    });
    dropdown.appendChild(row);
  }

  // ── Main button ─────────────────────────────────────────────────────────
  const btn = document.createElement('button');
  Object.assign(btn.style, {
    display:        'flex',
    alignItems:     'center',
    gap:            '7px',
    background:     'linear-gradient(135deg, #2196ff 0%, #0050cc 100%)',
    color:          '#fff',
    border:         'none',
    padding:        '10px 18px 10px 14px',
    borderRadius:   '12px',
    cursor:         'pointer',
    fontSize:       '13px',
    fontWeight:     '700',
    letterSpacing:  '0.01em',
    whiteSpace:     'nowrap',
    transition:     'transform 0.15s, box-shadow 0.15s',
    outline:        'none',
    userSelect:     'none',
  });

  // VKify logo SVG (inline, no innerHTML)
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 231 148');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('xmlns', svgNS);
  Object.assign(svg.style, { width: '18px', height: '12px', flexShrink: '0' });

  const p1 = document.createElementNS(svgNS, 'path');
  p1.setAttribute('d', 'M73.711 1.83982L97.0564 57.5097C97.9202 59.5696 100.652 59.9968 102.103 58.2988L151.041 1.05066C151.611 0.383902 152.444 0 153.322 0H221.115C223.645 0 225.039 2.93882 223.438 4.898L107.853 146.382C107.275 147.089 106.408 147.494 105.496 147.484L63.8875 147.022C62.7028 147.008 61.6367 146.299 61.1668 145.211L0.249245 4.18967C-0.606304 2.2091 0.845833 0 3.00328 0H70.9444C72.153 0 73.2436 0.725252 73.711 1.83982Z');
  p1.setAttribute('fill', 'currentColor');

  const p2 = document.createElementNS(svgNS, 'path');
  p2.setAttribute('d', 'M138.702 122.916L173.168 82.1842C174.36 80.7756 176.529 80.7667 177.733 82.1655L229.675 142.544C231.349 144.488 229.967 147.5 227.401 147.5H160.202C159.395 147.5 158.621 147.175 158.057 146.597L138.848 126.952C137.766 125.845 137.703 124.098 138.702 122.916Z');
  p2.setAttribute('fill', 'currentColor');

  svg.appendChild(p1);
  svg.appendChild(p2);

  // Button label
  const btnLabel = document.createElement('span');
  btnLabel.textContent = 'Скачать';

  // Chevron indicator
  const chevron = document.createElement('span');
  chevron.textContent = '▾';
  Object.assign(chevron.style, { fontSize: '11px', opacity: '0.75', marginLeft: '1px' });

  btn.appendChild(svg);
  btn.appendChild(btnLabel);
  btn.appendChild(chevron);

  let open = false;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    open = !open;
    // Re-trigger fadein animation by forcing reflow
    if (open) {
      dropdown.style.display = 'none';
      dropdown.className = '';
      void dropdown.offsetWidth; // reflow
      dropdown.className = '__vkify-dd';
      dropdown.style.display = 'block';
    } else {
      dropdown.style.display = 'none';
    }
    chevron.textContent = open ? '▴' : '▾';
  });

  const closeDropdown = (): void => {
    if (open) {
      open = false;
      dropdown.style.display = 'none';
      chevron.textContent = '▾';
    }
  };
  document.addEventListener('click', closeDropdown);

  // Clean up the global listener when button is removed
  const observer = new MutationObserver(() => {
    if (!document.contains(root)) {
      document.removeEventListener('click', closeDropdown);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true });

  root.appendChild(dropdown);
  root.appendChild(btn);
  document.body.appendChild(root);
}

export function createVideoDownloadFeature(_manager: FeatureManager): FeatureMap {
  return {
    video_download: {
      reapplyOnNavigate: true,

      enable: async () => {
        // Feature is registered globally but only activates on vkvideo.ru video pages.
        if (window.location.hostname !== 'vkvideo.ru') { removeUI(); return; }

        const ids = parseVideoIds(window.location.pathname);
        if (!ids) { removeUI(); return; }

        const startPath = window.location.pathname;

        // First attempt — may fail if the token isn't ready yet on initial page load.
        let data = await fetchVideoData(ids.ownerId, ids.videoId);

        // Retry once after a short delay (covers the case where the token
        // is still being negotiated on a fresh page load).
        if (!data) {
          await new Promise<void>(r => setTimeout(r, 3000));
          if (window.location.pathname !== startPath) return; // navigation happened meanwhile
          data = await fetchVideoData(ids.ownerId, ids.videoId);
        }

        if (window.location.pathname !== startPath) return;
        if (data) injectButton(data.files, data.title);
      },

      disable: () => {
        removeUI();
      },
    },
  };
}
