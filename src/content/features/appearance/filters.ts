import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap } from '../../../types/index.js';

export function createFilterFeatures(manager: FeatureManager): FeatureMap {
  return {
    filter_grayscale: {
      enable: () => manager.injectCSS('filter_grayscale', `html { filter: grayscale(1) !important; }`),
      disable: () => manager.removeCSS('filter_grayscale'),
    },

    filter_sepia: {
      enable: () => manager.injectCSS('filter_sepia', `html { filter: sepia(0.8) !important; }`),
      disable: () => manager.removeCSS('filter_sepia'),
    },

    filter_invert: {
      enable: () => {
        manager.injectCSS('filter_invert', `
          html { filter: invert(1) hue-rotate(180deg) !important; }
          img, video, iframe, canvas, svg { filter: invert(1) hue-rotate(180deg) !important; }
        `);
      },
      disable: () => manager.removeCSS('filter_invert'),
    },

    filter_dim_images: {
      enable: () => {
        manager.injectCSS('filter_dim_images', `
          img, video, .page_post_thumb_wrap, .MediaGrid__thumb,
          [class*="PhotoPrimaryAttachment"], [class*="VideoThumb"],
          .photo_row img, .media_link__photo {
            filter: brightness(0.6) !important;
            transition: filter 0.2s ease !important;
          }
          img:hover, video:hover,
          .page_post_thumb_wrap:hover img,
          .MediaGrid__thumb:hover img {
            filter: brightness(1) !important;
          }
        `);
      },
      disable: () => manager.removeCSS('filter_dim_images'),
    },

    filter_high_contrast: {
      enable: () => manager.injectCSS('filter_high_contrast', `html { filter: contrast(1.3) !important; }`),
      disable: () => manager.removeCSS('filter_high_contrast'),
    },

    filter_low_brightness: {
      enable: () => manager.injectCSS('filter_low_brightness', `html { filter: brightness(0.8) !important; }`),
      disable: () => manager.removeCSS('filter_low_brightness'),
    },
  };
}