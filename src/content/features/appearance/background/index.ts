import type { FeatureManager } from '@/content/core/feature-manager.js';
import type { FeatureMap, RutubeController } from '@/types/index.js';
import {
  isSafeBackgroundResource,
  isSafeCssColor,
  isValidSettingValue,
} from '@/shared/constants/settings-schema.js';
import { parseVideoUrl, setupRutubeControl, setupYouTubePlayback, setupVimeoPlayback, setupVkPlayback } from '../../utils/videoEmbed.js';

// Prevents CSS injection: escapes characters that could break out of url("...")
function sanitizeCSSUrl(url: string): string {
  return url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Все ключи настроек фона: снимок для рендера + подпись «те же входы». */
export const BACKGROUND_SETTING_KEYS = [
  'custom_background', 'background_type',
  'background_blur', 'background_dim', 'background_opacity',
  'background_brightness', 'background_contrast', 'background_saturation',
  'background_scale', 'background_hue_rotate', 'background_sepia',
  'background_grayscale', 'background_position', 'background_size',
  'background_overlay_color', 'background_overlay_opacity', 'background_vignette',
  'background_video_speed', 'background_video_volume',
] as const;

const safeNumber = (
  settings: Record<string, unknown>,
  key: string,
  fallback: number,
): number => isValidSettingValue(key, settings[key], 'theme')
  ? settings[key] as number
  : fallback;

const safeString = (
  settings: Record<string, unknown>,
  key: string,
  fallback: string,
): string => isValidSettingValue(key, settings[key], 'theme')
  ? settings[key] as string
  : fallback;

export function createBackgroundFeatures(manager: FeatureManager): FeatureMap {
  let rutubeController: RutubeController | null = null;

  const cleanupRutube = () => {
    if (rutubeController) {
      rutubeController.destroy();
      rutubeController = null;
    }
  };

  /**
   * Узкий снимок фоновых настроек: точечные чтения идут из кэша StorageManager.
   * getAllSettings() — это полный IPC-дамп storage (включая base64-обои и
   * логи) на каждый пересчёт — заметная задержка применения.
   */
  const readBackgroundSettings = async (): Promise<Record<string, unknown>> => {
    const entries = await Promise.all(
      BACKGROUND_SETTING_KEYS.map(async (key) => [key, await manager.getSetting(key)] as const),
    );
    return Object.fromEntries(entries);
  };

  /** Подпись входов последнего рендера — идентичный повторный рендер пропускается. */
  let lastRenderSig: string | null = null;

  const reapplyBackground = async () => {
    const settings = await readBackgroundSettings();
    const url = settings.custom_background as string | undefined;
    if (!url) return;
    const handler = manager.getFeatureHandler('custom_background');
    if (handler) await handler.enable(url);
  };

  // Коалесинг перерисовок: на init() каждый truthy background_*-ключ
  // активируется отдельной фичей — без коалесинга это давало до десятка
  // последовательных полных перестроек фона на каждой загрузке (плюс по одной
  // на каждый тик слайдера в попапе). Слитые вызовы дают ОДИН reapply, а
  // подпись входов (см. custom_background.enable) отбрасывает его совсем,
  // если ничего не изменилось.
  let reapplyTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleReapply = (): void => {
    if (reapplyTimer !== undefined) return;
    reapplyTimer = setTimeout(() => { reapplyTimer = undefined; void reapplyBackground(); }, 0);
  };

  const createSettingHandler = () => ({
    enable: scheduleReapply,
    disable: scheduleReapply,
  });

  const clearAllBackgrounds = () => {
    manager.removeCSS('custom_background');
    cleanupRutube();
    ['vkify-video-bg', 'vkify-embed-bg', 'vkify-web-bg', 'vkify-image-bg', 'vkify-bg-container'].forEach(id => {
      document.getElementById(id)?.remove();
    });
  };

  const ensureContainer = () => {
    let container = document.getElementById('vkify-bg-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'vkify-bg-container';
      document.body.prepend(container);
    }
    container.replaceChildren();
    return container;
  };

  const getCommonCSS = (s: Record<string, unknown>) => {
    const dim = safeNumber(s, 'background_dim', 30);
    const vignette = safeNumber(s, 'background_vignette', 0);
    const rawOverlayColor = s.background_overlay_color;
    const overlayColor = isSafeCssColor(rawOverlayColor) ? rawOverlayColor : '';
    const overlayOpacity = safeNumber(s, 'background_overlay_opacity', 0);

    let overlayCSS = '';
    if (overlayColor && overlayOpacity > 0) {
      overlayCSS = `
        #vkify-bg-container::after {
          content: "";
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: 1;
          pointer-events: none;
          background: ${overlayColor};
          opacity: ${(overlayOpacity / 100).toFixed(2)};
        }
      `;
    }

    let vignetteCSS = '';
    if (vignette > 0) {
      vignetteCSS = `
        body::after {
          content: "";
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: -1;
          pointer-events: none;
          background: radial-gradient(
            ellipse at center,
            transparent 0%,
            transparent ${100 - vignette}%,
            rgba(0, 0, 0, ${vignette / 100}) 100%
          );
        }
      `;
    }

    return `
      .ProfileWrapper__root { background: transparent !important; }
      :root, .scroll_fix, #layout_wrapper_root { background: transparent !important; }
      #vkify-bg-container {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        z-index: -3;
        overflow: hidden;
        pointer-events: none;
      }
      #vkify-bg-container::before {
        content: "";
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        z-index: 1;
        background: rgba(0, 0, 0, ${dim / 100});
        pointer-events: none;
      }
      ${overlayCSS}
      ${vignetteCSS}
    `;
  };

  const getFilterCSS = (s: Record<string, unknown>) =>
    `blur(${safeNumber(s, 'background_blur', 0)}px) brightness(${safeNumber(s, 'background_brightness', 100)}%) contrast(${safeNumber(s, 'background_contrast', 100)}%) saturate(${safeNumber(s, 'background_saturation', 100)}%) hue-rotate(${safeNumber(s, 'background_hue_rotate', 0)}deg) sepia(${safeNumber(s, 'background_sepia', 0)}%) grayscale(${safeNumber(s, 'background_grayscale', 0)}%)`;

  const renderImage = (url: string, s: Record<string, unknown>) => {
    clearAllBackgrounds();
    const container = ensureContainer();
    const el = document.createElement('div');
    el.id = 'vkify-image-bg';
    container.appendChild(el);

    manager.injectCSS('custom_background', `
      ${getCommonCSS(s)}
      #vkify-image-bg {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        background-image: url("${sanitizeCSSUrl(url)}");
        background-size: ${safeString(s, 'background_size', 'cover')};
        background-position: ${safeString(s, 'background_position', 'center')};
        background-repeat: no-repeat;
        filter: ${getFilterCSS(s)};
        opacity: ${safeNumber(s, 'background_opacity', 100) / 100};
        transform: scale(${safeNumber(s, 'background_scale', 105) / 100});
      }
    `);
  };

  const renderVideo = (url: string, s: Record<string, unknown>) => {
    clearAllBackgrounds();
    const container = ensureContainer();

    const speed = safeNumber(s, 'background_video_speed', 100) / 100;
    const volume = safeNumber(s, 'background_video_volume', 0) / 100;

    const video = document.createElement('video');
    video.id = 'vkify-video-bg';
    video.loop = true;
    video.playsInline = true;
    // Muted-autoplay: Chrome разрешает автозапуск только по-настоящему
    // приглушённого видео, причём на этапе решения смотрит на АТРИБУТ `muted`,
    // а не на свойство. У динамически созданного элемента одного
    // `video.muted = true` недостаточно — без атрибута автозапуск блокируется и
    // видео висит на первом кадре. Ставим и свойство, и атрибуты до src.
    video.muted = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('autoplay', '');
    video.autoplay = true;
    video.setAttribute('disablePictureInPicture', '');
    video.setAttribute('disableRemotePlayback', '');

    let started = false;
    const startPlayback = (): void => {
      if (started) return;
      started = true;
      video.playbackRate = speed;
      video.play().then(() => {
        // Снимаем mute ТОЛЬКО после успешного старта и лишь если нужна
        // громкость: unmute вне жеста пользователя иначе вернёт видео на паузу.
        if (volume > 0) {
          video.muted = false;
          video.volume = volume;
        }
      }).catch(err => console.warn('[VKify] Autoplay blocked:', err));
    };

    // Слушатель ДО установки src: для кэшированного видео loadedmetadata может
    // выстрелить сразу при присвоении src, и поздняя подписка его пропустит.
    video.addEventListener('loadedmetadata', startPlayback, { once: true });
    video.addEventListener('error', () => {
      console.warn('[VKify] Video background failed to load:', video.error?.message ?? 'unknown error');
      video.remove();
    });

    video.src = url;
    container.appendChild(video);

    // Если метаданные уже готовы (повторный рендер того же URL из кэша),
    // loadedmetadata не повторится — стартуем вручную.
    if (video.readyState >= 1 /* HAVE_METADATA */) startPlayback();

    manager.injectCSS('custom_background', `
      ${getCommonCSS(s)}
      #vkify-video-bg {
        position: absolute;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%) scale(${safeNumber(s, 'background_scale', 105) / 100});
        min-width: 100%;
        min-height: 100%;
        width: auto;
        height: auto;
        object-fit: cover;
        filter: ${getFilterCSS(s)};
        opacity: ${safeNumber(s, 'background_opacity', 100) / 100};
      }
    `);
  };

  const renderEmbed = (url: string, s: Record<string, unknown>) => {
    clearAllBackgrounds();

    const embedData = parseVideoUrl(url);
    if (!embedData) {
      console.warn('[VKify] Could not parse embed URL:', url);
      return;
    }

    const container = ensureContainer();

    const iframe = document.createElement('iframe');
    iframe.id = 'vkify-embed-bg';
    iframe.src = embedData.embedUrl;
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('allowtransparency', 'true');
    iframe.loading = 'eager';
    iframe.dataset.platform = embedData.platform;

    iframe.allow = 'autoplay; encrypted-media; picture-in-picture';

    if (embedData.attributes) {
      Object.entries(embedData.attributes).forEach(([key, value]) => {
        if (key === 'allow') {
          iframe.allow = value as string;
        } else if (typeof value === 'boolean') {
          if (value) iframe.setAttribute(key.toLowerCase(), '');
        } else {
          iframe.setAttribute(key.toLowerCase(), String(value));
        }
      });
    }

    container.appendChild(iframe);

    // autoplay в URL ненадёжен (срезается блокировщиками/расширениями) —
    // стартуем плеер сами через его JS-API после загрузки iframe.
    if (embedData.platform === 'youtube') {
      iframe.addEventListener('load', () => setupYouTubePlayback(iframe), { once: true });
    }

    if (embedData.platform === 'vimeo') {
      iframe.addEventListener('load', () => setupVimeoPlayback(iframe), { once: true });
    }

    if (embedData.platform === 'vk') {
      iframe.addEventListener('load', () => setupVkPlayback(iframe), { once: true });
    }

    if (embedData.platform === 'rutube') {
      iframe.addEventListener('load', () => {
        rutubeController = setupRutubeControl(iframe);

        const volume = safeNumber(s, 'background_video_volume', 0) / 100;
        if (rutubeController) {
          if (volume === 0) {
            rutubeController.mute();
          } else {
            rutubeController.unmute();
            rutubeController.setVolume(volume);
          }
        }
      }, { once: true });
    }

    const platformScale: Record<string, number> = {
      youtube: 1.2, vk: 1.05, rutube: 1.1, twitch: 1.05,
    };
    const extraScale = platformScale[embedData.platform] ?? 1;
    const totalScale = extraScale * (safeNumber(s, 'background_scale', 105) / 100);

    manager.injectCSS('custom_background', `
      ${getCommonCSS(s)}
      #vkify-embed-bg {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 100vw;
        height: 56.25vw;
        min-height: 100vh;
        min-width: 177.78vh;
        transform: translate(-50%, -50%) scale(${totalScale});
        border: none;
        opacity: ${safeNumber(s, 'background_opacity', 100) / 100};
        filter: ${getFilterCSS(s)};
        pointer-events: none;
      }
    `);
  };

  const renderWeb = (url: string, s: Record<string, unknown>) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return;
    }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
      console.warn('[VKify] Rejected unsafe web background URL');
      return;
    }

    clearAllBackgrounds();
    const container = ensureContainer();

    const iframe = document.createElement('iframe');
    iframe.id = 'vkify-web-bg';
    iframe.src = url;
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('allowtransparency', 'true');
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    iframe.loading = 'eager';
    container.appendChild(iframe);

    manager.injectCSS('custom_background', `
      ${getCommonCSS(s)}
      #vkify-web-bg {
        position: absolute;
        top: 0; left: 0;
        width: 100%;
        height: 100%;
        border: none;
        opacity: ${safeNumber(s, 'background_opacity', 100) / 100};
        transform: scale(${safeNumber(s, 'background_scale', 100) / 100});
        transform-origin: center center;
        pointer-events: none;
      }
    `);
  };

  return {
    custom_background: {
      enable: async (url?: unknown) => {
        if (!url) return;
        if (!isSafeBackgroundResource(url)) {
          console.warn('[VKify] Rejected unsafe background resource');
          lastRenderSig = null;
          clearAllBackgrounds();
          return;
        }
        const urlStr = url.trim();
        const s = await readBackgroundSettings();

        // Идентичные входы — DOM не перестраиваем: скоалесированный reapply от
        // включения background_*-ключей на init() становится no-op'ом, а видео
        // не рестартует от «эха» сеттингов.
        const sig = JSON.stringify([urlStr, ...BACKGROUND_SETTING_KEYS.map((k) => s[k])]);
        if (sig === lastRenderSig) return;
        lastRenderSig = sig;

        const type = safeString(s, 'background_type', 'image');

        if (type === 'embed') renderEmbed(urlStr, s);
        else if (type === 'video') renderVideo(urlStr, s);
        else if (type === 'web') renderWeb(urlStr, s);
        else renderImage(urlStr, s);
      },
      disable: () => {
        lastRenderSig = null;
        clearAllBackgrounds();
      },
    },

    background_type: createSettingHandler(),
    background_blur: createSettingHandler(),
    background_dim: createSettingHandler(),
    background_opacity: createSettingHandler(),
    background_brightness: createSettingHandler(),
    background_contrast: createSettingHandler(),
    background_saturation: createSettingHandler(),
    background_scale: createSettingHandler(),
    background_hue_rotate: createSettingHandler(),
    background_sepia: createSettingHandler(),
    background_grayscale: createSettingHandler(),
    background_position: createSettingHandler(),
    background_size: createSettingHandler(),
    background_overlay_color: createSettingHandler(),
    background_overlay_opacity: createSettingHandler(),
    background_vignette: createSettingHandler(),

    background_video_speed: {
      enable: async () => {
        const speed = await manager.getSetting<number>('background_video_speed');
        const video = document.getElementById('vkify-video-bg') as HTMLVideoElement | null;
        if (video) video.playbackRate = (speed ?? 100) / 100;
      },
      disable: () => { /* no-op */ },
    },

    background_video_volume: {
      enable: async () => {
        const volume = await manager.getSetting<number>('background_video_volume');
        const vol = (volume ?? 0) / 100;

        const video = document.getElementById('vkify-video-bg') as HTMLVideoElement | null;
        if (video) {
          video.volume = vol;
          video.muted = vol === 0;
        }

        if (rutubeController) {
          if (vol === 0) {
            rutubeController.mute();
          } else {
            rutubeController.unmute();
            rutubeController.setVolume(vol);
          }
        }

        const embed = document.getElementById('vkify-embed-bg') as HTMLIFrameElement | null;
        if (embed && embed.dataset.platform !== 'rutube') {
          const platform = embed.dataset.platform;
          const currentSrc = embed.src;

          if (platform === 'youtube' || platform === 'vk') {
            const newSrc = vol === 0
              ? currentSrc.replace(/&mute=\d/, '&mute=1')
              : currentSrc.replace(/&mute=\d/, '&mute=0');
            if (newSrc !== currentSrc) embed.src = newSrc;
          }
        }
      },
      disable: () => { /* no-op */ },
    },
  };
}
