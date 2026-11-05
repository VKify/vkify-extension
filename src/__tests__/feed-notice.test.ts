// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { FeatureContext } from '../content/core/feature-context.js';
import { createFeedNoticeSuppressor } from '../content/features/ads-blocking/feed-notice.js';

afterEach(() => { document.body.innerHTML = ''; });

function setup() {
  let scan = () => {};
  const unsubscribe = vi.fn();
  const ctx = {
    injectCSS: vi.fn(), removeCSS: vi.fn(),
    observeChanges: vi.fn((_id, callback) => { scan = callback; return unsubscribe; }),
  };
  const suppressor = createFeedNoticeSuppressor(ctx as unknown as FeatureContext);
  return { ctx, suppressor, unsubscribe, scan: () => scan() };
}

function mountNotice() {
  const layer = document.createElement('div');
  layer.style.zIndex = 'var(--vkui--z_index_popout)';
  layer.innerHTML = '<div class="backdrop"></div><div><div data-testid="feed_replaced_item_notify_modal" role="dialog" aria-modal="true"><h2>Вам видны не все посты</h2><div data-testid="modalfooter"><button>Закрыть</button></div></div></div>';
  document.body.append(layer);
  document.body.style.overflow = 'hidden';
  const close = vi.fn(() => { layer.remove(); document.body.style.removeProperty('overflow'); });
  layer.querySelector('button')!.addEventListener('click', close);
  return { layer, close };
}

it('closes only the targeted notice through VK and removes its backdrop and scroll lock', () => {
  document.body.innerHTML = '<div role="dialog"><button>Закрыть</button></div><article>Вам видны не все посты</article>';
  const unrelated = vi.fn();
  document.querySelector('button')!.addEventListener('click', unrelated);
  const { layer, close } = mountNotice();
  const { ctx, suppressor } = setup();
  suppressor.enable();
  expect(close).toHaveBeenCalledOnce();
  expect(layer.isConnected).toBe(false);
  expect(document.body.style.overflow).toBe('');
  expect(unrelated).not.toHaveBeenCalled();
  expect(document.querySelector('article')).not.toBeNull();
  const css = ctx.injectCSS.mock.calls[0][1];
  expect(css).toContain('[style*="--vkui--z_index_popout"]:has(');
  suppressor.disable();
});

it('handles delayed contents and repeated notices, and stops on disable', () => {
  const { suppressor, scan, unsubscribe, ctx } = setup();
  suppressor.enable();
  suppressor.enable();
  expect(ctx.observeChanges).toHaveBeenCalledOnce();
  const first = mountNotice();
  const button = first.layer.querySelector('button')!;
  button.disabled = true;
  scan();
  expect(first.close).not.toHaveBeenCalled();
  button.disabled = false;
  scan();
  expect(first.close).toHaveBeenCalledOnce();
  const next = mountNotice();
  scan();
  expect(next.close).toHaveBeenCalledOnce();
  suppressor.disable();
  expect(unsubscribe).toHaveBeenCalledOnce();
  expect(ctx.removeCSS).toHaveBeenCalledWith('vkify-feed-adblock-notice');
  const disabled = mountNotice();
  scan();
  expect(disabled.close).not.toHaveBeenCalled();
  suppressor.enable();
  expect(disabled.close).toHaveBeenCalledOnce();
  suppressor.disable();
});
