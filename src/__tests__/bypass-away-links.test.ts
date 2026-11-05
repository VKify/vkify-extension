// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createBypassAwayLinksFeature } from '../content/features/automation/bypass-away-links.js';
import type { FeatureContext } from '../content/core/feature-context.js';

let feature: ReturnType<typeof createBypassAwayLinksFeature>['bypass_away_links'];

beforeEach(() => {
  window.location.href = 'https://vk.ru/feed';
  vi.spyOn(window, 'open').mockReturnValue(null);
  feature = createBypassAwayLinksFeature({} as FeatureContext).bypass_away_links;
});
afterEach(() => {
  feature.disable?.();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function mount(href: string) {
  const a = document.createElement('a');
  a.href = href;
  a.innerHTML = '<svg><path></path></svg>';
  document.body.append(a);
  return a.querySelector('path')!;
}
function click(element: Element, type = 'click', button = 0) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, button });
  element.dispatchEvent(event);
  return event;
}

it('opens only the destination even when VK registered a document capture handler first', () => {
  const vkHandler = vi.fn(() => window.open('https://vk.ru/feed', '_blank'));
  document.addEventListener('click', vkHandler, true);
  try {
    feature.enable?.();
    feature.enable?.();
    const target = 'https://example.com/page?a=1&next=%2Fpath#section';
    const event = click(mount('/away.php?to=' + encodeURIComponent(target)));
    expect(event.defaultPrevented).toBe(true);
    expect(vkHandler).not.toHaveBeenCalled();
    expect(window.open).toHaveBeenCalledExactlyOnceWith(target, '_blank', 'noopener,noreferrer');
  } finally { document.removeEventListener('click', vkHandler, true); }
});

it.each(['https://vk.com', 'https://vk.ru'])('supports UTF-8 destinations on %s', origin => {
  feature.enable?.();
  const target = 'https://example.com/привет?q=тест';
  click(mount(origin + '/away.php?utf=1&to=' + encodeURIComponent(target)));
  expect(window.open).toHaveBeenCalledExactlyOnceWith(new URL(target).href, '_blank', 'noopener,noreferrer');
});

it('keeps support for base64 destinations', () => {
  feature.enable?.();
  const target = 'https://example.com/page';
  click(mount('/away.php?to=' + encodeURIComponent(btoa(target))));
  expect(window.open).toHaveBeenCalledExactlyOnceWith(target, '_blank', 'noopener,noreferrer');
});

it('unwraps the supplied nested snippet link instead of opening another VK tab', () => {
  feature.enable?.();
  document.body.innerHTML = '<div data-testid="snippet-attachment"><a target="_blank" href="/away.php?track_code=test&amp;post=-22781583_4560276&amp;el=snippet&amp;to=https%3A%2F%2Fvk.com%2Faway.php%3Fto%3Dhttps%25253A%25252F%25252Fdtf.ru%25252Fgames%25252F5394873&amp;utf=1"><div><img data-testid="snippet-attachment-image"></div></a></div>';
  click(document.querySelector('img')!);
  expect(window.open).toHaveBeenCalledExactlyOnceWith('https://dtf.ru/games/5394873', '_blank', 'noopener,noreferrer');
});

it('opens the supplied plain text link directly', () => {
  feature.enable?.();
  document.body.innerHTML = '<a target="_blank" href="/away.php?to=https%3A%2F%2Fvkify.ru%2F&amp;utf=1">https://vkify.ru/</a>';
  click(document.querySelector('a')!);
  expect(window.open).toHaveBeenCalledExactlyOnceWith('https://vkify.ru/', '_blank', 'noopener,noreferrer');
});

it('preserves encoded destination query values after unwrapping multiple redirects', () => {
  feature.enable?.();
  const target = 'https://example.com/a%2Fb?q=a%26b&next=%252F#part';
  const nested = 'https://vk.com/away.php?to=' + encodeURIComponent(encodeURIComponent(target));
  click(mount('/away.php?to=' + encodeURIComponent(nested)));
  expect(window.open).toHaveBeenCalledExactlyOnceWith(target, '_blank', 'noopener,noreferrer');
});

it('leaves unresolved or excessively nested chains to VK without opening a partial destination', () => {
  feature.enable?.();
  const broken = 'https://vk.com/away.php?to=invalid';
  expect(click(mount('/away.php?to=' + encodeURIComponent(broken))).defaultPrevented).toBe(false);
  let nested = 'https://example.com/';
  for (let i = 0; i < 17; i++) nested = 'https://vk.ru/away.php?to=' + encodeURIComponent(nested);
  expect(click(mount(nested)).defaultPrevented).toBe(false);
  expect(window.open).not.toHaveBeenCalled();
});

it('handles middle clicks once without intercepting right clicks', () => {
  feature.enable?.();
  const element = mount('/away.php?to=https%3A%2F%2Fexample.com%2F');
  expect(click(element, 'auxclick', 2).defaultPrevented).toBe(false);
  expect(window.open).not.toHaveBeenCalled();
  expect(click(element, 'auxclick', 1).defaultPrevented).toBe(true);
  expect(window.open).toHaveBeenCalledTimes(1);
});

it.each([
  '/away.php', '/away.php?to=invalid', '/away.php?to=javascript%3Aalert(1)',
  'https://example.com/away.php?to=https%3A%2F%2Fexample.org',
  '/other/away.php?to=https%3A%2F%2Fexample.org', '/away.php.extra?to=https%3A%2F%2Fexample.org',
])('leaves unsupported links untouched: %s', href => {
  feature.enable?.();
  expect(click(mount(href)).defaultPrevented).toBe(false);
  expect(window.open).not.toHaveBeenCalled();
});

it('removes both handlers on disable and can be enabled again', () => {
  const element = mount('/away.php?to=https%3A%2F%2Fexample.com%2F');
  feature.enable?.();
  feature.disable?.();
  expect(click(element).defaultPrevented).toBe(false);
  expect(click(element, 'auxclick', 1).defaultPrevented).toBe(false);
  expect(window.open).not.toHaveBeenCalled();
  feature.enable?.();
  click(element);
  expect(window.open).toHaveBeenCalledTimes(1);
});
