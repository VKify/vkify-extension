import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap } from '../../../types/index.js';

const CSS_ID = 'content_width';

// CSS-блок для увеличения ширины профиля (id-селекторы из VK SPA).
function getProfileCSS(widthValue: number, isPercent: boolean): string {
  return `
    #profile_redesigned .Profile__column.vkuiSplitCol__host,
    .ProfileWrapper__root .Profile__column.vkuiSplitCol__host {
      width: ${isPercent ? '100%' : `${widthValue - 360}px`} !important;
      max-width: ${isPercent ? '100%' : `${widthValue}px`} !important;
    }
  `;
}

/**
 * Ширина контента VK:
 *   • `content_width_enabled` — boolean-тоггл (главный switch);
 *   • `content_width`         — числовое значение в px.
 *
 * Зеркало паттерна из page-offset.ts: closure-state делит флаг и значение,
 * `apply()` гейтит инжект по обоим. Если тоггл выключен — никакого CSS,
 * даже если value корректное.
 */
export function createWidescreenFeatures(manager: FeatureManager): FeatureMap {
  let isEnabled = false;
  let widthValue = 0;

  function apply(): void {
    manager.removeCSS(CSS_ID);
    if (!isEnabled || widthValue <= 0) return;

    const v = widthValue;
    manager.injectCSS(CSS_ID, `
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
  }

  return {
    content_width_enabled: {
      reapplyOnNavigate: true,

      enable: async () => {
        isEnabled = true;
        // Подтягиваем актуальное значение слайдера — на случай если
        // content_width_enabled инициализируется раньше content_width.
        const stored = await manager.getSetting<number>('content_width');
        if (typeof stored === 'number') widthValue = stored;
        apply();
      },

      disable: () => {
        isEnabled = false;
        manager.removeCSS(CSS_ID);
      },
    },

    content_width: {
      enable: (value?: unknown) => {
        if (typeof value === 'number') widthValue = value;
        apply();
      },
      disable: () => {
        widthValue = 0;
        apply();
      },
    },
  };
}
