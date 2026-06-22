import type { FeatureManager } from '@/content/core/feature-manager.js';
import type { FeatureMap, HiddenDialog } from '@/types/index.js';

const FEATURE_ID = 'hidden_dialogs';

function buildCSS(ids: string[]): string {
  if (ids.length === 0) return '';

  const selectors = ids.flatMap(id => [
    `._im_dialog_${id}`,
    `._im_sugg_${id}`,
    `#ui_rmenu_peer_${id}`,
    `#fc_contact${id}`,
    `#chat_tab_icon_${id}`,
    `#rb_box_fc_peer${id}`,
    `#wddi${id}_like_mail_dd`,
    `#wddi${id}_share_friend_dd`,
    `.FCThumb__link[href*="${id}"]`,
    `.im-mess-stack[data-peer="${id}"]`,
    `li[data-id="${id}"]`,
    `[data-itemkey="convo_${id}"]`,
  ]);

  return `${selectors.join(',\n')} {\n  display: none !important;\n}`;
}

export function createHideSpecificDialogsFeature(manager: FeatureManager): FeatureMap {
  return {
    [FEATURE_ID]: {
      reapplyOnNavigate: true,

      enable(value: unknown): void {
        const dialogs = Array.isArray(value) ? (value as HiddenDialog[]) : [];

        // Sanitise every ID to digits only — never put raw user input into CSS.
        const ids = dialogs
          .map(d => String(d.id).replace(/\D/g, ''))
          .filter(id => id.length > 0);

        if (ids.length === 0) {
          manager.removeCSS(FEATURE_ID);
          return;
        }

        manager.injectCSS(FEATURE_ID, buildCSS(ids));
      },

      disable(): void {
        manager.removeCSS(FEATURE_ID);
      },
    },
  };
}