import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap } from '../../../types/index.js';

const GAP = 17;
const BASE_LEFT = 550;
const BASE_RIGHT = 345;
const CONTENT_SUM = BASE_LEFT + BASE_RIGHT;
const LEFT_RATIO = BASE_LEFT / CONTENT_SUM;
const RIGHT_RATIO = BASE_RIGHT / CONTENT_SUM;

function getProfileCSS(widthValue: number, isPercent = false): string {
  const widthStr = isPercent ? String(widthValue) : `${widthValue}px`;
  const rightWidthCalc = isPercent
    ? `calc((${widthValue} - ${GAP}px) * ${RIGHT_RATIO})`
    : `calc((${widthValue}px - ${GAP}px) * ${BASE_RIGHT} / ${CONTENT_SUM})`;

  return `
    #profile_redesigned .vkuiSplitLayout__inner {
      box-sizing: border-box !important;
      ${isPercent ? 'width: 100% !important;' : `max-width: ${widthValue}px !important;`}
    }

    .Profile__column.vkuiSplitCol__host.vkuiSplitCol__viewWidthSmallTabletPlus.vkuiInternalSplitCol--viewWidth-tabletPlus.vkuiRootComponent__host {
      width: calc((${widthStr} - ${GAP}px) * ${LEFT_RATIO}) !important;
      min-width: 0 !important;
      max-width: none !important;
      flex-shrink: 0 !important;
      box-sizing: border-box !important;
    }

    #profile_redesigned .ScrollStickyWrapper {
      width: ${rightWidthCalc} !important;
      min-width: 0 !important;
      max-width: none !important;
      box-sizing: border-box !important;
    }

    #profile_redesigned .ScrollStickyWrapper > div {
      width: 100% !important;
      min-width: 0 !important;
      max-width: ${rightWidthCalc} !important;
      box-sizing: border-box !important;
    }

    #profile_redesigned .ScrollStickyWrapper > div[style*="position: fixed"],
    #profile_redesigned .ScrollStickyWrapper > div[style*="position:fixed"] {
      width: ${rightWidthCalc} !important;
      max-width: ${rightWidthCalc} !important;
    }

    #profile_redesigned .ScrollStickyWrapper aside,
    #profile_redesigned .ScrollStickyWrapper aside > section,
    #profile_redesigned .ScrollStickyWrapper aside .vkuiGroup__host {
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
    }

    .vkuiSplitLayout__host.vkuiRootComponent__host {
      max-width: ${isPercent ? '100%' : `${widthValue}px`} !important;
    }
  `;
}

export function createWidescreenFeatures(manager: FeatureManager): FeatureMap {
  return {
    content_width: {
      enable: (value?: unknown) => {
        if (!value || value === 0) return;
        const v = value as number;

        manager.injectCSS('content_width', `
          #page_header, #page_layout { width: ${v}px !important; }
          #footer_wrap { width: ${v}px !important; }
          #page_body { width: calc(${v}px - 170px) !important; }
          .im-chat-input .im-chat-input--textarea { width: calc(${v}px - 120px) !important; }
          .page_module_upload { padding: 28px 13px 28px 40% !important; }
          .apps_recent_block { width: calc(${v}px - 365px) !important; }
          .apps_featured_slider { width: ${v}px !important; }
          .wall_text { overflow: hidden; }
          ${getProfileCSS(v, false)}
        `);
      },
      disable: () => manager.removeCSS('content_width'),
    },
  };
}