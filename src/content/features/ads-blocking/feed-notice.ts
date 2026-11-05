import type { FeatureContext } from '../../core/feature-context.js';

const NOTICE = '[data-testid="feed_replaced_item_notify_modal"]';
const STYLE_ID = 'vkify-feed-adblock-notice';

/** Dismiss VK's adblock notice through its own lifecycle to release the modal lock. */
export function createFeedNoticeSuppressor(ctx: FeatureContext): { enable(): void; disable(): void } {
  let off: (() => void) | null = null;
  let enabled = false;
  const closing = new WeakSet<Element>();

  function dismiss(): void {
    if (!enabled) return;
    for (const dialog of document.querySelectorAll(NOTICE)) {
      if (closing.has(dialog)) continue;
      const close = dialog.querySelector<HTMLButtonElement>('[data-testid="modalfooter"] button');
      if (!close || close.disabled) continue;
      closing.add(dialog);
      close.click();
    }
  }

  return {
    enable(): void {
      if (enabled) return;
      enabled = true;
      // Hide both the notice and its popout backdrop before the observer runs.
      // The semantic marker survives class-name and translation changes.
      ctx.injectCSS(STYLE_ID, `${NOTICE}, [style*="--vkui--z_index_popout"]:has(${NOTICE}) { display: none !important; }`);
      off = ctx.observeChanges('block_feed_ads_api', dismiss, { schedule: 'frame' });
      dismiss();
    },
    disable(): void {
      enabled = false;
      off?.();
      off = null;
      ctx.removeCSS(STYLE_ID);
    },
  };
}
