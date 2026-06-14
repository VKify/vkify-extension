/**
 * Пункт «Настройки VKify» в выпадающем меню профиля ВК. Клонируем существующий
 * пункт «Настройки» (cloneNode не копирует React-listeners — навешиваем свои
 * VKUI Tappable-классы и обработчики вручную) и ведём на /vkify_settings.
 */

import { EMBED_PATH } from './constants.js';

const PROFILE_MENU_SELECTOR  = '[data-testid="header-profile-menu"]';
const SETTINGS_LINK_SELECTOR = '#top_settings_link';
const ATTR_PROFILE_LINK = 'data-vkify-profile-link';

const VKIFY_ICON_SVG = `
  <svg aria-hidden="true" display="block" width="20" height="20" viewBox="0 0 231 148" fill="currentColor">
    <path d="M73.711 1.84L97.056 57.51c.864 2.06 3.596 2.487 5.047.789L151.041 1.05c.57-.667 1.403-1.05 2.281-1.05h67.793c2.53 0 3.924 2.939 2.323 4.898L107.853 146.382c-.578.707-1.445 1.112-2.357 1.102l-41.609-.462c-1.184-.014-2.25-.723-2.72-1.811L.249 4.19C-.606 2.209.846 0 3.003 0h67.941c1.209 0 2.299.725 2.767 1.84Z"/>
    <path d="M138.702 122.916l34.466-40.732c1.192-1.409 3.361-1.418 4.565-.018l51.942 60.378c1.674 1.944.292 4.956-2.274 4.956h-67.199c-.807 0-1.581-.325-2.145-.903l-19.209-19.645c-1.082-1.107-1.145-2.854-.146-4.036Z"/>
  </svg>
`;

// Классы VKUI Tappable — навешиваем сами, потому что cloneNode не копирует
// React-listeners оригинала.
const VKUI_HOVER_CLASS  = 'vkuiTappable__hoveredBackground';
const VKUI_ACTIVE_CLASS = 'vkuiTappable__activeBackground';

// Закрывает открытый VKUI Popover после клика по нашему пункту.
function closeOpenPopoverMenu(): void {
  requestAnimationFrame(() => {
    const trigger = document.querySelector<HTMLElement>(
      '[aria-expanded="true"][aria-haspopup="menu"], [aria-expanded="true"][aria-haspopup="dialog"]',
    );
    if (trigger) {
      trigger.click();
      return;
    }
    const opts = { bubbles: true, cancelable: true, clientX: 4, clientY: window.innerHeight - 4 };
    document.documentElement.dispatchEvent(new PointerEvent('pointerdown', opts));
    document.documentElement.dispatchEvent(new MouseEvent('mousedown', opts));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
}

function buildVKifyMenuItem(template: HTMLAnchorElement): HTMLAnchorElement {
  const clone = template.cloneNode(true) as HTMLAnchorElement;
  clone.id = 'top_vkify_settings_link';
  clone.setAttribute(ATTR_PROFILE_LINK, '1');
  clone.href = EMBED_PATH;

  clone.addEventListener('mouseenter', () => clone.classList.add(VKUI_HOVER_CLASS));
  clone.addEventListener('mouseleave', () => {
    clone.classList.remove(VKUI_HOVER_CLASS);
    clone.classList.remove(VKUI_ACTIVE_CLASS);
  });
  clone.addEventListener('mousedown',  () => clone.classList.add(VKUI_ACTIVE_CLASS));
  clone.addEventListener('mouseup',    () => clone.classList.remove(VKUI_ACTIVE_CLASS));
  clone.addEventListener('blur',       () => clone.classList.remove(VKUI_ACTIVE_CLASS));

  clone.addEventListener('click', (e) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    history.pushState({}, '', EMBED_PATH);
    window.dispatchEvent(new PopStateEvent('popstate'));
    closeOpenPopoverMenu();
  });

  const iconWrap = clone.querySelector('.vkuiSimpleCell__before') ?? clone.firstElementChild;
  if (iconWrap) {
    const oldIcon = iconWrap.querySelector('svg');
    if (oldIcon) {
      const tmp = document.createElement('div');
      tmp.innerHTML = VKIFY_ICON_SVG.trim();
      const newIcon = tmp.firstElementChild as SVGElement | null;
      if (newIcon) {
        for (const cls of Array.from(oldIcon.classList)) newIcon.classList.add(cls);
        newIcon.setAttribute('width',  oldIcon.getAttribute('width')  ?? '20');
        newIcon.setAttribute('height', oldIcon.getAttribute('height') ?? '20');
        (newIcon as unknown as HTMLElement).style.color = 'var(--vkui--color_accent_blue, #0077ff)';
        oldIcon.replaceWith(newIcon);
      }
    }
  }

  const textNode = clone.querySelector<HTMLElement>('.vkuiText__host');
  if (textNode) textNode.textContent = 'Настройки VKify';

  return clone;
}

function tryInjectMenuItem(menu: Element): void {
  if (menu.querySelector(`[${ATTR_PROFILE_LINK}="1"]`)) return;
  const template = menu.querySelector<HTMLAnchorElement>(SETTINGS_LINK_SELECTOR);
  if (!template) return; // шаблон ещё не отрендерен — повторный скан подхватит позже
  try {
    const item = buildVKifyMenuItem(template);
    template.parentElement?.insertBefore(item, template.nextSibling);
  } catch (err) {
    console.error('[VKify] Profile menu item injection failed:', err);
  }
}

/** Запускает скан меню профиля и следит за его перерисовками. */
export function startMenuObserver(): void {
  const scan = (): void => {
    document.querySelectorAll(PROFILE_MENU_SELECTOR).forEach(tryInjectMenuItem);
  };
  scan();

  // Пересканируем при ЛЮБОМ изменении DOM (дебаунс — раз в кадр), а не реагируем
  // только на добавление узла-меню. Причина: VK (React) добавляет контейнер
  // меню и его пункты (#top_settings_link) в РАЗНЫХ кадрах — в Firefox это
  // особенно заметно. Одноразовая реакция на добавление контейнера ловила его,
  // когда шаблона-ссылки внутри ещё не было, и пункт не вставлялся. Idempotent
  // tryInjectMenuItem делает повторные сканы безопасными.
  let scheduled = false;
  const obs = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; scan(); });
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
}
