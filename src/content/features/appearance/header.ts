import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap } from '../../../types/index.js';

export function createHeaderFeatures(manager: FeatureManager): FeatureMap {
  return {
    collapse_search: {
      enable: () => {
        manager.injectCSS('collapse_search', `
          #ts_wrap {
            flex-grow: 0 !important;
            flex-shrink: 0 !important;
            width: auto !important;
            padding: 0 8px !important;
            margin: 0 !important;
            transition: all 0.3s ease-in-out;
          }

          #ts_wrap .vkuiSearch__field {
            width: 32px !important;
            background-color: transparent !important;
            padding: 0 !important;
            border-radius: 10px;
            cursor: pointer;
            box-shadow: none !important;
            transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s !important;
            overflow: hidden;
          }

          #ts_wrap .vkuiSearch__input svg {
            position: absolute !important;
            left: 8px !important;
            top: 50% !important;
            transform: translateY(-50%) !important;
            z-index: 5;
            color: var(--vkui--color_header_text_secondary) !important;
          }

          #ts_wrap .vkuiSearch__nativeInput {
            opacity: 0 !important;
            padding-left: 36px !important;
            pointer-events: none;
            transition: opacity 0.2s ease !important;
          }

          #ts_wrap .vkuiSearch__label { display: none !important; }

          #ts_wrap .vkuiSearch__field:hover,
          #ts_wrap .vkuiSearch__field:focus-within {
            width: 230px !important;
            background-color: var(--vkui--color_field_background) !important;
            cursor: text;
          }

          #ts_wrap .vkuiSearch__field:hover .vkuiSearch__nativeInput,
          #ts_wrap .vkuiSearch__field:focus-within .vkuiSearch__nativeInput {
            opacity: 1 !important;
            pointer-events: auto;
          }
        `);
      },
      disable: () => manager.removeCSS('collapse_search'),
    },
  };
}