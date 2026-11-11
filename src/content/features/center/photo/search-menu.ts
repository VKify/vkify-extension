import { createFloatingCard } from '@/content/ui/floating-card.js';

/** Uses the same floating card as the dialog export format picker. */
export function createSearchMenu(label: string, items: HTMLButtonElement[]): { element: HTMLElement; destroy: () => void } {
  const trigger = document.createElement('button');
  trigger.type = 'button'; trigger.className = 'pv_actions_more vkify-photo-search-toggle';
  trigger.textContent = label;
  trigger.setAttribute('aria-label', label); trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false'); trigger.setAttribute('aria-controls', 'vkify-photo-search-popup');
  const controller = new AbortController();
  const options = { signal: controller.signal };
  let popup: HTMLElement | null = null;
  const close = (focus = false): void => {
    popup?.remove(); popup = null;
    trigger.setAttribute('aria-expanded', 'false');
    if (focus && trigger.isConnected) trigger.focus();
  };
  const show = (last = false): void => {
    if (popup) return;
    const card = createFloatingCard({ title: label, className: 'vkify-photo-search-card' });
    popup = card.root; popup.id = 'vkify-photo-search-popup';
    card.list.setAttribute('role', 'menu'); card.list.setAttribute('aria-label', label);
    card.list.replaceChildren(...items);
    document.body.append(popup);
    popup.style.width = Math.min(280, innerWidth - 16) + 'px';
    popup.style.maxHeight = Math.max(100, innerHeight - 16) + 'px';
    const rect = trigger.getBoundingClientRect();
    const height = popup.offsetHeight;
    const above = rect.top - height - 6;
    popup.style.top = Math.max(8, above >= 8 ? above : Math.min(rect.bottom + 6, innerHeight - height - 8)) + 'px';
    popup.style.left = Math.max(8, Math.min(rect.left, innerWidth - popup.offsetWidth - 8)) + 'px';
    trigger.setAttribute('aria-expanded', 'true');
    (last ? items[items.length - 1] : items[0])?.focus({ preventScroll: true });
  };
  for (const item of items) {
    item.className = 'vkify-card__item'; item.setAttribute('role', 'menuitem');
    const icon = item.querySelector('img');
    const title = document.createElement('span'); title.className = 'vkify-card__title';
    title.textContent = item.textContent;
    const text = document.createElement('span'); text.className = 'vkify-card__txt'; text.append(title);
    if (item.hasAttribute('data-default') || item.dataset.searchHint) {
      const status = document.createElement('span'); status.className = 'vkify-card__status';
      status.textContent = [item.getAttribute('aria-description'), item.dataset.searchHint].filter(Boolean).join(' · '); text.append(status);
    }
    item.replaceChildren();
    if (icon) { icon.width = 20; icon.height = 20; item.append(icon); }
    item.append(text);
    item.addEventListener('click', () => close(true), options);
  }
  trigger.addEventListener('click', event => {
    event.preventDefault(); event.stopPropagation();
    if (popup) close(); else show();
  }, options);
  document.addEventListener('keydown', event => {
    const target = event.target as Node;
    if (!trigger.contains(target) && !popup?.contains(target)) return;
    if (event.key === 'Escape' && popup) { event.preventDefault(); event.stopPropagation(); close(true); }
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); event.stopPropagation();
      if (!popup) { show(event.key === 'ArrowUp'); return; }
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus({ preventScroll: true });
    } else if (event.key === 'Tab') close();
  }, { ...options, capture: true });
  document.addEventListener('pointerdown', event => {
    if (!popup?.contains(event.target as Node) && !trigger.contains(event.target as Node)) close();
  }, options);
  window.addEventListener('resize', () => close(), options);
  window.addEventListener('scroll', event => { if (!popup?.contains(event.target as Node)) close(); }, { ...options, capture: true });
  return { element: trigger, destroy: () => { close(); controller.abort(); trigger.remove(); } };
}
