import type { FeatureDefinition } from '@/content/core/features/index.js';

const TARGET_HREF = '/groups/my_all_groups';
const DONE_ATTR = 'data-vkify-my-groups';   // маркер обработанной ссылки (для отката)
const ORIG_ATTR = 'data-vkify-orig-href';   // оригинальный href для revert

// Снятие document-перехватчика клика (ставится в init, снимается в destroy).
let removeClickInterceptor: (() => void) | null = null;

/**
 * Редирект пункта «Сообщества» левого меню на /groups/my_all_groups, чтобы
 * пропускать блок рекомендуемых сообществ.
 *
 * Почему не только подмена href: VK — SPA на React, навигация идёт через
 * собственный роутер, а href пункта восстанавливается ре-рендером. Поэтому:
 *   1) href меняем (hover/ctrl+click/новый таб ведут на «Мои сообщества»);
 *   2) основную навигацию перехватываем кликом в capture-фазе на document —
 *      срабатывает раньше обработчиков VK и не зависит от сброса href.
 * Оба эффекта снимаются при выключении.
 */
export const myGroupsRedirectFeature: FeatureDefinition = {
  id: 'communities_my_groups_redirect',
  name: 'Сразу в «Мои сообщества»',
  category: 'misc',
  impact: 'light',
  settingsKeys: ['communities_my_groups_redirect'],
  tags: ['communities', 'menu', 'navigation'],

  init(ctx) {
    // Единый источник селектора — реестр ctx.selectors. closest() требует строку,
    // поэтому список кандидатов сворачиваем в union через запятую.
    const groupsSpec = ctx.selectors.menu.groups;
    const groupsSelector = [groupsSpec].flat().join(', ');

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

    // (2) Надёжный перехват обычного клика поверх SPA-роутера VK.
    const onClick = (e: MouseEvent): void => {
      // Не вмешиваемся в «открыть в новом табе» (там сработает подменённый href).
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const target = e.target as Element | null;
      if (!target?.closest?.(groupsSelector)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      window.location.assign(TARGET_HREF);
    };
    document.addEventListener('click', onClick, true);
    removeClickInterceptor = () => document.removeEventListener('click', onClick, true);
  },

  destroy() {
    removeClickInterceptor?.();
    removeClickInterceptor = null;
    document.querySelectorAll<HTMLAnchorElement>(`a[${DONE_ATTR}]`).forEach((a) => {
      const orig = a.getAttribute(ORIG_ATTR);
      if (orig) a.setAttribute('href', orig);
      a.removeAttribute(ORIG_ATTR);
      a.removeAttribute(DONE_ATTR);
    });
  },
};
