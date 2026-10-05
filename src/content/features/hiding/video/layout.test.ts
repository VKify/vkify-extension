// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FeatureContext } from '@/content/core/feature-context.js';
import { createVideoLayoutFeature } from './layout.js';

function context() {
  let change = (): void => {};
  const off = vi.fn();
  const ctx = { observeChanges: vi.fn((_id: string, callback: () => void) => { change = callback; return off; }) } as unknown as FeatureContext;
  return { ctx, off, change: () => change() };
}
afterEach(() => { document.body.innerHTML = ''; });

describe('VK Video layout boundaries', () => {
  it('protects separate player/info branches and shadow players even after the comments header', () => {
    document.body.innerHTML = '<div id="spa_root"><section><div id="player"><video></video></div><div data-testid="video-page-info"></div><div id="heading"><span data-testid="video-comments-count"></span></div><div id="comments"><div data-testid="comment"></div></div><div id="later-player"></div></section></div>';
    document.querySelector('#later-player')!.attachShadow({ mode: 'open' }).innerHTML = '<video></video>';
    const { ctx, off } = context();
    const feature = createVideoLayoutFeature(ctx, 'hide_video_comments');
    feature.enable();
    expect(Array.from(document.querySelectorAll('[data-vkify-video-comment-block]')).map(element => element.id)).toEqual(['heading', 'comments']);
    feature.disable();
    expect(document.querySelectorAll('[data-vkify-video-comment-block]')).toHaveLength(0);
    expect(off).toHaveBeenCalledOnce();
  });

  it('removes stale layout markers after React replaces the sidebar with unrelated content', () => {
    document.body.innerHTML = '<div id="spa_root"><div id="layout"><div role="main"><div data-testid="video-page-info"></div></div><div id="side"><section id="video_recommendations"></section></div></div></div>';
    const { ctx, change } = context();
    const feature = createVideoLayoutFeature(ctx, 'hide_video_recommendations');
    feature.enable();
    expect(document.querySelector('#layout')!.hasAttribute('data-vkify-video-wide-layout')).toBe(true);
    document.querySelector('#side')!.innerHTML = '<p>Unrelated content</p>';
    change();
    expect(document.querySelectorAll('[data-vkify-video-wide-layout], [data-vkify-video-wide-main], [data-vkify-video-wide-side]')).toHaveLength(0);
    feature.disable();
  });

  it('hides video attachments inside comments without treating them as the main player', () => {
    document.body.innerHTML = '<div id="spa_root"><section><div><video id="main"></video></div><div data-testid="video-page-info"></div><div><span data-testid="video-comments-count"></span></div><div id="comments"><div data-testid="comment"><video></video></div></div></section></div>';
    const { ctx } = context();
    const feature = createVideoLayoutFeature(ctx, 'hide_video_comments');
    feature.enable();
    expect(document.querySelector('#comments')!.hasAttribute('data-vkify-video-comment-block')).toBe(true);
    expect(document.querySelector('#main')!.parentElement!.hasAttribute('data-vkify-video-comment-block')).toBe(false);
    feature.disable();
  });

  it('does not restructure unrecognized recommendation layouts', () => {
    document.body.innerHTML = '<div id="spa_root"><section><div data-testid="video-page-info"></div><section id="video_recommendations"></section><aside>Other content</aside></section></div>';
    const { ctx } = context();
    const feature = createVideoLayoutFeature(ctx, 'hide_video_recommendations');
    feature.enable();
    expect(document.querySelectorAll('[data-vkify-video-related-block]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-vkify-video-wide-layout]')).toHaveLength(0);
    feature.disable();
  });

  it('keeps shared login wrappers and unrelated sidebar/header controls', () => {
    document.body.innerHTML = '<header><button data-testid="main-menu-sign-in-btn"></button></header><aside data-testid="video_left_menu"><div id="shared"><section id="login"><button data-testid="main-menu-sign-in-btn"></button></section><a>Legal</a></div></aside>';
    const { ctx } = context();
    const feature = createVideoLayoutFeature(ctx, 'hide_video_login_prompt');
    feature.enable();
    expect(document.querySelector('[data-vkify-video-login-block]')!.id).toBe('login');
    expect(document.querySelector('#shared')!.hasAttribute('data-vkify-video-login-block')).toBe(false);
    feature.disable();
  });
});
