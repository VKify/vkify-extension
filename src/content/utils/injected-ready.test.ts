// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { waitForInjectedScript } from './injected-ready.js';
import { dispatchPageEvent } from './page-event.js';

it('remembers an installed API interceptor without another timeout on SPA reactivation', async () => {
  vi.useFakeTimers();
  try {
    dispatchPageEvent('vkify-script-ready', { name: 'feed-ad-blocker' });
    await waitForInjectedScript('feed-ad-blocker');
    await waitForInjectedScript('feed-ad-blocker');
    expect(vi.getTimerCount()).toBe(0);
  } finally { vi.useRealTimers(); }
});
