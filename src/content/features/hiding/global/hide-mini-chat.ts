import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

/** Скрывает мини-чат и открывает переписку с сообществом на полной странице. */
const css = cssFeature({
  id: 'hide_mini_chat',
  name: 'Скрыть мини-чат',
  category: 'hiding',
  cssFiles: 'hiding/global/hide-mini-chat.css',
});

function openCommunityDialog(event: MouseEvent): void {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  const control = target.closest<HTMLElement>('a[href], button, [role="button"]');
  if (!control) return;

  const link = control instanceof HTMLAnchorElement ? control : control.closest('a[href]');
  const href = link?.getAttribute('href') ?? '';
  const community = location.pathname.match(/^\/(?:club|public|event)(\d+)(?:\/|$)/);
  const conversation = (control.matches('[data-testid="group_action_send_message"]') || community)
    && /^\/im\/convo\/-\d+(?:[/?#]|$)/.test(href);
  const write = href.match(/^\/write-?(\d+)(?:[/?#&]|$)/)
    ?? href.match(/^\/im\?sel=-(\d+)(?:[&#]|$)/);
  const isMessageButton = !href && community
    && /^(?:написать|отправить) сообщение$/i.test(control.textContent?.trim() ?? '');
  const groupId = write?.[1] ?? (isMessageButton ? community?.[1] : undefined);
  if (!conversation && !groupId) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  location.assign(conversation ? href : `/im/convo/-${groupId}`);
}

export const hideMiniChatFeature: FeatureDefinition = {
  ...css,
  init: () => document.addEventListener('click', openCommunityDialog, true),
  destroy: () => document.removeEventListener('click', openCommunityDialog, true),
};
