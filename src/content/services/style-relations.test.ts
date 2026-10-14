// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { startStyleRelations } from './style-relations.js';
import { domObserver } from '../core/dom/dom-observer.js';

let stop: (() => void) | undefined;
async function settle(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
}
beforeEach(() => { vi.stubGlobal('chrome', { runtime: { id: 'test' } }); });
afterEach(() => {
  stop?.(); stop = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals();
  document.body.replaceChildren();
  for (const a of [...document.documentElement.attributes]) if (a.name.startsWith('data-vkify-')) document.documentElement.removeAttribute(a.name);
});

it('tracks hashed layout/logo/skeleton ancestors without querying long comment subtrees', async () => {
  for (const flag of ['edge_sidebar', 'minimalistic_sidebar', 'hide_profile_right_column']) document.documentElement.setAttribute(`data-vkify-${flag}`, '');
  document.body.innerHTML = '<header id="page_header_cont"><div class="TopNavigation__logo--one"><a class="Logo__root--one"></a></div></header><div id="page_layout"><div class="LayoutWrapper__body--one"><main id="comments"></main></div></div><div id="profile"><header data-testid="profile-header"></header><aside class="ScrollStickyWrapper"></aside></div><div class="ProfileSkeleton__layout--one"><div></div><div></div></div>';
  stop = startStyleRelations();
  const layout = document.getElementById('page_layout')!;
  const body = layout.firstElementChild!;
  const logo = document.querySelector('.TopNavigation__logo--one')!;
  const skeleton = document.querySelector('.ProfileSkeleton__layout--one')!;
  expect(body.hasAttribute('data-vkify-layout-body')).toBe(true);
  expect(logo.hasAttribute('data-vkify-navigation-logo')).toBe(true);
  expect(skeleton.hasAttribute('data-vkify-profile-skeleton-layout')).toBe(true);
  expect(document.getElementById('profile')!.hasAttribute('data-vkify-has-profile-header')).toBe(true);
  const layoutMatch = vi.spyOn(body, 'matches');
  const comment = document.createElement('div'); comment.className = 'new-comment';
  document.getElementById('comments')!.append(comment); await settle();
  expect(layoutMatch).not.toHaveBeenCalled();
  body.className = 'LayoutWrapper__body--two'; logo.className = 'other'; skeleton.className = 'other';
  await settle();
  expect(body.hasAttribute('data-vkify-layout-body')).toBe(true);
  expect(logo.hasAttribute('data-vkify-navigation-logo')).toBe(false);
  expect(skeleton.hasAttribute('data-vkify-profile-skeleton-layout')).toBe(false);
  document.querySelector('[data-testid="profile-header"]')!.remove(); await settle();
  expect(document.getElementById('profile')!.hasAttribute('data-vkify-has-profile-header')).toBe(false);
  body.className = 'different'; await settle();
  expect(body.hasAttribute('data-vkify-layout-body')).toBe(false);
});

it.each(['tile_sidebar', 'menu_items_order'])('marks loaded/skeleton menus, follows hydration, and avoids scans for unrelated comments (%s)', async flag => {
  document.documentElement.setAttribute(`data-vkify-${flag}`, '');
  document.body.innerHTML = '<aside id="layout_sidebar"><nav data-testid="leftmenu"><ol><li data-testid="leftmenuitem"></li><div><hr></div></ol></nav></aside><main id="comments"></main>';
  stop = startStyleRelations();
  const sidebar = document.getElementById('layout_sidebar')!;
  const list = sidebar.querySelector('ol')!;
  expect(list.hasAttribute('data-vkify-menu-loaded-list')).toBe(true);
  expect(list.querySelector('div')!.hasAttribute('data-vkify-menu-divider')).toBe(true);
  const query = vi.spyOn(sidebar, 'querySelectorAll');
  document.getElementById('comments')!.append(document.createElement('span'));
  await settle(); expect(query).not.toHaveBeenCalled();
  list.innerHTML = '<li><div><div class="vkitInternalImageBase"></div><div>Skeleton</div></div></li>';
  await settle();
  expect(list.hasAttribute('data-vkify-menu-loaded-list')).toBe(false);
  expect(list.hasAttribute('data-vkify-menu-skeleton-list')).toBe(true);
  expect(list.firstElementChild!.hasAttribute('data-vkify-menu-skeleton-item')).toBe(true);
  list.querySelector('.vkitInternalImageBase')!.className = 'different'; await settle();
  expect(list.hasAttribute('data-vkify-menu-skeleton-list')).toBe(false);
});

it('cancels disabled work, restores reinserted roots, and releases every subscription', async () => {
  const base = domObserver.subCount();
  document.documentElement.setAttribute('data-vkify-edge_sidebar', '');
  document.body.innerHTML = '<aside id="layout_sidebar"><ol><li data-testid="leftmenuitem"></li></ol></aside>';
  const sidebar = document.getElementById('layout_sidebar')!;
  stop = startStyleRelations();
  sidebar.remove(); await settle(); document.body.append(sidebar); await settle();
  expect(sidebar.querySelector('ol')!.hasAttribute('data-vkify-menu-loaded-list')).toBe(true);
  document.documentElement.removeAttribute('data-vkify-edge_sidebar'); await settle();
  expect(sidebar.querySelector('ol')!.hasAttribute('data-vkify-menu-loaded-list')).toBe(false);
  expect(domObserver.subCount()).toBe(base);
  const query = vi.spyOn(sidebar, 'querySelectorAll');
  sidebar.append(document.createElement('div')); await settle(); expect(query).not.toHaveBeenCalled();
  document.documentElement.setAttribute('data-vkify-tile_sidebar', ''); await settle();
  expect(sidebar.querySelector('ol')!.hasAttribute('data-vkify-menu-loaded-list')).toBe(true);
  stop(); stop = undefined; expect(domObserver.subCount()).toBe(base);
});

it('tracks rotating calls promos and removes stale markers without a mutation feedback loop', async () => {
  document.documentElement.setAttribute('data-vkify-block_recommendations_calls', '');
  document.body.innerHTML = '<main id="spa_layout_content"><div id="aside"><section data-testid="calls_aside_menu"></section><section class="vkuiBanner__host" id="promo"><img><a href="/promo">CTA</a></section></div></main>';
  stop = startStyleRelations();
  const promo = document.getElementById('promo')!;
  expect(promo.hasAttribute('data-vkify-calls-promo')).toBe(true);
  promo.querySelector('a')!.removeAttribute('href'); await settle();
  expect(promo.hasAttribute('data-vkify-calls-promo')).toBe(false);
  promo.querySelector('a')!.setAttribute('href', '/new'); await settle();
  expect(promo.hasAttribute('data-vkify-calls-promo')).toBe(true);
  const observer = new MutationObserver(() => {}); observer.observe(document.body, { attributes: true, childList: true, subtree: true });
  await settle(); expect(observer.takeRecords()).toHaveLength(0); observer.disconnect();
  document.querySelector('[data-testid="calls_aside_menu"]')!.remove(); await settle();
  expect(document.getElementById('aside')!.hasAttribute('data-vkify-calls-aside')).toBe(false);
});

it('updates community/feed context on identity changes without reading geometry', async () => {
  document.documentElement.setAttribute('data-vkify-communities_swap_columns', '');
  document.documentElement.setAttribute('data-vkify-hide_feed_right_column', '');
  document.body.innerHTML = '<main><div id="context"><div id="anchor"></div></div><a data-testid="feed_right_menu_news" href="/feed"></a><div id="wrapper"><div><section data-testid="rightmenu"></section></div></div></main>';
  const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect');
  stop = startStyleRelations();
  const anchor = document.getElementById('anchor')!; anchor.id = 'group_tabs'; await settle();
  expect(document.body.hasAttribute('data-vkify-has-group-tabs')).toBe(true);
  expect(document.getElementById('context')!.hasAttribute('data-vkify-has-group-tabs')).toBe(true);
  expect(anchor.hasAttribute('data-vkify-has-group-tabs')).toBe(false);
  expect(document.body.hasAttribute('data-vkify-has-feed-news')).toBe(true);
  expect(document.getElementById('wrapper')!.hasAttribute('data-vkify-feed-menu-wrapper')).toBe(true);
  anchor.remove(); document.querySelector('a')!.setAttribute('href', '/other'); await settle();
  expect(document.body.hasAttribute('data-vkify-has-group-tabs')).toBe(false);
  expect(document.body.hasAttribute('data-vkify-has-feed-news')).toBe(false);
  expect(rect).not.toHaveBeenCalled();
});

it('avoids document and body scans on discussion updates while keeping moved ancestors current', async () => {
  for (const flag of ['hide_profile_right_column', 'communities_swap_columns', 'hide_feed_right_column']) document.documentElement.setAttribute(`data-vkify-${flag}`, '');
  document.body.innerHTML = '<main><div id="first"><header data-testid="profile-header"></header><div id="group_tabs"></div></div><div id="second"></div><div id="comments"></div></main>';
  stop = startStyleRelations();
  const query = vi.spyOn(document, 'querySelectorAll');
  const bodyQuery = vi.spyOn(document.body, 'querySelectorAll');
  document.getElementById('comments')!.insertAdjacentHTML('beforeend', '<article><div>Reply</div></article>');
  await settle();
  expect(query).not.toHaveBeenCalled(); expect(bodyQuery).not.toHaveBeenCalled();
  const first = document.getElementById('first')!;
  const second = document.getElementById('second')!;
  second.append(...first.childNodes); await settle();
  expect(first.hasAttribute('data-vkify-has-profile-header')).toBe(false);
  expect(first.hasAttribute('data-vkify-has-group-tabs')).toBe(false);
  expect(second.hasAttribute('data-vkify-has-profile-header')).toBe(true);
  expect(second.hasAttribute('data-vkify-has-group-tabs')).toBe(true);
  expect(query).not.toHaveBeenCalled(); expect(bodyQuery).not.toHaveBeenCalled();
});
