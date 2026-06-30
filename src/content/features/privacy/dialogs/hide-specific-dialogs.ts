import type { FeatureManager } from '@/content/core/feature-manager.js';
import type { FeatureMap, HiddenDialog } from '@/types/index.js';
import { fcListReflow } from './fc-list-reflow.js';

const FEATURE_ID = 'hidden_dialogs';

function buildCSS(dialogs: HiddenDialog[]): string {
  if (dialogs.length === 0) return '';

  const selectors = dialogs.flatMap(d => {
    const id = String(d.id).replace(/\D/g, '');
    const name = d.name || '';

    return [
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
      // Мини-чат: миниатюры и список по имени
      ...(name ? [
        `.FCThumb[aria-label="${name}"]`,
        `.FCConvoListItem[aria-label="${name}"]`,
        // Открытое окно диалога по имени в заголовке
        `.FCWindow.FCConvo:has(.FCConvoHeader .ConvoTitle__author[title="${name}"])`,
      ] : []),
    ];
  });

  return `${selectors.join(',\n')} {\n  display: none !important;\n}`;
}

export function createHideSpecificDialogsFeature(manager: FeatureManager): FeatureMap {
  return {
    [FEATURE_ID]: {
      reapplyOnNavigate: true,

      enable(value: unknown): void {
        const dialogs = Array.isArray(value) ? (value as HiddenDialog[]) : [];

        const sanitized = dialogs
            .map(d => ({
              id: String(d.id).replace(/\D/g, ''),
              name: d.name
            }))
            .filter(d => d.id.length > 0);

        if (sanitized.length === 0) {
          manager.removeCSS(FEATURE_ID);
          fcListReflow.stop();
          return;
        }

        manager.injectCSS(FEATURE_ID, buildCSS(sanitized));

        // CSS прячет строку плавающего мини-чата, но абсолютные `top` соседей
        // оставляют дыру — пересчитываем раскладку через JS (см. fc-list-reflow).
        // Мини-чат матчится по aria-label = имя собеседника.
        const names = new Set(sanitized.map(d => d.name).filter(n => n.length > 0));
        fcListReflow.start(names);
      },

      disable(): void {
        manager.removeCSS(FEATURE_ID);
        fcListReflow.stop();
      },
    },
  };
}