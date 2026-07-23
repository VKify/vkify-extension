import { extractCmid } from '../_shared/message-dom.js';
import { detectConversationContext } from './peer.js';
import { runExport } from './run.js';
import { t } from '@/content/i18n/index.js';

export const SELECTOR_ATTR = 'data-vkify-pdf-selector-injected';
export const SELECTOR_CLASS = 'vkify-pdf-selector';

const ACTIVE_CLASS = 'vkify-pdf-selection-active';
const SELECTED_CLASS = 'vkify-pdf-message-selected';
const BAR_ID = 'vkify-pdf-selection-bar';

let selected = new Set<number>();
let sourceContext = '';
let countEl: HTMLElement | null = null;
let exportBtn: HTMLButtonElement | null = null;
const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape' && document.documentElement.classList.contains(ACTIVE_CLASS)) {
    stopPdfSelection();
  }
};

function contextKey(): string {
  const context = detectConversationContext();
  return context ? `${context.groupId ?? 'im'}:${context.peerId}` : '';
}

function updateBar(): void {
  if (countEl) countEl.textContent = t('messages.export.selection.count', { count: selected.size });
  if (exportBtn) exportBtn.disabled = selected.size === 0;
}

export function injectMessageSelector(messageBlock: Element): void {
  if (messageBlock.hasAttribute(SELECTOR_ATTR)) return;
  const cmid = extractCmid(messageBlock);
  if (cmid === null) return;

  const label = document.createElement('label');
  label.className = SELECTOR_CLASS;
  label.title = t('messages.export.selection.checkbox');

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('aria-label', t('messages.export.selection.checkbox'));
  input.checked = selected.has(cmid);
  label.appendChild(input);

  label.addEventListener('click', e => e.stopPropagation());
  input.addEventListener('change', () => {
    if (input.checked) selected.add(cmid);
    else selected.delete(cmid);
    messageBlock.classList.toggle(SELECTED_CLASS, input.checked);
    updateBar();
  });

  messageBlock.prepend(label);
  messageBlock.classList.toggle(SELECTED_CLASS, input.checked);
  messageBlock.setAttribute(SELECTOR_ATTR, '1');
}

function makeButton(className: string, text: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = text;
  return button;
}

export function stopPdfSelection(): void {
  window.removeEventListener('keydown', onKeydown);
  document.documentElement.classList.remove(ACTIVE_CLASS);
  document.getElementById(BAR_ID)?.remove();
  document.querySelectorAll(`.${SELECTED_CLASS}`).forEach(el => el.classList.remove(SELECTED_CLASS));
  document.querySelectorAll<HTMLInputElement>(`.${SELECTOR_CLASS} input`).forEach(input => {
    input.checked = false;
  });
  selected.clear();
  sourceContext = '';
  countEl = null;
  exportBtn = null;
}

export function startPdfSelection(decrypt: boolean): void {
  stopPdfSelection();
  sourceContext = contextKey();
  if (!sourceContext) {
    alert(t('messages.export.no_peer'));
    return;
  }

  document.documentElement.classList.add(ACTIVE_CLASS);
  window.addEventListener('keydown', onKeydown);

  const bar = document.createElement('div');
  bar.id = BAR_ID;
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', t('messages.export.selection.toolbar'));

  countEl = document.createElement('span');
  countEl.className = 'vkify-pdf-selection-count';

  const actions = document.createElement('div');
  actions.className = 'vkify-pdf-selection-actions';
  const cancelBtn = makeButton('vkify-pdf-selection-cancel', t('messages.export.selection.cancel'));
  exportBtn = makeButton('vkify-pdf-selection-export', t('messages.export.selection.export'));
  exportBtn.disabled = true;

  cancelBtn.addEventListener('click', stopPdfSelection);
  exportBtn.addEventListener('click', () => {
    if (selected.size === 0) return;
    if (contextKey() !== sourceContext) {
      alert(t('messages.export.selection.changed_dialog'));
      stopPdfSelection();
      return;
    }
    const ids = new Set(selected);
    stopPdfSelection();
    void runExport('pdf', decrypt, ids);
  });

  actions.append(cancelBtn, exportBtn);
  bar.append(countEl, actions);
  document.body.appendChild(bar);
  updateBar();
}
