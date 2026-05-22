import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap, RutubeController } from '../../../types/index.js';
import { parseVideoUrl, setupRutubeControl } from '../utils/videoEmbed.js';

// Prevents CSS injection: escapes characters that could break out of url("...")
function sanitizeCSSUrl(url: string): string {
  return url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function createBackgroundFeatures(manager: FeatureManager): FeatureMap {
  let rutubeController: RutubeController | null = null;

  const cleanupRutube = () => {
    if (rutubeController) {
      rutubeController.destroy();
      rutubeController = null;
    }
  };

  const reapplyBackground = async () => {
    const settings = await manager.getAllSettings();
    const url = settings.custom_background as string | undefined;
    if (!url) return;
    const handler = manager.getFeatureHandler('custom_background');
    if (handler) await handler.enable(url);
  };

  const createSettingHandler = () => ({
    enable: reapplyBackground,
    disable: reapplyBackground,
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
    container.innerHTML = '';
    return container;
  };

  const getCommonCSS = (s: Record<string, unknown>) => {
    const dim = (s.background_dim as number) ?? 30;
    const vignette = (s.background_vignette as number) ?? 0;
    const overlayColor = (s.background_overlay_color as string) ?? '';
    const overlayOpacity = (s.background_overlay_opacity as number) ?? 0;

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
    `blur(${(s.background_blur as number) ?? 0}px) brightness(${(s.background_brightness as number) ?? 100}%) contrast(${(s.background_contrast as number) ?? 100}%) saturate(${(s.background_saturation as number) ?? 100}%) hue-rotate(${(s.background_hue_rotate as number) ?? 0}deg) sepia(${(s.background_sepia as number) ?? 0}%) grayscale(${(s.background_grayscale as number) ?? 0}%)`;

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
        background-size: ${(s.background_size as string) ?? 'cover'};
        background-position: ${(s.background_position as string) ?? 'center'};
        background-repeat: no-repeat;
        filter: ${getFilterCSS(s)};
        opacity: ${((s.background_opacity as number) ?? 100) / 100};
        transform: scale(${((s.background_scale as number) ?? 105) / 100});
      }
    `);
  };

  const renderVideo = (url: string, s: Record<string, unknown>) => {
    clearAllBackgrounds();
    const container = ensureContainer();

    const video = document.createElement('video');
    video.id = 'vkify-video-bg';
    video.autoplay = true;
    video.loop = true;
    video.playsInline = true;
    video.muted = true;
    video.setAttribute('disablePictureInPicture', '');
    video.setAttribute('disableRemotePlayback', '');
    video.src = url;
    container.appendChild(video);

    const speed = ((s.background_video_speed as number) ?? 100) / 100;
    const volume = ((s.background_video_volume as number) ?? 0) / 100;

    video.addEventListener('loadedmetadata', () => {
      video.playbackRate = speed;
      video.play().then(() => {
        if (volume > 0) {
          video.muted = false;
          video.volume = volume;
        }
      }).catch(err => console.warn('[VKify] Autoplay blocked:', err));
    }, { once: true });

    video.addEventListener('error', () => {
      console.warn('[VKify] Video background failed to load:', video.error?.message ?? 'unknown error');
      video.remove();
    });

    manager.injectCSS('custom_background', `
      ${getCommonCSS(s)}
      #vkify-video-bg {
        position: absolute;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%) scale(${((s.background_scale as number) ?? 105) / 100});
        min-width: 100%;
        min-height: 100%;
        width: auto;
        height: auto;
        object-fit: cover;
        filter: ${getFilterCSS(s)};
        opacity: ${((s.background_opacity as number) ?? 100) / 100};
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

    if (embedData.platform === 'rutube') {
      iframe.addEventListener('load', () => {
        rutubeController = setupRutubeControl(iframe);

        const volume = ((s.background_video_volume as number) ?? 0) / 100;
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
    const totalScale = extraScale * (((s.background_scale as number) ?? 105) / 100);

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
        opacity: ${((s.background_opacity as number) ?? 100) / 100};
        filter: ${getFilterCSS(s)};
        pointer-events: none;
      }
    `);
  };

  const renderWeb = (url: string, s: Record<string, unknown>) => {
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
        opacity: ${((s.background_opacity as number) ?? 100) / 100};
        transform: scale(${((s.background_scale as number) ?? 100) / 100});
        transform-origin: center center;
        pointer-events: none;
      }
    `);
  };

  return {
    custom_background: {
      enable: async (url?: unknown) => {
        if (!url) return;
        const urlStr = url as string;
        const s = await manager.getAllSettings();
        const type = (s.background_type as string) || 'image';

        if (type === 'embed') renderEmbed(urlStr, s as Record<string, unknown>);
        else if (type === 'video') renderVideo(urlStr, s as Record<string, unknown>);
        else if (type === 'web') renderWeb(urlStr, s as Record<string, unknown>);
        else renderImage(urlStr, s as Record<string, unknown>);
      },
      disable: () => clearAllBackgrounds(),
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
        const s = await manager.getAllSettings();
        const video = document.getElementById('vkify-video-bg') as HTMLVideoElement | null;
        if (video) video.playbackRate = ((s.background_video_speed as number) ?? 100) / 100;
      },
      disable: () => { /* no-op */ },
    },

    background_video_volume: {
      enable: async () => {
        const s = await manager.getAllSettings();
        const vol = ((s.background_video_volume as number) ?? 0) / 100;

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