import type { FeatureDefinition } from '@/content/core/features/index.js';
import { InjectedScript } from '@/content/core/injected-scripts.js';

const TARGET_HREF = '/groups/my_all_groups';
const DONE_ATTR = 'data-vkify-my-groups';   // маркер обработанной ссылки (для отката)
const ORIG_ATTR = 'data-vkify-orig-href';   // оригинальный href для revert

/**
 * Редирект пункта «Сообщества» левого меню на /groups/my_all_groups, чтобы
 * пропускать блок рекомендуемых сообществ.
 *
 * Почему не только подмена href: VK — SPA на React, навигация идёт через
 * собственный роутер, а href пункта восстанавливается ре-рендером. Поэтому:
 *   1) href меняем (hover/ctrl+click/новый таб ведут на «Мои сообщества»);
 *   2) page-world обработчик ведёт по маркированной ссылке через nav.go,
 *      сохраняя документ и воспроизведение музыки. Удаление маркера отключает его.
 */
export const myGroupsRedirectFeature: FeatureDefinition = {
  id: 'communities_my_groups_redirect',
  name: 'Сразу в «Мои сообщества»',
  category: 'misc',
  impact: 'light',
  settingsKeys: ['communities_my_groups_redirect'],
  tags: ['communities', 'menu', 'navigation'],

  init(ctx) {
    ctx.injectScript(InjectedScript.MY_GROUPS_NAVIGATION);
    const groupsSpec = ctx.selectors.menu.groups;

    // (1) Best-effort подмена href: для hover/статусбара и открытия в новом табе.
    ctx.registerMutationObserver(groupsSpec, (el) => {
      const a = el as HTMLAnchorElement;
      if (a.getAttribute('href') === TARGET_HREF) return;
      if (!a.hasAttribute(ORIG_ATTR)) {
        a.setAttribute(ORIG_ATTR, a.getAttribute('href') ?? '/groups');
      }
      a.setAttribute('href', TARGET_HREF);
      a.setAttribute(DONE_ATTR, '1');
    });
  },

  destroy() {
    document.querySelectorAll<HTMLAnchorElement>(`a[${DONE_ATTR}]`).forEach((a) => {
      const orig = a.getAttribute(ORIG_ATTR);
      if (orig) a.setAttribute('href', orig);
      a.removeAttribute(ORIG_ATTR);
      a.removeAttribute(DONE_ATTR);
    });
  },
};
